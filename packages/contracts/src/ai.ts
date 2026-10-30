import { z } from 'zod';
import { DURATION_LIMITS, TEMPLATE_IDS, TRANSITIONS, VisualSchemas } from './scene';

export const AUDIENCES = ['general', 'beginners', 'students', 'professionals'] as const;
export const TONES = ['friendly', 'energetic', 'calm', 'authoritative', 'storytelling'] as const;
export const DURATION_PRESETS_SECONDS = [60, 120, 180, 300] as const;

export const ProjectInputSchema = z
  .object({
    mode: z.enum(['topic', 'script']),
    topic: z.string().trim().max(300).optional(),
    script: z.string().trim().max(9000).optional(),
    audience: z.enum(AUDIENCES),
    tone: z.enum(TONES),
    targetSeconds: z.number().int().min(DURATION_LIMITS.minTotalSeconds).max(300),
    language: z.literal('en'),
    aspectRatio: z.literal('16:9'),
    voiceId: z.string().min(1).max(64),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'topic' && (!value.topic || value.topic.length < 3)) {
      ctx.addIssue({ code: 'custom', path: ['topic'], message: 'Enter a topic (at least 3 characters).' });
    }
    if (value.mode === 'script' && (!value.script || value.script.length < 40)) {
      ctx.addIssue({ code: 'custom', path: ['script'], message: 'Paste a script (at least 40 characters).' });
    }
  });
export type ProjectInput = z.infer<typeof ProjectInputSchema>;

export const SCRIPT_SECTION_KINDS = ['hook', 'body', 'example', 'outro'] as const;

export const ScriptSchema = z.object({
  title: z.string().trim().min(3).max(100),
  sections: z
    .array(
      z.object({
        kind: z.enum(SCRIPT_SECTION_KINDS),
        heading: z.string().trim().min(1).max(80),
        text: z.string().trim().min(10).max(2500),
      }),
    )
    .min(2)
    .max(20),
  claims: z
    .array(
      z.object({
        text: z.string().trim().min(3).max(300),
        sectionIndex: z.number().int().min(0),
        reason: z.string().trim().min(3).max(200),
      }),
    )
    .max(30),
});
export type Script = z.infer<typeof ScriptSchema>;

export const ApprovedScriptSchema = ScriptSchema.extend({
  approvedAt: z.iso.datetime(),
  claimsAcknowledged: z.literal(true),
});
export type ApprovedScript = z.infer<typeof ApprovedScriptSchema>;

/** Scene shape the LLM is allowed to produce. IDs, timing and captions are assigned server-side. */
const draftVariant = <T extends (typeof TEMPLATE_IDS)[number]>(template: T) =>
  z.object({
    template: z.literal(template),
    narration: z.string().trim().min(5).max(600),
    visual: VisualSchemas[template],
    transition: z.enum(TRANSITIONS).default('fade'),
  });

export const StoryboardSceneDraftSchema = z.discriminatedUnion('template', [
  draftVariant('title_reveal'),
  draftVariant('stat_comparison'),
  draftVariant('timeline'),
  draftVariant('process_steps'),
  draftVariant('icon_grid'),
  draftVariant('quote_focus'),
  draftVariant('bar_chart'),
  draftVariant('line_chart'),
  draftVariant('before_after'),
  draftVariant('closing_cta'),
]);
export type StoryboardSceneDraft = z.infer<typeof StoryboardSceneDraftSchema>;

export const StoryboardDraftSchema = z.object({
  scenes: z.array(StoryboardSceneDraftSchema).min(2).max(DURATION_LIMITS.maxScenes),
});
export type StoryboardDraft = z.infer<typeof StoryboardDraftSchema>;

export function scriptToPlainText(script: Pick<Script, 'sections'>): string {
  return script.sections.map((s) => s.text).join('\n\n');
}
