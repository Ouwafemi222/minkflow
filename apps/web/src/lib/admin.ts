import 'server-only';
import { listDeletionRequests, spendSince } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import type { ApiContext } from './api';
import { isAdminEmail } from './env';
import { db } from './services';

export function assertAdmin(ctx: ApiContext): void {
  if (!isAdminEmail(ctx.session.email)) throw new AppError('NOT_FOUND');
}

export async function adminOverview() {
  const q = db();
  const dayStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const [spendToday, jobStats, failed, stuck, topSpend, webhooks, workspaces] = await Promise.all([
    spendSince(q, dayStart, null),
    q.query<{ status: string; n: number }>(`select status, count(*)::int as n from public.jobs where created_at > now() - interval '24 hours' group by status`),
    q.query<{ id: string; type: string; error_code: string | null; error_message: string | null; attempt_count: number; workspace_id: string; finished_at: Date }>(
      `select id, type, error_code, error_message, attempt_count, workspace_id, finished_at from public.jobs where status = 'failed' order by finished_at desc nulls last limit 25`,
    ),
    q.query<{ id: string; type: string; locked_by: string | null; locked_until: Date | null }>(
      `select id, type, locked_by, locked_until from public.jobs where status = 'running' and locked_until < now() limit 25`,
    ),
    q.query<{ workspace_id: string; usd: number }>(
      `select workspace_id, sum(coalesce(actual_usd, estimated_usd))::float8 as usd from public.usage_events where created_at >= $1 and not cached group by workspace_id order by usd desc limit 10`,
      [dayStart],
    ),
    q.query<{ provider: string; event_type: string; processed_at: Date | null; created_at: Date }>(
      `select provider, event_type, processed_at, created_at from public.webhook_events order by created_at desc limit 15`,
    ),
    q.query<{ n: number }>(`select count(*)::int as n from public.workspaces`),
  ]);
  return {
    spendTodayUsd: spendToday,
    jobsLast24h: Object.fromEntries(jobStats.rows.map((r) => [r.status, r.n])),
    failedJobs: failed.rows,
    stuckJobs: stuck.rows,
    topSpendToday: topSpend.rows,
    webhooks: webhooks.rows,
    workspaces: workspaces.rows[0]?.n ?? 0,
    deletionRequests: await listDeletionRequests(q, 50),
  };
}
