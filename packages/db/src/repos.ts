import { AppError } from '@minkflow/shared';
import type { JobType, ProjectStatus } from '@minkflow/contracts';
import { json, type Queryable } from './client';
import type { AssetKind, AssetRow, AvatarMode, JobRow, LedgerRow, PaymentRow, ProfileRow, ProjectRow, RevisionRow, UsageRow, WorkspaceRow, YoutubeConnectionRow } from './types';

function one<T>(rows: T[], code: 'NOT_FOUND' = 'NOT_FOUND'): T {
  const row = rows[0];
  if (!row) throw new AppError(code);
  return row;
}

// ---------- Workspaces (user-scoped: run inside withUser) ----------
export async function getMyWorkspace(tx: Queryable): Promise<WorkspaceRow> {
  return one((await tx.query<WorkspaceRow>('select * from public.workspaces limit 1')).rows);
}

export async function getBalance(q: Queryable, workspaceId: string): Promise<number> {
  const { rows } = await q.query<{ balance: number }>('select public.workspace_balance($1)::bigint as balance', [workspaceId]);
  return Number(rows[0]?.balance ?? 0);
}

// ---------- Projects ----------
export async function listProjects(tx: Queryable, limit = 50): Promise<ProjectRow[]> {
  return (await tx.query<ProjectRow>('select * from public.projects where deleted_at is null order by updated_at desc limit $1', [limit])).rows;
}

export async function getProject(q: Queryable, projectId: string): Promise<ProjectRow> {
  return one((await q.query<ProjectRow>('select * from public.projects where id = $1 and deleted_at is null', [projectId])).rows);
}

export async function createProject(tx: Queryable, workspaceId: string, title: string): Promise<ProjectRow> {
  return one((await tx.query<ProjectRow>('insert into public.projects (workspace_id, title) values ($1, $2) returning *', [workspaceId, title])).rows);
}

export async function renameProject(tx: Queryable, projectId: string, title: string): Promise<ProjectRow> {
  return one((await tx.query<ProjectRow>('update public.projects set title = $2 where id = $1 and deleted_at is null returning *', [projectId, title])).rows);
}

export async function softDeleteProject(tx: Queryable, projectId: string): Promise<void> {
  one((await tx.query('update public.projects set deleted_at = now() where id = $1 and deleted_at is null returning id', [projectId])).rows);
}

export async function setProjectStatus(q: Queryable, projectId: string, from: ProjectStatus[] | null, to: ProjectStatus): Promise<boolean> {
  const { rows } = await q.query<{ ok: boolean }>('select public.set_project_status($1, $2::text[], $3) as ok', [projectId, from, to]);
  return Boolean(rows[0]?.ok);
}

// ---------- Revisions ----------
export interface CommitRevisionInput {
  projectId: string;
  expectedVersion: number;
  input: unknown;
  script: unknown;
  storyboard: unknown;
  brand: unknown;
  scenes: Array<{ id: string; position: number; template_id: string; scene_json: unknown; content_hash: string }> | null;
}

export async function commitRevision(q: Queryable, input: CommitRevisionInput, as: 'user' | 'service'): Promise<RevisionRow> {
  const fn = as === 'user' ? 'commit_revision' : 'commit_revision_service';
  const { rows } = await q.query<RevisionRow>(
    `select * from public.${fn}($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb)`,
    [input.projectId, input.expectedVersion, json(input.input), json(input.script), json(input.storyboard), json(input.brand), json(input.scenes)],
  );
  return one(rows);
}

export async function getRevision(q: Queryable, revisionId: string): Promise<RevisionRow> {
  return one((await q.query<RevisionRow>('select * from public.project_revisions where id = $1', [revisionId])).rows);
}

export async function listRevisions(q: Queryable, projectId: string, limit = 20): Promise<Array<Pick<RevisionRow, 'id' | 'version' | 'created_at'>>> {
  return (await q.query<Pick<RevisionRow, 'id' | 'version' | 'created_at'>>(
    'select id, version, created_at from public.project_revisions where project_id = $1 order by version desc limit $2', [projectId, limit],
  )).rows;
}

// ---------- Jobs (service) ----------
export interface CreateJobInput {
  workspaceId: string;
  projectId: string | null;
  revisionId: string | null;
  type: JobType;
  idempotencyKey: string;
  input: Record<string, unknown>;
  credits: number;
  maxActive: number;
  maxAttempts?: number;
}

