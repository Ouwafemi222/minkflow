import { DURATION_LIMITS, quoteMicro, storyboardSeconds } from '@minkflow/contracts';
import { loadLatestDocument } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed, idempotencyKey } from '@/lib/api';
import { enqueueProjectJob } from '@/lib/jobs';

const Step = z.enum(['media', 'preview', 'render']);

/** POST /api/projects/:id/{media|preview|render} — quote, reserve credits, enqueue. */
export const POST = authed<{ id: string; step: string }>(
  async (ctx, params) => {
    const projectId = z.uuid().parse(params.id);
    const step = Step.parse(params.step);
    const { project, doc } = await ctx.asUser((tx) => loadLatestDocument(tx, projectId));
    const scenes = doc.storyboard?.scenes ?? [];
    if (scenes.length === 0) throw new AppError('INVALID_STATE', 'Generate a storyboard first');
    const seconds = storyboardSeconds(scenes);
    if (step === 'media') {
      const uncachedChars = scenes.filter((s) => !s.voiceAssetId).reduce((n, s) => n + s.narration.length, 0);
      return enqueueProjectJob(ctx, { projectId, type: 'media', credits: quoteMicro({ type: 'media', uncachedChars }), idempotencyKey: idempotencyKey(ctx.req) });
    }
    if (scenes.some((s) => !s.voiceAssetId)) throw new AppError('INVALID_STATE', 'Generate the voiceover for every scene first');
    if (seconds > DURATION_LIMITS.maxTotalSeconds) throw new AppError('VALIDATION_FAILED', `Videos can be at most ${Math.floor(DURATION_LIMITS.maxTotalSeconds / 60)} minutes. Shorten or remove scenes.`);
    return enqueueProjectJob(ctx, {
      projectId,
      type: step,
      credits: quoteMicro({ type: step, seconds }),
      idempotencyKey: idempotencyKey(ctx.req),
      revisionId: project.current_revision_id,
    });
  },
  { rateLimit: { key: 'generate', perMinute: 10 } },
);
