import { quoteMicro, STORYBOARD_EDITABLE } from '@minkflow/contracts';
import { loadLatestDocument } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed, idempotencyKey, readJson } from '@/lib/api';
import { enqueueProjectJob } from '@/lib/jobs';

export const POST = authed<{ id: string; sceneId: string }>(
  async (ctx, { id, sceneId }) => {
    const projectId = z.uuid().parse(id);
    const sid = z.uuid().parse(sceneId);
    const { instruction } = await readJson(ctx.req, z.object({ instruction: z.string().trim().max(300).nullable().default(null) }));
    const { project, doc } = await ctx.asUser((tx) => loadLatestDocument(tx, projectId));
    if (!STORYBOARD_EDITABLE.includes(project.status)) throw new AppError('INVALID_STATE', 'Wait for the current step to finish');
    if (!doc.storyboard?.scenes.some((s) => s.id === sid)) throw new AppError('NOT_FOUND', 'Scene not found');
    return enqueueProjectJob(ctx, { projectId, type: 'scene_regenerate', input: { sceneId: sid, instruction }, credits: quoteMicro({ type: 'scene_regenerate' }), idempotencyKey: idempotencyKey(ctx.req) });
  },
  { rateLimit: { key: 'generate', perMinute: 10 } },
);
