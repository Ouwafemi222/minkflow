import { quoteMicro } from '@minkflow/contracts';
import { z } from 'zod';
import { authed, idempotencyKey } from '@/lib/api';
import { enqueueProjectJob } from '@/lib/jobs';

export const POST = authed<{ id: string }>(
  async (ctx, { id }) =>
    enqueueProjectJob(ctx, { projectId: z.uuid().parse(id), type: 'script', credits: quoteMicro({ type: 'script' }), idempotencyKey: idempotencyKey(ctx.req) }),
  { rateLimit: { key: 'generate', perMinute: 10 } },
);
