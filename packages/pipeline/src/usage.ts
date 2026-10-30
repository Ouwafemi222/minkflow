import type { Usage } from '@minkflow/ai';
import { recordUsage, spendSince } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import type { JobContext } from './types';

function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Blocks new provider calls once the platform or workspace daily estimated spend cap is reached. */
export async function assertSpendAllowed(ctx: JobContext): Promise<void> {
  const { db, config } = ctx.deps;
  const since = startOfUtcDay();
  const platform = await spendSince(db, since, null);
  if (platform >= config.platformDailyCapUsd) {
    ctx.log.warn('platform spend cap reached', { platform, cap: config.platformDailyCapUsd });
    throw new AppError('SPEND_CAP_REACHED');
  }
  const workspace = await spendSince(db, since, ctx.job.workspace_id);
  if (workspace >= config.workspaceDailyCapUsd) throw new AppError('SPEND_CAP_REACHED', 'Daily generation limit reached for this workspace. Try again tomorrow.');
}

export async function recordUsages(ctx: JobContext, usages: Usage[], cached = false): Promise<void> {
  for (const u of usages) {
    await recordUsage(ctx.deps.db, {
      workspaceId: ctx.job.workspace_id,
      jobId: ctx.job.id,
      provider: u.provider,
      model: u.model,
      operation: u.operation,
      quantity: u.quantity,
      unit: u.unit,
      estimatedUsd: cached ? 0 : u.estimatedUsd,
      cached,
      providerRequestId: u.providerRequestId,
    });
  }
}
