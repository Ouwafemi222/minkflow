import { statusesThatCanReach } from '@minkflow/contracts';
import { commitDocument, loadLatestDocument, renameProject, setProjectStatus, softDeleteProject } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';
import { loadProjectView } from '@/lib/project-view';
import { isAllowedVoice } from '@/lib/voices';

type P = { id: string };

export const GET = authed<P>(async (ctx, { id }) => ctx.asUser((tx) => loadProjectView(tx, z.uuid().parse(id))));

export const PATCH = authed<P>(async (ctx, { id }) => {
  const projectId = z.uuid().parse(id);
  const body = await readJson(ctx.req, z.object({ title: z.string().trim().min(1).max(120).optional(), voiceId: z.string().min(1).max(64).optional() }));
  if (!body.title && !body.voiceId) throw new AppError('VALIDATION_FAILED', 'Nothing to update');
  if (body.voiceId) {
    if (!isAllowedVoice(body.voiceId)) throw new AppError('VALIDATION_FAILED', 'That voice is not available.');
    await ctx.asUser(async (tx) => {
      const { project, doc } = await loadLatestDocument(tx, projectId);
      if (doc.input.voiceId === body.voiceId) return;
      const next = structuredClone(doc);
      next.input = { ...next.input, voiceId: body.voiceId! };
      if (next.storyboard) next.storyboard.scenes = next.storyboard.scenes.map((s) => ({ ...s, voiceAssetId: undefined, captions: [] }));
      await commitDocument(tx, projectId, project.version, next, 'user');
      if (['media_ready', 'preview_ready', 'completed', 'failed'].includes(project.status)) {
        await setProjectStatus(tx, projectId, statusesThatCanReach('storyboard_ready'), 'storyboard_ready');
      }
    });
    return ctx.asUser((tx) => loadProjectView(tx, projectId));
  }
  const project = await ctx.asUser((tx) => renameProject(tx, projectId, body.title!));
  return { project: { id: project.id, title: project.title } };
});

export const DELETE = authed<P>(async (ctx, { id }) => {
  await ctx.asUser((tx) => softDeleteProject(tx, z.uuid().parse(id)));
  return { ok: true };
});