export async function createJob(q: Queryable, input: CreateJobInput): Promise<{ job: JobRow; created: boolean }> {
  const { rows } = await q.query<{ job: JobRow; created: boolean }>(
    'select job, created from public.create_job($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)',
    [input.workspaceId, input.projectId, input.revisionId, input.type, input.idempotencyKey, json(input.input), input.credits, input.maxActive, input.maxAttempts ?? 3],
  );
  const row = one(rows);
  return { job: reviveJob(row.job), created: row.created };
}

function reviveJob(raw: JobRow): JobRow {
  const dates = ['locked_until', 'run_after', 'created_at', 'started_at', 'finished_at', 'updated_at'] as const;
  const job = { ...raw } as unknown as Record<string, unknown>;
  for (const k of dates) if (typeof job[k] === 'string') job[k] = new Date(job[k] as string);
  job.reserved_credits = Number(job.reserved_credits);
  return job as unknown as JobRow;
}

export async function getJob(q: Queryable, jobId: string): Promise<JobRow> {
  return one((await q.query<JobRow>('select * from public.jobs where id = $1', [jobId])).rows);
}

export async function listProjectJobs(q: Queryable, projectId: string, limit = 20): Promise<JobRow[]> {
  return (await q.query<JobRow>('select * from public.jobs where project_id = $1 order by created_at desc limit $2', [projectId, limit])).rows;
}

export async function listWorkspaceJobs(q: Queryable, limit = 50): Promise<Array<JobRow & { project_title: string | null }>> {
  return (await q.query<JobRow & { project_title: string | null }>(
    `select j.*, p.title as project_title from public.jobs j left join public.projects p on p.id = j.project_id
     where j.type <> 'retention_sweep' order by j.created_at desc limit $1`, [limit],
  )).rows;
}

const jobOrNull = (rows: Array<JobRow | { id: null }>): JobRow | null => {
  const row = rows[0];
  return row && row.id ? (row as JobRow) : null;
};

export async function claimJob(q: Queryable, jobId: string, worker: string, leaseSeconds: number): Promise<JobRow | null> {
  return jobOrNull((await q.query<JobRow>('select * from public.claim_job($1, $2, $3)', [jobId, worker, leaseSeconds])).rows);
}

export async function claimNextJob(q: Queryable, worker: string, leaseSeconds: number, types: JobType[] | null = null): Promise<JobRow | null> {
  return jobOrNull((await q.query<JobRow>('select * from public.claim_next_job($1, $2, $3::text[])', [worker, leaseSeconds, types])).rows);
}

export async function heartbeatJob(q: Queryable, jobId: string, worker: string, leaseSeconds: number, progress: number | null, stage: string | null): Promise<'ok' | 'cancel' | 'lost'> {
  const { rows } = await q.query<{ r: 'ok' | 'cancel' | 'lost' }>('select public.heartbeat_job($1, $2, $3, $4, $5) as r', [jobId, worker, leaseSeconds, progress, stage]);
  return rows[0]!.r;
}

export async function completeJob(q: Queryable, jobId: string, worker: string, result: unknown, chargedCredits: number): Promise<boolean> {
  const { rows } = await q.query<{ ok: boolean }>('select public.complete_job($1, $2, $3::jsonb, $4) as ok', [jobId, worker, json(result), chargedCredits]);
  return Boolean(rows[0]?.ok);
}

export async function failJob(q: Queryable, jobId: string, worker: string, code: string, message: string, retryable: boolean, retryDelaySeconds: number): Promise<'retry_pending' | 'failed' | 'lost'> {
  const { rows } = await q.query<{ r: 'retry_pending' | 'failed' | 'lost' }>('select public.fail_job($1, $2, $3, $4, $5, $6) as r', [jobId, worker, code, message, retryable, retryDelaySeconds]);
  return rows[0]!.r;
}

export async function finishCanceledJob(q: Queryable, jobId: string, worker: string, chargedCredits: number): Promise<boolean> {
  const { rows } = await q.query<{ ok: boolean }>('select public.finish_canceled_job($1, $2, $3) as ok', [jobId, worker, chargedCredits]);
  return Boolean(rows[0]?.ok);
}

export async function cancelJob(q: Queryable, jobId: string): Promise<string> {
  const { rows } = await q.query<{ r: string }>('select public.cancel_job($1) as r', [jobId]);
  return rows[0]!.r;
}

export async function sweepStuckJobs(q: Queryable): Promise<number> {
  const { rows } = await q.query<{ n: number }>('select public.sweep_stuck_jobs() as n');
  return Number(rows[0]?.n ?? 0);
}

