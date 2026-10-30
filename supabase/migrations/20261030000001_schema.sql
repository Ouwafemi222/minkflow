-- Minkflow core schema (doc 04). RLS deny-by-default; privileged writes go through SECURITY DEFINER functions.
-- Rollback: drop schema objects in reverse order (see docs/RUNBOOKS.md#database-rollback).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  plan text not null default 'free' check (plan in ('free', 'starter', 'creator', 'pro')),
  suspended_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  status text not null default 'draft' check (status in (
    'draft','script_pending','script_ready','storyboard_pending','storyboard_ready','media_pending','media_ready',
    'preview_ready','render_queued','rendering','completed','failed','canceled','retry_pending')),
  current_revision_id uuid,
  version integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_workspace_idx on public.projects (workspace_id, updated_at desc) where deleted_at is null;

create table public.project_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  version integer not null check (version > 0),
  input_json jsonb not null,
  script_json jsonb,
  storyboard_json jsonb,
  brand_json jsonb not null,
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);
alter table public.projects
  add constraint projects_current_revision_fk foreign key (current_revision_id) references public.project_revisions (id) on delete set null;

create table public.scenes (
  id uuid not null,
  revision_id uuid not null references public.project_revisions (id) on delete cascade,
  position integer not null check (position >= 0),
  template_id text not null,
  scene_json jsonb not null,
  content_hash text not null,
  primary key (revision_id, id),
  unique (revision_id, position)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  kind text not null check (kind in ('narration', 'upload', 'logo', 'preview', 'render')),
  storage_key text not null unique,
  mime text not null,
  size bigint not null check (size >= 0),
  sha256 text not null,
  cache_key text,
  duration_ms integer,
  meta_json jsonb not null default '{}'::jsonb,
  provenance_json jsonb not null default '{}'::jsonb,
  license_json jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index assets_cache_key_idx on public.assets (workspace_id, cache_key) where cache_key is not null and deleted_at is null;
create index assets_expiry_idx on public.assets (expires_at) where deleted_at is null and expires_at is not null;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  revision_id uuid references public.project_revisions (id) on delete set null,
  type text not null check (type in ('noop','script','storyboard','scene_regenerate','media','preview','render','retention_sweep')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','canceled','retry_pending')),
  stage text,
  progress real not null default 0 check (progress between 0 and 1),
  idempotency_key text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  input_json jsonb not null default '{}'::jsonb,
  result_json jsonb,
  error_code text,
  error_message text,
  cancel_requested boolean not null default false,
  reserved_credits bigint not null default 0,
  locked_by text,
  locked_until timestamptz,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);
create index jobs_runnable_idx on public.jobs (run_after) where status in ('queued', 'retry_pending');
create index jobs_project_idx on public.jobs (project_id, created_at desc);
create index jobs_running_idx on public.jobs (locked_until) where status = 'running';

create table public.job_artifacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique (job_id, asset_id, role)
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  provider text not null,
  model text,
  operation text not null,
  quantity numeric not null,
  unit text not null,
  estimated_usd numeric(12, 6) not null default 0,
  actual_usd numeric(12, 6),
  cached boolean not null default false,
  provider_request_id text,
  created_at timestamptz not null default now()
);
create index usage_events_workspace_idx on public.usage_events (workspace_id, created_at desc);
create index usage_events_day_idx on public.usage_events (created_at);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  amount bigint not null check (amount <> 0),
  currency_unit text not null default 'microcredit' check (currency_unit = 'microcredit'),
  kind text not null check (kind in ('grant', 'purchase', 'reserve', 'release', 'refund', 'adjustment')),
  reference_type text not null,
  reference_id text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index credit_ledger_workspace_idx on public.credit_ledger (workspace_id, created_at desc);

create table public.credit_reservations (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  amount bigint not null check (amount > 0),
  status text not null default 'held' check (status in ('held', 'settled', 'released')),
  charged bigint,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('paystack')),
  reference text not null unique,
  external_id text,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'abandoned')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  credits bigint not null check (credits > 0),
  pack_id text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  payload_hash text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  action text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_workspace_idx on public.audit_events (workspace_id, created_at desc);

create table public.rate_limit_buckets (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

-- Immutability: revisions, scenes and ledger rows can never be updated.
create function public.forbid_update() returns trigger language plpgsql as $$
begin
  raise exception 'IMMUTABLE: % rows are immutable', tg_table_name using errcode = 'P0001';
end $$;
create trigger project_revisions_immutable before update on public.project_revisions for each row execute function public.forbid_update();
create trigger scenes_immutable before update on public.scenes for each row execute function public.forbid_update();
create trigger credit_ledger_immutable before update on public.credit_ledger for each row execute function public.forbid_update();
create function public.forbid_ledger_delete() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() = 1 and current_setting('minkflow.allow_ledger_delete', true) is distinct from 'on' then
    raise exception 'IMMUTABLE: credit_ledger is append-only' using errcode = 'P0001';
  end if;
  return old;
end $$;
create trigger credit_ledger_append_only before delete on public.credit_ledger for each row execute function public.forbid_ledger_delete();

-- Row level security: enable everywhere, deny by default.
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.project_revisions enable row level security;
alter table public.scenes enable row level security;
alter table public.assets enable row level security;
alter table public.jobs enable row level security;
alter table public.job_artifacts enable row level security;
alter table public.usage_events enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.rate_limit_buckets enable row level security;

create function public.my_workspace_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select id from public.workspaces where owner_id = auth.uid()
$$;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy workspaces_select_own on public.workspaces for select to authenticated using (owner_id = auth.uid());
create policy projects_select_own on public.projects for select to authenticated
  using (workspace_id in (select public.my_workspace_ids()));
create policy projects_insert_own on public.projects for insert to authenticated
  with check (workspace_id in (select public.my_workspace_ids()) and status = 'draft' and version = 0 and current_revision_id is null);
create policy projects_update_own on public.projects for update to authenticated
  using (workspace_id in (select public.my_workspace_ids()))
  with check (workspace_id in (select public.my_workspace_ids()));
create policy revisions_select_own on public.project_revisions for select to authenticated
  using (project_id in (select id from public.projects where workspace_id in (select public.my_workspace_ids())));
create policy scenes_select_own on public.scenes for select to authenticated
  using (revision_id in (select r.id from public.project_revisions r join public.projects p on p.id = r.project_id
                         where p.workspace_id in (select public.my_workspace_ids())));
create policy assets_select_own on public.assets for select to authenticated
  using (workspace_id in (select public.my_workspace_ids()) and deleted_at is null);
create policy jobs_select_own on public.jobs for select to authenticated using (workspace_id in (select public.my_workspace_ids()));
create policy job_artifacts_select_own on public.job_artifacts for select to authenticated
  using (job_id in (select id from public.jobs where workspace_id in (select public.my_workspace_ids())));
create policy usage_select_own on public.usage_events for select to authenticated using (workspace_id in (select public.my_workspace_ids()));
create policy ledger_select_own on public.credit_ledger for select to authenticated using (workspace_id in (select public.my_workspace_ids()));
create policy payments_select_own on public.payments for select to authenticated using (workspace_id in (select public.my_workspace_ids()));

-- Column-level privileges: clients may only touch user-editable columns.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.workspaces, public.projects, public.project_revisions, public.scenes, public.assets,
  public.jobs, public.job_artifacts, public.usage_events, public.credit_ledger, public.payments to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert (workspace_id, title) on public.projects to authenticated;
grant update (title, deleted_at) on public.projects to authenticated;
grant all on all tables in schema public to service_role;
