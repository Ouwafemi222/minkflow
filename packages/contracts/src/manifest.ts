import { z } from 'zod';
import { DURATION_LIMITS, SceneSchema, ThemeSchema, VIDEO } from './scene';

export const RenderSceneSchema = z.object({
  scene: SceneSchema,
  audio: z.object({ src: z.string().min(1), durationMs: z.number().int().positive() }).nullable(),
  logoSrc: z.string().min(1).nullable().default(null),
});
export type RenderScene = z.infer<typeof RenderSceneSchema>;

export const RenderManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: z.uuid(),
    revisionId: z.uuid(),
    fps: z.literal(VIDEO.fps),
    width: z.literal(VIDEO.width),
    height: z.literal(VIDEO.height),
    theme: ThemeSchema,
    captionsEnabled: z.boolean(),
    watermark: z.string().max(60).nullable(),
    scenes: z.array(RenderSceneSchema).min(1).max(DURATION_LIMITS.maxScenes),
  })
  .superRefine((manifest, ctx) => {
    const frames = manifest.scenes.reduce((n, s) => n + s.scene.durationFrames, 0);
    if (frames > DURATION_LIMITS.maxTotalSeconds * manifest.fps) {
      ctx.addIssue({ code: 'custom', message: `Video exceeds ${DURATION_LIMITS.maxTotalSeconds}s`, path: ['scenes'] });
    }
    const ids = new Set(manifest.scenes.map((s) => s.scene.id));
    if (ids.size !== manifest.scenes.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate scene ids', path: ['scenes'] });
    }
    manifest.scenes.forEach((s, i) => {
      if (!s.audio) return;
      const audioFrames = Math.ceil((s.audio.durationMs / 1000) * manifest.fps);
      if (audioFrames > s.scene.durationFrames) {
        ctx.addIssue({ code: 'custom', message: 'Scene shorter than its narration (speech would clip)', path: ['scenes', i] });
      }
      const last = s.scene.captions.at(-1);
      if (last && last.endMs > s.audio.durationMs + 50) {
        ctx.addIssue({ code: 'custom', message: 'Captions extend beyond narration audio', path: ['scenes', i, 'scene', 'captions'] });
      }
    });
  });
export type RenderManifest = z.infer<typeof RenderManifestSchema>;

export function manifestDurationFrames(manifest: Pick<RenderManifest, 'scenes'>): number {
  return manifest.scenes.reduce((n, s) => n + s.scene.durationFrames, 0);
}