/**
 * Projects left in an in-progress status with no active job (worker lost, job swept to failed, queued job
 * canceled) are moved to `failed` (or `canceled`) so the UI never spins forever. Service-only.
 */
export async function reconcileProjectStatuses(q: Queryable, graceSeconds = 60): Promise<number> {
  const { rows } = await q.query<{ id: string }>(
    `update public.projects p set status = case when last.status = 'canceled' then 'canceled' else 'failed' end, updated_at = now()
     from (
       select distinct on (j.project_id) j.project_id, j.status from public.jobs j
       where j.project_id is not null and j.type in ('script', 'storyboard', 'media', 'render')
       order by j.project_id, j.created_at desc
     ) last
     where last.project_id = p.id
       and p.status in ('script_pending', 'storyboard_pending', 'media_pending', 'render_queued', 'rendering', 'retry_pending')
       and last.status in ('failed', 'canceled')
       and p.updated_at < now() - make_interval(secs => $1)
     returning p.id`,
    [graceSeconds],
  );
  return rows.length;
}

export async function getScenesForRevision(q: Queryable, revisionId: string): Promise<Array<{ id: string; position: number; template_id: string; scene_json: unknown; content_hash: string }>> {
  return (await q.query<{ id: string; position: number; template_id: string; scene_json: unknown; content_hash: string }>(
    'select id, position, template_id, scene_json, content_hash from public.scenes where revision_id = $1 order by position', [revisionId],
  )).rows;
}

// ---------- Credits ----------
export async function grantCredits(q: Queryable, workspaceId: string, amount: number, kind: 'grant' | 'purchase' | 'adjustment', refType: string, refId: string, idem: string): Promise<boolean> {
  const { rows } = await q.query<{ ok: boolean }>('select public.grant_credits($1, $2, $3, $4, $5, $6) as ok', [workspaceId, amount, kind, refType, refId, idem]);
  return Boolean(rows[0]?.ok);
}

export async function listLedger(q: Queryable, limit = 50): Promise<LedgerRow[]> {
  return (await q.query<LedgerRow>('select * from public.credit_ledger order by created_at desc limit $1', [limit])).rows;
}

// ---------- Assets ----------
export interface NewAsset {
  workspaceId: string;
  projectId: string | null;
  kind: AssetKind;
  storageKey: string;
  mime: string;
  size: number;
  sha256: string;
  cacheKey?: string | null;
  durationMs?: number | null;
  meta?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
  license?: Record<string, unknown>;
  expiresAt?: Date | null;
}

export async function insertAsset(q: Queryable, a: NewAsset): Promise<AssetRow> {
  return one((await q.query<AssetRow>(
    `insert into public.assets (workspace_id, project_id, kind, storage_key, mime, size, sha256, cache_key, duration_ms, meta_json, provenance_json, license_json, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13) returning *`,
    [a.workspaceId, a.projectId, a.kind, a.storageKey, a.mime, a.size, a.sha256, a.cacheKey ?? null, a.durationMs ?? null,
      json(a.meta ?? {}), json(a.provenance ?? {}), json(a.license ?? {}), a.expiresAt ?? null],
  )).rows);
}

export async function findAssetByCacheKey(q: Queryable, workspaceId: string, cacheKey: string): Promise<AssetRow | null> {
  return (await q.query<AssetRow>('select * from public.assets where workspace_id = $1 and cache_key = $2 and deleted_at is null', [workspaceId, cacheKey])).rows[0] ?? null;
}

export async function getAsset(q: Queryable, assetId: string): Promise<AssetRow> {
  return one((await q.query<AssetRow>('select * from public.assets where id = $1 and deleted_at is null', [assetId])).rows);
}

export async function linkJobArtifact(q: Queryable, jobId: string, assetId: string, role: string): Promise<void> {
  await q.query('insert into public.job_artifacts (job_id, asset_id, role) values ($1, $2, $3) on conflict do nothing', [jobId, assetId, role]);
}

export async function listJobArtifacts(q: Queryable, jobId: string): Promise<Array<AssetRow & { role: string }>> {
  return (await q.query<AssetRow & { role: string }>(
    'select a.*, ja.role from public.job_artifacts ja join public.assets a on a.id = ja.asset_id where ja.job_id = $1 and a.deleted_at is null', [jobId],
  )).rows;
}

