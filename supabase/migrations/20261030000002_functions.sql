-- Privileged, transactional operations. All credit and job state changes happen here so they are atomic
-- and cannot be bypassed by clients. Service-only functions are revoked from anon/authenticated at the end.

-- Signup: profile + single-owner workspace + free trial credits (60 credits = ~1 minute watermarked video).
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_workspace uuid;
begin
  insert into public.profiles (id, display_name)
    values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 80));
  insert into public.workspaces (owner_id, name)
    values (new.id, left(coalesce(split_part(new.email, '@', 1), 'My') || '''s workspace', 80))
    returning id into v_workspace;
  insert into public.credit_ledger (workspace_id, amount, kind, reference_type, reference_id, idempotency_key)
    values (v_workspace, 60000000, 'grant', 'signup', new.id::text, 'signup:' || new.id::text);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.workspace_balance(p_workspace_id uuid) returns bigint
  language sql stable as $$
  select coalesce(sum(amount), 0)::bigint from public.credit_ledger where workspace_id = p_workspace_id
$$;

-- Revisions: optimistic concurrency on projects.version. Scenes are indexed from the storyboard.
create function public._commit_revision(
  p_project_id uuid, p_expected_version integer, p_input jsonb, p_script jsonb, p_storyboard jsonb, p_brand jsonb,
  p_scenes jsonb, p_author uuid
) returns public.project_revisions
  language plpgsql security definer set search_path = public as $$
declare
  v_project public.projects;
  v_revision public.project_revisions;
begin
  select * into v_project from public.projects where id = p_project_id and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_project.version <> p_expected_version then raise exception 'REVISION_CONFLICT' using errcode = 'P0001'; end if;
  insert into public.project_revisions (project_id, version, input_json, script_json, storyboard_json, brand_json, author_id)
    values (p_project_id, v_project.version + 1, p_input, p_script, p_storyboard, p_brand, p_author)
    returning * into v_revision;
  if p_scenes is not null and jsonb_typeof(p_scenes) = 'array' then
    insert into public.scenes (id, revision_id, position, template_id, scene_json, content_hash)
      select (s ->> 'id')::uuid, v_revision.id, (s ->> 'position')::int, s ->> 'template_id', s -> 'scene_json', s ->> 'content_hash'
      from jsonb_array_elements(p_scenes) s;
  end if;
  update public.projects set current_revision_id = v_revision.id, version = v_revision.version, updated_at = now()
    where id = p_project_id;
  return v_revision;
end $$;

create function public.commit_revision(
  p_project_id uuid, p_expected_version integer, p_input jsonb, p_script jsonb, p_storyboard jsonb, p_brand jsonb, p_scenes jsonb
) returns public.project_revisions
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  if not exists (select 1 from public.projects where id = p_project_id and workspace_id in (select public.my_workspace_ids())) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  return public._commit_revision(p_project_id, p_expected_version, p_input, p_script, p_storyboard, p_brand, p_scenes, auth.uid());
end $$;

create function public.commit_revision_service(
  p_project_id uuid, p_expected_version integer, p_input jsonb, p_script jsonb, p_storyboard jsonb, p_brand jsonb, p_scenes jsonb
) returns public.project_revisions
  language sql security definer set search_path = public as $$
  select public._commit_revision(p_project_id, p_expected_version, p_input, p_script, p_storyboard, p_brand, p_scenes, null)
$$;

create function public.set_project_status(p_project_id uuid, p_from text[], p_to text) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  update public.projects set status = p_to, updated_at = now()
    where id = p_project_id and (p_from is null or status = any (p_from));
  return found;
end $$;

-- Jobs + credit reservation in one transaction. Idempotent per (workspace, idempotency_key).
create function public.create_job(
  p_workspace_id uuid, p_project_id uuid, p_revision_id uuid, p_type text, p_idempotency_key text, p_input jsonb,
  p_credits bigint, p_max_active integer, p_max_attempts integer default 3
) returns table (job jsonb, created boolean)
  language plpgsql security definer set search_path = public as $$
declare
  v_ws public.workspaces;
  v_job public.jobs;
  v_active integer;
  v_balance bigint;
begin
  select * into v_ws from public.workspaces where id = p_workspace_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ws.suspended_at is not null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  select * into v_job from public.jobs where workspace_id = p_workspace_id and idempotency_key = p_idempotency_key;
  if found then
    return query select to_jsonb(v_job), false;
    return;
  end if;

  if p_type <> 'retention_sweep' then
    select count(*) into v_active from public.jobs
      where workspace_id = p_workspace_id and status in ('queued', 'running', 'retry_pending') and type <> 'retention_sweep';
    if v_active >= p_max_active then raise exception 'CONCURRENCY_LIMIT' using errcode = 'P0001'; end if;
  end if;

  if p_credits < 0 then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;
  if p_credits > 0 then
    v_balance := public.workspace_balance(p_workspace_id);
    if v_balance < p_credits then raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001'; end if;
  end if;

  insert into public.jobs (workspace_id, project_id, revision_id, type, idempotency_key, input_json, reserved_credits, max_attempts)
    values (p_workspace_id, p_project_id, p_revision_id, p_type, p_idempotency_key, coalesce(p_input, '{}'::jsonb), p_credits, p_max_attempts)
    returning * into v_job;

  if p_credits > 0 then
    insert into public.credit_reservations (job_id, workspace_id, amount) values (v_job.id, p_workspace_id, p_credits);
    insert into public.credit_ledger (workspace_id, amount, kind, reference_type, reference_id, idempotency_key)
      values (p_workspace_id, -p_credits, 'reserve', 'job', v_job.id::text, 'reserve:' || v_job.id::text);
  end if;
  return query select to_jsonb(v_job), true;
end $$;

-- Settle: charge actual (<= reserved), return the remainder. Idempotent.
create function public.settle_job_credits(p_job_id uuid, p_charged bigint) returns bigint
  language plpgsql security definer set search_path = public as $$
declare
  v_res public.credit_reservations;
  v_charge bigint;
begin
  select * into v_res from public.credit_reservations where job_id = p_job_id for update;
  if not found then return 0; end if;
  if v_res.status <> 'held' then return coalesce(v_res.charged, 0); end if;
  v_charge := greatest(0, least(coalesce(p_charged, v_res.amount), v_res.amount));
  if v_res.amount - v_charge > 0 then
    insert into public.credit_ledger (workspace_id, amount, kind, reference_type, reference_id, idempotency_key)
      values (v_res.workspace_id, v_res.amount - v_charge, 'release', 'job', p_job_id::text, 'release:' || p_job_id::text);
  end if;
  update public.credit_reservations set status = 'settled', charged = v_charge, closed_at = now() where job_id = p_job_id;
  return v_charge;
end $$;

-- Refund the full reservation (failed / canceled-before-start). Idempotent.
create function public.release_job_credits(p_job_id uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  v_res public.credit_reservations;
begin
  select * into v_res from public.credit_reservations where job_id = p_job_id for update;
  if not found or v_res.status <> 'held' then return false; end if;
  insert into public.credit_ledger (workspace_id, amount, kind, reference_type, reference_id, idempotency_key)
    values (v_res.workspace_id, v_res.amount, 'refund', 'job', p_job_id::text, 'refund:' || p_job_id::text);
  update public.credit_reservations set status = 'released', charged = 0, closed_at = now() where job_id = p_job_id;
  return true;
end $$;

create function public.grant_credits(
  p_workspace_id uuid, p_amount bigint, p_kind text, p_reference_type text, p_reference_id text, p_idempotency_key text
) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('grant', 'purchase', 'adjustment') then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;
  insert into public.credit_ledger (workspace_id, amount, kind, reference_type, reference_id, idempotency_key)
    values (p_workspace_id, p_amount, p_kind, p_reference_type, p_reference_id, p_idempotency_key)
    on conflict (idempotency_key) do nothing;
  return found;
end $$;

-- Leases: a worker owns a running job until locked_until; heartbeats extend it.
create function public._claim(v_id uuid, p_worker text, p_lease_seconds integer) returns public.jobs
  language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs;
begin
  update public.jobs set status = 'running', attempt_count = attempt_count + 1, locked_by = p_worker,
      locked_until = now() + make_interval(secs => p_lease_seconds), started_at = coalesce(started_at, now()),
      updated_at = now(), error_code = null, error_message = null
    where id = v_id returning * into v_job;
  return v_job;
end $$;

create function public.claim_job(p_job_id uuid, p_worker text, p_lease_seconds integer) returns public.jobs
  language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from public.jobs
    where id = p_job_id and status in ('queued', 'retry_pending') and not cancel_requested and run_after <= now()
    for update skip locked;
  if v_id is null then return null; end if;
  return public._claim(v_id, p_worker, p_lease_seconds);
end $$;

create function public.claim_next_job(p_worker text, p_lease_seconds integer, p_types text[] default null) returns public.jobs
  language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from public.jobs
    where status in ('queued', 'retry_pending') and not cancel_requested and run_after <= now()
      and (p_types is null or type = any (p_types))
    order by run_after, created_at
    for update skip locked limit 1;
  if v_id is null then return null; end if;
  return public._claim(v_id, p_worker, p_lease_seconds);
end $$;

-- Returns: 'ok' | 'cancel' | 'lost' (lease no longer held by this worker).
create function public.heartbeat_job(p_job_id uuid, p_worker text, p_lease_seconds integer, p_progress real, p_stage text)
  returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_cancel boolean;
begin
  update public.jobs set locked_until = now() + make_interval(secs => p_lease_seconds),
      progress = greatest(progress, least(1, coalesce(p_progress, progress))), stage = coalesce(p_stage, stage), updated_at = now()
    where id = p_job_id and status = 'running' and locked_by = p_worker
    returning cancel_requested into v_cancel;
  if not found then return 'lost'; end if;
  return case when v_cancel then 'cancel' else 'ok' end;
end $$;

create function public.complete_job(p_job_id uuid, p_worker text, p_result jsonb, p_charged bigint) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  update public.jobs set status = 'completed', progress = 1, result_json = p_result, finished_at = now(), updated_at = now(),
      locked_by = null, locked_until = null
    where id = p_job_id and status = 'running' and locked_by = p_worker;
  if not found then return false; end if;
  perform public.settle_job_credits(p_job_id, p_charged);
  return true;
end $$;

-- Returns the resulting status: 'retry_pending' | 'failed' | 'lost'.
create function public.fail_job(
  p_job_id uuid, p_worker text, p_error_code text, p_error_message text, p_retryable boolean, p_retry_delay_seconds integer
) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id and status = 'running' and locked_by = p_worker for update;
  if not found then return 'lost'; end if;
  if p_retryable and v_job.attempt_count < v_job.max_attempts and not v_job.cancel_requested then
    update public.jobs set status = 'retry_pending', run_after = now() + make_interval(secs => p_retry_delay_seconds),
        locked_by = null, locked_until = null, error_code = p_error_code, error_message = left(p_error_message, 500), updated_at = now()
      where id = p_job_id;
    return 'retry_pending';
  end if;
  update public.jobs set status = 'failed', finished_at = now(), locked_by = null, locked_until = null,
      error_code = p_error_code, error_message = left(p_error_message, 500), updated_at = now()
    where id = p_job_id;
  perform public.release_job_credits(p_job_id);
  return 'failed';
end $$;

-- Worker acknowledges a cancel request; charges only what was actually consumed (published policy, doc 03).
create function public.finish_canceled_job(p_job_id uuid, p_worker text, p_charged bigint) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  update public.jobs set status = 'canceled', finished_at = now(), locked_by = null, locked_until = null, updated_at = now(),
      error_code = 'JOB_CANCELED'
    where id = p_job_id and status = 'running' and locked_by = p_worker;
  if not found then return false; end if;
  if coalesce(p_charged, 0) > 0 then perform public.settle_job_credits(p_job_id, p_charged);
  else perform public.release_job_credits(p_job_id); end if;
  return true;
end $$;

-- User-initiated cancel. Queued jobs cancel immediately with full refund; running jobs get a cancel request.
create function public.cancel_job(p_job_id uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or (auth.uid() is not null and v_job.workspace_id not in (select public.my_workspace_ids())) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_job.status in ('queued', 'retry_pending') then
    update public.jobs set status = 'canceled', cancel_requested = true, finished_at = now(), updated_at = now(), error_code = 'JOB_CANCELED'
      where id = p_job_id;
    perform public.release_job_credits(p_job_id);
    return 'canceled';
  elsif v_job.status = 'running' then
    update public.jobs set cancel_requested = true, updated_at = now() where id = p_job_id;
    return 'cancel_requested';
  end if;
  return v_job.status;
end $$;

-- Stuck-job sweeper: expired leases are retried or failed (with refund). Returns affected count.
create function public.sweep_stuck_jobs() returns integer
  language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs;
  v_count integer := 0;
begin
  for v_job in select * from public.jobs where status = 'running' and locked_until < now() for update skip locked loop
    if v_job.cancel_requested then
      update public.jobs set status = 'canceled', finished_at = now(), locked_by = null, locked_until = null, updated_at = now(),
          error_code = 'JOB_CANCELED' where id = v_job.id;
      perform public.release_job_credits(v_job.id);
    elsif v_job.attempt_count < v_job.max_attempts then
      update public.jobs set status = 'retry_pending', run_after = now(), locked_by = null, locked_until = null,
          error_code = 'WORKER_LOST', updated_at = now() where id = v_job.id;
    else
      update public.jobs set status = 'failed', finished_at = now(), locked_by = null, locked_until = null,
          error_code = 'WORKER_LOST', error_message = 'Worker stopped responding', updated_at = now() where id = v_job.id;
      perform public.release_job_credits(v_job.id);
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Payment webhook: dedupe event, validate amount/currency server-side, grant credits once. One transaction.
-- Returns: 'duplicate' | 'unknown_reference' | 'already_fulfilled' | 'mismatch' | 'fulfilled'.
create function public.fulfill_payment(
  p_provider text, p_event_id text, p_event_type text, p_payload_hash text, p_reference text, p_external_id text,
  p_amount_minor bigint, p_currency text
) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments;
  v_event uuid;
begin
  insert into public.webhook_events (provider, external_event_id, event_type, payload_hash)
    values (p_provider, p_event_id, p_event_type, p_payload_hash)
    on conflict (provider, external_event_id) do nothing
    returning id into v_event;
  if v_event is null then return 'duplicate'; end if;

  select * into v_payment from public.payments where provider = p_provider and reference = p_reference for update;
  if not found then
    update public.webhook_events set processed_at = now() where id = v_event;
    return 'unknown_reference';
  end if;
  if v_payment.status = 'success' then
    update public.webhook_events set processed_at = now() where id = v_event;
    return 'already_fulfilled';
  end if;
  if v_payment.amount_minor <> p_amount_minor or upper(v_payment.currency) <> upper(p_currency) then
    update public.payments set status = 'failed' where id = v_payment.id;
    update public.webhook_events set processed_at = now() where id = v_event;
    insert into public.audit_events (workspace_id, action, target_id, metadata)
      values (v_payment.workspace_id, 'payment.mismatch', v_payment.id::text,
              jsonb_build_object('expected', v_payment.amount_minor, 'got', p_amount_minor, 'currency', p_currency));
    return 'mismatch';
  end if;
  update public.payments set status = 'success', external_id = p_external_id, verified_at = now() where id = v_payment.id;
  insert into public.credit_ledger (workspace_id, amount, kind, reference_type, reference_id, idempotency_key)
    values (v_payment.workspace_id, v_payment.credits, 'purchase', 'payment', v_payment.id::text, 'payment:' || v_payment.id::text);
  update public.webhook_events set processed_at = now() where id = v_event;
  insert into public.audit_events (workspace_id, action, target_id, metadata)
    values (v_payment.workspace_id, 'payment.fulfilled', v_payment.id::text, jsonb_build_object('credits', v_payment.credits));
  return 'fulfilled';
end $$;

-- Fixed-window rate limiter. Returns true if the call is allowed.
create function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limit_buckets (key, window_start, count) values (p_key, v_window, 1)
    on conflict (key, window_start) do update set count = public.rate_limit_buckets.count + 1
    returning count into v_count;
  return v_count <= p_limit;
end $$;

-- Lock down: nothing is executable by clients unless granted explicitly below.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.my_workspace_ids() to authenticated;
grant execute on function public.workspace_balance(uuid) to authenticated;
grant execute on function public.commit_revision(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.cancel_job(uuid) to authenticated;
grant execute on all functions in schema public to service_role;
