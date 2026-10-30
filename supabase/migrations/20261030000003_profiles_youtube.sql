-- Profile editing (photo, name, deletion request) and YouTube channel connections (ADR-020).

alter table public.profiles
  add column avatar_mode text not null default 'auto' check (avatar_mode in ('auto', 'upload', 'none')),
  add column avatar_asset_id uuid references public.assets (id) on delete set null,
  add column deletion_requested_at timestamptz,
  add column updated_at timestamptz not null default now();

-- One YouTube channel per workspace. The refresh token is AES-256-GCM ciphertext produced by the app
-- (TOKEN_ENCRYPTION_KEY); clients can read the channel columns but never the token column.
create table public.youtube_connections (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  connected_by uuid references auth.users (id) on delete set null,
  channel_id text not null check (char_length(channel_id) between 1 and 64),
  channel_title text not null check (char_length(channel_title) between 1 and 200),
  channel_thumbnail_url text check (char_length(channel_thumbnail_url) <= 1000),
  scopes text[] not null default '{}',
  refresh_token_ciphertext text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.youtube_connections enable row level security;
create policy youtube_select_own on public.youtube_connections for select to authenticated
  using (workspace_id in (select public.my_workspace_ids()));
revoke all on public.youtube_connections from anon, authenticated;
grant select (workspace_id, channel_id, channel_title, channel_thumbnail_url, scopes, connected_at, updated_at)
  on public.youtube_connections to authenticated;
grant all on public.youtube_connections to service_role;

-- Google/OAuth sign-ups carry full_name/name and avatar metadata; use them for the initial display name.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_workspace uuid;
begin
  insert into public.profiles (id, display_name)
    values (new.id, left(coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)), 80));
  insert into public.workspaces (owner_id, name)
    values (new.id, left(coalesce(split_part(new.email, '@', 1), 'My') || '''s workspace', 80))
    returning id into v_workspace;
  insert into public.credit_ledger (workspace_id, amount, kind, reference_type, reference_id, idempotency_key)
    values (v_workspace, 60000000, 'grant', 'signup', new.id::text, 'signup:' || new.id::text);
  return new;
end $$;

-- Users edit only their own profile; a custom photo must be an image asset in their own workspace.
create function public.update_my_profile(p_display_name text, p_avatar_mode text, p_avatar_asset_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_display_name is not null and char_length(btrim(p_display_name)) not between 1 and 80 then
    raise exception 'VALIDATION_FAILED';
  end if;
  if p_avatar_mode is not null and p_avatar_mode not in ('auto', 'upload', 'none') then
    raise exception 'VALIDATION_FAILED';
  end if;
  if p_avatar_mode = 'upload' and not exists (
    select 1 from public.assets a join public.workspaces w on w.id = a.workspace_id
    where a.id = p_avatar_asset_id and w.owner_id = v_uid and a.kind = 'upload'
      and a.mime in ('image/png', 'image/jpeg', 'image/webp') and a.deleted_at is null
  ) then
    raise exception 'NOT_FOUND';
  end if;
  update public.profiles set
    display_name = coalesce(btrim(p_display_name), display_name),
    avatar_mode = coalesce(p_avatar_mode, avatar_mode),
    avatar_asset_id = case
      when p_avatar_mode = 'upload' then p_avatar_asset_id
      when p_avatar_mode is not null then null
      else avatar_asset_id end,
    updated_at = now()
  where id = v_uid;
end $$;

create function public.set_account_deletion(p_requested boolean) returns timestamptz
  language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  update public.profiles
    set deletion_requested_at = case when p_requested then coalesce(deletion_requested_at, now()) else null end,
        updated_at = now()
    where id = v_uid
    returning deletion_requested_at into v_at;
  insert into public.audit_events (actor_id, workspace_id, action)
    select v_uid, w.id, case when p_requested then 'account.deletion_requested' else 'account.deletion_canceled' end
    from public.workspaces w where w.owner_id = v_uid;
  return v_at;
end $$;

-- Supabase grants new functions to API roles by default; keep these two callable only as the signed-in user.
revoke execute on function public.update_my_profile(text, text, uuid) from public, anon;
revoke execute on function public.set_account_deletion(boolean) from public, anon;
grant execute on function public.update_my_profile(text, text, uuid) to authenticated, service_role;
grant execute on function public.set_account_deletion(boolean) to authenticated, service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
