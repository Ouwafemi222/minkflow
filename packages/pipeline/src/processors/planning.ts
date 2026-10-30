import { planScript, planStoryboard, regenerateScene } from '@minkflow/ai';
import { assembleScene, estimateNarrationMs, isScriptApproved, SceneSchema, StoryboardSceneDraftSchema, type Scene } from '@minkflow/contracts';
import { applyToLatestRevision, loadLatestDocument } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import type { Processor } from '../types';
import { assertSpendAllowed, recordUsages } from '../usage';

function projectIdOf(projectId: string | null): string {
  if (!projectId) throw new AppError('VALIDATION_FAILED', 'Job has no project');
  return projectId;
}

export const processScript: Processor = async (ctx) => {
  const projectId = projectIdOf(ctx.job.project_id);
  const { doc } = await loadLatestDocument(ctx.deps.db, projectId);
  ctx.setProgress(0.1, 'writing_script');
  await assertSpendAllowed(ctx);
  const { script, usages } = await planScript(ctx.deps.llm, doc.input);
  await recordUsages(ctx, usages);
  await ctx.checkpoint();
  ctx.setProgress(0.9, 'saving');
  await applyToLatestRevision(ctx.deps.db, projectId, (d) => ({ ...d, script: { ...script, approvedAt: null, claimsAcknowledged: false }, storyboard: null }));
  return { result: { title: script.title, sections: script.sections.length, claims: script.claims.length }, chargedMicro: ctx.job.reserved_credits };
};

export const processStoryboard: Processor = async (ctx) => {
  const projectId = projectIdOf(ctx.job.project_id);
  const { doc } = await loadLatestDocument(ctx.deps.db, projectId);
  if (!doc.script || !isScriptApproved(doc.script)) throw new AppError('INVALID_STATE', 'Approve the script before generating a storyboard');
  const approvedAt = doc.script.approvedAt;
  ctx.setProgress(0.1, 'planning_scenes');
  await assertSpendAllowed(ctx);
  const { storyboard, usages } = await planStoryboard(ctx.deps.llm, doc.script, doc.input);
  await recordUsages(ctx, usages);
  await ctx.checkpoint();
  const scenes: Scene[] = storyboard.scenes.map((draft) => assembleScene(draft, null, { fallbackDurationMs: estimateNarrationMs(draft.narration) }));
  ctx.setProgress(0.9, 'saving');
  await applyToLatestRevision(ctx.deps.db, projectId, (d) => {
    if (d.script?.approvedAt !== approvedAt) throw new AppError('INVALID_STATE', 'The script changed while the storyboard was generating');
    return { ...d, storyboard: { scenes } };
  });
  return { result: { scenes: scenes.length }, chargedMicro: ctx.job.reserved_credits };
};

const RegenerateInputSchema = z.object({ sceneId: z.uuid(), instruction: z.string().trim().max(300).nullable().default(null) });

export const processSceneRegenerate: Processor = async (ctx) => {
  const projectId = projectIdOf(ctx.job.project_id);
  const input = RegenerateInputSchema.parse(ctx.job.input_json);
  const { doc } = await loadLatestDocument(ctx.deps.db, projectId);
  const scenes = doc.storyboard?.scenes ?? [];
  const index = scenes.findIndex((s) => s.id === input.sceneId);
  const current = scenes[index];
  if (!current) throw new AppError('NOT_FOUND', 'Scene not found');
  ctx.setProgress(0.2, 'regenerating_scene');
  await assertSpendAllowed(ctx);
  const { scene: draft, usages } = await regenerateScene(
    ctx.deps.llm,
    StoryboardSceneDraftSchema.parse({ template: current.template, narration: current.narration, visual: current.visual, transition: current.transition }),
    { before: scenes[index - 1]?.narration ?? null, after: scenes[index + 1]?.narration ?? null },
    input.instruction,
  );
  await recordUsages(ctx, usages);
  await ctx.checkpoint();
  await applyToLatestRevision(ctx.deps.db, projectId, (d) => {
    const list = d.storyboard?.scenes ?? [];
    const i = list.findIndex((s) => s.id === input.sceneId);
    const latest = list[i];
    if (!latest || !d.storyboard) throw new AppError('NOT_FOUND', 'Scene was deleted');
    // Narration (and therefore voice, captions, duration) is preserved; only the visual design changes.
    list[i] = SceneSchema.parse({ ...latest, template: draft.template, visual: draft.visual, transition: draft.transition });
    return d;
  });
  return { result: { sceneId: input.sceneId, template: draft.template }, chargedMicro: ctx.job.reserved_credits };
};