export async function expiredAssets(q: Queryable, limit = 200): Promise<AssetRow[]> {
  return (await q.query<AssetRow>(
    `select a.* from public.assets a left join public.projects p on p.id = a.project_id
     where a.deleted_at is null and ((a.expires_at is not null and a.expires_at < now())
       or (p.deleted_at is not null and p.deleted_at < now() - interval '7 days'))
     limit $1`, [limit],
  )).rows;
}

export async function extendAssetExpiry(q: Queryable, assetId: string, expiresAt: Date): Promise<void> {
  await q.query('update public.assets set expires_at = greatest(expires_at, $2) where id = $1 and expires_at is not null', [assetId, expiresAt]);
}

export async function getAssets(q: Queryable, ids: string[]): Promise<AssetRow[]> {
  if (ids.length === 0) return [];
  return (await q.query<AssetRow>('select * from public.assets where id = any($1::uuid[]) and deleted_at is null', [ids])).rows;
}

export async function markAssetsDeleted(q: Queryable, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await q.query('update public.assets set deleted_at = now() where id = any($1::uuid[])', [ids]);
}

export async function purgeDeletedProjects(q: Queryable): Promise<number> {
  const { rows } = await q.query<{ id: string }>(
    `delete from public.projects p where p.deleted_at < now() - interval '7 days'
       and not exists (select 1 from public.assets a where a.project_id = p.id and a.deleted_at is null)
     returning id`,
  );
  return rows.length;
}

// ---------- Usage ----------
export interface NewUsage {
  workspaceId: string;
  jobId: string | null;
  provider: string;
  model: string | null;
  operation: string;
  quantity: number;
  unit: string;
  estimatedUsd: number;
  actualUsd?: number | null;
  cached?: boolean;
  providerRequestId?: string | null;
}

