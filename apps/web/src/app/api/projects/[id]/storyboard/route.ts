import { isScriptApproved, quoteMicro } from '@minkflow/contracts';
import { loadLatestDocument } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed, idempotencyKey } from '@/lib/api';
import { enqueueProjectJob } from '@/lib/jobs';

export const POST = authed<{ id: string }>(
  async (ctx, { id }) => {
    const projectId = z.uuid().parse(id);
    const { doc } = await ctx.asUser((tx) => loadLatestDocument(tx, projectId));
    if (!isScriptApproved(doc.script)) throw new AppError('INVALID_STATE', 'Approve the script (and acknowledge flagged claims) first');
    return enqueueProjectJob(ctx, { projectId, type: 'storyboard', credits: quoteMicro({ type: 'storyboard' }), idempotencyKey: idempotencyKey(ctx.req) });
  },
  { rateLimit: { key: 'generate', perMinute: 10 } },
);
