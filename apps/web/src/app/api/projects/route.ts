import { BrandKitSchema, DEFAULT_BRAND_KIT, ProjectInputSchema, THEME_PRESETS, type ProjectDocument } from '@minkflow/contracts';
import { commitDocument, createProject, listProjects } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';
import { isAllowedVoice } from '@/lib/voices';

export const GET = authed(async (ctx) => {
  const projects = await ctx.asUser((tx) => listProjects(tx));
  return { projects: projects.map((p) => ({ id: p.id, title: p.title, status: p.status, updatedAt: p.updated_at })) };
});

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  input: ProjectInputSchema,
  themePreset: z.enum(Object.keys(THEME_PRESETS) as [keyof typeof THEME_PRESETS, ...Array<keyof typeof THEME_PRESETS>]).default('minkflow_dark'),
  captionsEnabled: z.boolean().default(true),
});

export const POST = authed(
  async (ctx) => {
    const body = await readJson(ctx.req, CreateSchema);
    if (!isAllowedVoice(body.input.voiceId)) throw new AppError('VALIDATION_FAILED', 'Choose one of the available voices');
    const ws = await ctx.workspace();
    const project = await ctx.asUser(async (tx) => {
      const p = await createProject(tx, ws.id, body.title);
      const doc: ProjectDocument = {
        input: body.input,
        script: null,
        storyboard: null,
        brand: BrandKitSchema.parse({ ...DEFAULT_BRAND_KIT, theme: THEME_PRESETS[body.themePreset], captionsEnabled: body.captionsEnabled }),
      };
      await commitDocument(tx, p.id, 0, doc, 'user');
      return p;
    });
    return { project: { id: project.id, title: project.title } };
  },
  { rateLimit: { key: 'project-create', perMinute: 10 } },
);
