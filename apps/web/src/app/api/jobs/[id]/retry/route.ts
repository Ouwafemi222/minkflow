import { quoteMicro, storyboardSeconds } from '@minkflow/contracts';
import { getJob, loadLatestDocument } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed } from '@/lib/api';
import { enqueueProjectJob } from '@/lib/jobs';

/** Re-runs a failed or canceled job as a new job (fresh reservation). Idempotent per original job. */
export const POST = authed<{ id: string }>(
  async (ctx, { id }) => {
    const original = await ctx.asUser((tx) => getJob(tx, z.uuid().parse(id)));
    if (!['failed', 'canceled'].includes(original.status)) throw new AppError('INVALID_STATE', 'Only failed or canceled jobs can be retried');
    if (!original.project_id || original.type === 'noop' || original.type === 'retention_sweep') throw new AppError('INVALID_STATE');
    const { doc } = await ctx.asUser((tx) => loadLatestDocument(tx, original.project_id!));
    const scenes = doc.storyboard?.scenes ?? [];
    const credits = quoteMicro({
      type: original.type,
      seconds: storyboardSeconds(scenes),
      uncachedChars: scenes.filter((s) => !s.voiceAssetId).reduce((n, s) => n + s.narration.length, 0),
    });
    return enqueueProjectJob(ctx, {
      projectId: original.project_id,
      type: original.type,
      input: original.input_json,
      credits,
      idempotencyKey: `retry-${original.id}-${original.attempt_count}`,
    });
  },
  { rateLimit: { key: 'generate', perMinute: 10 } },
);