export async function recordUsage(q: Queryable, u: NewUsage): Promise<void> {
  await q.query(
    `insert into public.usage_events (workspace_id, job_id, provider, model, operation, quantity, unit, estimated_usd, actual_usd, cached, provider_request_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [u.workspaceId, u.jobId, u.provider, u.model, u.operation, u.quantity, u.unit, u.estimatedUsd, u.actualUsd ?? null, u.cached ?? false, u.providerRequestId ?? null],
  );
}

export async function spendSince(q: Queryable, since: Date, workspaceId: string | null): Promise<number> {
  const { rows } = await q.query<{ usd: number }>(
    `select coalesce(sum(coalesce(actual_usd, estimated_usd)), 0)::float8 as usd from public.usage_events
     where created_at >= $1 and ($2::uuid is null or workspace_id = $2) and not cached`,
    [since, workspaceId],
  );
  return Number(rows[0]?.usd ?? 0);
}

export async function listUsage(q: Queryable, limit = 100): Promise<UsageRow[]> {
  return (await q.query<UsageRow>('select * from public.usage_events order by created_at desc limit $1', [limit])).rows;
}

// ---------- Payments ----------
export async function createPayment(q: Queryable, p: { workspaceId: string; reference: string; amountMinor: number; currency: string; credits: number; packId: string }): Promise<PaymentRow> {
  return one((await q.query<PaymentRow>(
    `insert into public.payments (workspace_id, provider, reference, amount_minor, currency, credits, pack_id)
     values ($1, 'paystack', $2, $3, $4, $5, $6) returning *`,
    [p.workspaceId, p.reference, p.amountMinor, p.currency, p.credits, p.packId],
  )).rows);
}

export type FulfillOutcome = 'duplicate' | 'unknown_reference' | 'already_fulfilled' | 'mismatch' | 'fulfilled';

export async function fulfillPayment(q: Queryable, e: { eventId: string; eventType: string; payloadHash: string; reference: string; externalId: string; amountMinor: number; currency: string }): Promise<FulfillOutcome> {
  const { rows } = await q.query<{ r: FulfillOutcome }>(
    `select public.fulfill_payment('paystack', $1, $2, $3, $4, $5, $6, $7) as r`,
    [e.eventId, e.eventType, e.payloadHash, e.reference, e.externalId, e.amountMinor, e.currency],
  );
  return rows[0]!.r;
}

export async function hasSuccessfulPayment(q: Queryable, workspaceId: string): Promise<boolean> {
  const { rows } = await q.query<{ ok: boolean }>(`select exists (select 1 from public.payments where workspace_id = $1 and status = 'success') as ok`, [workspaceId]);
  return Boolean(rows[0]?.ok);
}

export async function listPayments(q: Queryable, limit = 20): Promise<PaymentRow[]> {
  return (await q.query<PaymentRow>('select * from public.payments order by created_at desc limit $1', [limit])).rows;
}

// ---------- Profile (user-scoped: run inside withUser) ----------
export async function getMyProfile(tx: Queryable): Promise<ProfileRow> {
  return one((await tx.query<ProfileRow>('select * from public.profiles where id = auth.uid()')).rows);
}

export async function updateMyProfile(tx: Queryable, p: { displayName?: string; avatarMode?: AvatarMode; avatarAssetId?: string | null }): Promise<ProfileRow> {
  await tx.query('select public.update_my_profile($1, $2, $3)', [p.displayName ?? null, p.avatarMode ?? null, p.avatarAssetId ?? null]);
  return getMyProfile(tx);
}

export async function setAccountDeletion(tx: Queryable, requested: boolean, reason?: string | null, note?: string | null): Promise<Date | null> {
  const { rows } = await tx.query<{ at: Date | null }>('select public.set_account_deletion($1, $2, $3) as at', [requested, reason ?? null, note ?? null]);
  return rows[0]?.at ?? null;
}

export async function listDeletionRequests(q: Queryable, limit = 50): Promise<Array<{ id: string; email: string | null; display_name: string | null; deletion_requested_at: Date; deletion_reason: string | null; deletion_note: string | null }>> {
  return (await q.query<{ id: string; email: string | null; display_name: string | null; deletion_requested_at: Date; deletion_reason: string | null; deletion_note: string | null }>(
    `select p.id, u.email, p.display_name, p.deletion_requested_at, p.deletion_reason, p.deletion_note from public.profiles p join auth.users u on u.id = p.id
     where p.deletion_requested_at is not null order by p.deletion_requested_at limit $1`, [limit])).rows;
}

// ---------- YouTube connections ----------
const YOUTUBE_COLUMNS = 'workspace_id, channel_id, channel_title, channel_thumbnail_url, scopes, connected_at, updated_at';

/** User-scoped read (RLS + column grants): never selects the token. */
export async function getYoutubeConnection(tx: Queryable): Promise<YoutubeConnectionRow | null> {
  return (await tx.query<YoutubeConnectionRow>(`select ${YOUTUBE_COLUMNS} from public.youtube_connections limit 1`)).rows[0] ?? null;
}

/** Service-side (owner connection): stores an already-encrypted refresh token for a verified workspace. */
export async function upsertYoutubeConnection(q: Queryable, c: { workspaceId: string; userId: string; channelId: string; channelTitle: string; channelThumbnailUrl: string | null; scopes: string[]; refreshTokenCiphertext: string }): Promise<YoutubeConnectionRow> {
  return one((await q.query<YoutubeConnectionRow>(
    `insert into public.youtube_connections (workspace_id, connected_by, channel_id, channel_title, channel_thumbnail_url, scopes, refresh_token_ciphertext)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (workspace_id) do update set connected_by = excluded.connected_by, channel_id = excluded.channel_id,
       channel_title = excluded.channel_title, channel_thumbnail_url = excluded.channel_thumbnail_url, scopes = excluded.scopes,
       refresh_token_ciphertext = excluded.refresh_token_ciphertext, connected_at = now(), updated_at = now()
     returning ${YOUTUBE_COLUMNS}`,
    [c.workspaceId, c.userId, c.channelId, c.channelTitle, c.channelThumbnailUrl, c.scopes, c.refreshTokenCiphertext],
  )).rows);
}

/** Service-side: removes the connection and returns the token ciphertext so the caller can revoke it at Google. */
export async function deleteYoutubeConnection(q: Queryable, workspaceId: string): Promise<string | null> {
  const { rows } = await q.query<{ refresh_token_ciphertext: string }>(
    'delete from public.youtube_connections where workspace_id = $1 returning refresh_token_ciphertext', [workspaceId]);
  return rows[0]?.refresh_token_ciphertext ?? null;
}

// ---------- Rate limiting + audit ----------
export async function checkRateLimit(q: Queryable, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { rows } = await q.query<{ ok: boolean }>('select public.check_rate_limit($1, $2, $3) as ok', [key, limit, windowSeconds]);
  return Boolean(rows[0]?.ok);
}

export async function audit(q: Queryable, e: { actorId: string | null; workspaceId: string | null; action: string; targetId?: string | null; metadata?: Record<string, unknown> }): Promise<void> {
  await q.query('insert into public.audit_events (actor_id, workspace_id, action, target_id, metadata) values ($1, $2, $3, $4, $5::jsonb)',
    [e.actorId, e.workspaceId, e.action, e.targetId ?? null, json(e.metadata ?? {})]);
}
