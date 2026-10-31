alter table public.profiles
  add column deletion_reason text,
  add column deletion_note text;

alter table public.profiles
  add constraint profiles_deletion_reason_len check (deletion_reason is null or char_length(deletion_reason) between 1 and 40),
  add constraint profiles_deletion_note_len check (deletion_note is null or char_length(deletion_note) <= 200);

drop function public.set_account_deletion(boolean);

create function public.set_account_deletion(p_requested boolean, p_reason text default null, p_note text default null)
  returns timestamptz
  language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_requested then
    if v_reason is null or v_reason not in (
      'not_using', 'missing_features', 'too_expensive', 'switching', 'privacy', 'mistake', 'other'
    ) then
      raise exception 'VALIDATION_FAILED';
    end if;
    if v_reason = 'other' and v_note is null then
      raise exception 'VALIDATION_FAILED';
    end if;
    if v_reason <> 'other' then
      v_note := null;
    end if;
  else
    v_reason := null;
    v_note := null;
  end if;
  update public.profiles
    set deletion_requested_at = case when p_requested then coalesce(deletion_requested_at, now()) else null end,
        deletion_reason = case when p_requested then coalesce(deletion_reason, v_reason) else null end,
        deletion_note = case when p_requested then coalesce(deletion_note, v_note) else null end,
        updated_at = now()
    where id = v_uid
    returning deletion_requested_at into v_at;
  insert into public.audit_events (actor_id, workspace_id, action, metadata)
    select v_uid, w.id,
      case when p_requested then 'account.deletion_requested' else 'account.deletion_canceled' end,
      case when p_requested then jsonb_build_object('reason', v_reason, 'note', v_note) else '{}'::jsonb end
    from public.workspaces w where w.owner_id = v_uid;
  return v_at;
end $$;

revoke execute on function public.set_account_deletion(boolean, text, text) from public, anon;
grant execute on function public.set_account_deletion(boolean, text, text) to authenticated, service_role;
