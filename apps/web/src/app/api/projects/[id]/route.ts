import { renameProject, softDeleteProject } from '@minkflow/db';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';
import { loadProjectView } from '@/lib/project-view';

type P = { id: string };

export const GET = authed<P>(async (ctx, { id }) => ctx.asUser((tx) => loadProjectView(tx, z.uuid().parse(id))));

export const PATCH = authed<P>(async (ctx, { id }) => {
  const { title } = await readJson(ctx.req, z.object({ title: z.string().trim().min(1).max(120) }));
  const project = await ctx.asUser((tx) => renameProject(tx, z.uuid().parse(id), title));
  return { project: { id: project.id, title: project.title } };
});

export const DELETE = authed<P>(async (ctx, { id }) => {
  await ctx.asUser((tx) => softDeleteProject(tx, z.uuid().parse(id)));
  return { ok: true };
});
