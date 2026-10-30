import { BrandKitSchema, ClientStoryboardSchema, mergeClientStoryboard, ScriptSchema, statusesThatCanReach, STORYBOARD_EDITABLE } from '@minkflow/contracts';
import { commitDocument, getAsset, loadLatestDocument, setProjectStatus } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';
import { db } from '@/lib/services';

type P = { id: string };

const BodySchema = z.object({
  expectedVersion: z.number().int().min(0),
  script: ScriptSchema.pick({ title: true, sections: true }).optional(),
  storyboard: ClientStoryboardSchema.optional(),
  brand: BrandKitSchema.optional(),
});

/** Editor autosave. Optimistic concurrency: a stale `expectedVersion` returns 409 REVISION_CONFLICT. */
export const PUT = authed<P>(
  async (ctx, { id }) => {
    const projectId = z.uuid().parse(id);
    const body = await readJson(ctx.req, BodySchema);
    const result = await ctx.asUser(async (tx) => {
      const { project, doc } = await loadLatestDocument(tx, projectId);
      if (project.version !== body.expectedVersion) throw new AppError('REVISION_CONFLICT');
      const next = structuredClone(doc);
      if (body.script) {
        if (!['script_ready', 'storyboard_ready', 'failed', 'canceled'].includes(project.status) || !doc.script) throw new AppError('INVALID_STATE', 'The script cannot be edited right now');
        const changed = JSON.stringify(body.script) !== JSON.stringify({ title: doc.script.title, sections: doc.script.sections });
        // Editing an approved script withdraws approval; claims must be re-acknowledged.
        next.script = { ...doc.script, ...body.script, ...(changed ? { approvedAt: null, claimsAcknowledged: false } : {}) };
      }
      if (body.storyboard) {
        if (!STORYBOARD_EDITABLE.includes(project.status) || !doc.storyboard) throw new AppError('INVALID_STATE', 'The storyboard cannot be edited right now');
        try {
          next.storyboard = { scenes: mergeClientStoryboard(doc.storyboard.scenes, body.storyboard) };
        } catch (error) {
          throw new AppError('VALIDATION_FAILED', error instanceof Error ? error.message.slice(0, 300) : 'Invalid storyboard');
        }
      }
      if (body.brand) {
        if (body.brand.logoAssetId && body.brand.logoAssetId !== doc.brand.logoAssetId) {
          const logo = await getAsset(tx, body.brand.logoAssetId);
          if (logo.kind !== 'logo') throw new AppError('VALIDATION_FAILED', 'Not a logo');
        }
        next.brand = body.brand;
      }
      const revision = await commitDocument(tx, projectId, project.version, next, 'user');
      return { version: revision.version, status: project.status, storyboard: next.storyboard };
    });
    // Narration edits invalidate generated media: move back to storyboard_ready so the next step is "Generate voice".
    let status = result.status;
    if (result.storyboard?.scenes.some((s) => !s.voiceAssetId) && ['media_ready', 'preview_ready', 'completed', 'failed', 'canceled'].includes(status)) {
      if (await setProjectStatus(db(), projectId, statusesThatCanReach('storyboard_ready'), 'storyboard_ready')) status = 'storyboard_ready';
    }
    return { version: result.version, status, scenes: result.storyboard?.scenes ?? null };
  },
  { rateLimit: { key: 'autosave', perMinute: 120 } },
);
