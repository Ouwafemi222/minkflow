import { z } from 'zod';
import { ICON_IDS } from './icons';

export const VIDEO = { width: 1920, height: 1080, fps: 30, minSceneFrames: 60, maxSceneFrames: 30 * 60 } as const;
export const DURATION_LIMITS = { minTotalSeconds: 15, maxTotalSeconds: 5 * 60 + 15, maxScenes: 40 } as const;

export const TEMPLATE_IDS = [
  'title_reveal',
  'stat_comparison',
  'timeline',
  'process_steps',
  'icon_grid',
  'quote_focus',
  'bar_chart',
  'line_chart',
  'before_after',
  'closing_cta',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const TRANSITIONS = ['none', 'fade', 'slide_left', 'slide_up', 'zoom'] as const;
export const TransitionSchema = z.enum(TRANSITIONS);
export type Transition = z.infer<typeof TransitionSchema>;

const text = (max: number, min = 1) => z.string().trim().min(min).max(max);
const IconSchema = z.enum(ICON_IDS);
const finite = z.number().finite();

export const VisualSchemas = {
  title_reveal: z.object({ title: text(80), subtitle: text(120).optional(), icon: IconSchema.optional() }),
  stat_comparison: z.object({
    heading: text(60).optional(),
    items: z
      .array(z.object({ label: text(40), value: finite, prefix: text(4).optional(), suffix: text(10).optional() }))
      .min(2)
      .max(4),
  }),
  timeline: z.object({
    heading: text(60).optional(),
    events: z.array(z.object({ label: text(24), title: text(60) })).min(2).max(6),
  }),
  process_steps: z.object({
    heading: text(60).optional(),
    steps: z
      .array(z.object({ title: text(40), description: text(90).optional(), icon: IconSchema.optional() }))
      .min(2)
      .max(5),
  }),
  icon_grid: z.object({
    heading: text(60).optional(),
    items: z.array(z.object({ icon: IconSchema, label: text(30) })).min(2).max(6),
  }),
  quote_focus: z.object({ quote: text(200), attribution: text(60).optional() }),
  bar_chart: z.object({
    title: text(60),
    unit: text(10).optional(),
    bars: z.array(z.object({ label: text(20), value: finite.min(0) })).min(2).max(8),
  }),
  line_chart: z.object({
    title: text(60),
    unit: text(10).optional(),
    points: z.array(z.object({ label: text(12), value: finite })).min(3).max(12),
  }),
  before_after: z.object({
    before: z.object({ title: text(30), points: z.array(text(50)).min(1).max(4) }),
    after: z.object({ title: text(30), points: z.array(text(50)).min(1).max(4) }),
  }),
  closing_cta: z.object({ headline: text(80), cta: text(40), handle: text(40).optional() }),
} as const satisfies Record<TemplateId, z.ZodTypeAny>;

export type VisualFor<T extends TemplateId> = z.infer<(typeof VisualSchemas)[T]>;

export const CaptionTokenSchema = z
  .object({ text: z.string().min(1).max(64), startMs: z.number().int().min(0), endMs: z.number().int().min(0) })
  .refine((t) => t.endMs >= t.startMs, 'endMs must be >= startMs');
export type CaptionToken = z.infer<typeof CaptionTokenSchema>;

export const AssetRefSchema = z.object({ assetId: z.uuid(), role: z.enum(['logo', 'image']) });

const sceneBase = {
  id: z.uuid(),
  narration: text(600),
  durationFrames: z.number().int().min(VIDEO.minSceneFrames).max(VIDEO.maxSceneFrames),
  captions: z.array(CaptionTokenSchema).max(400),
  transition: TransitionSchema,
  assets: z.array(AssetRefSchema).max(4),
  voiceAssetId: z.uuid().optional(),
};

const sceneVariant = <T extends TemplateId>(template: T) =>
  z.object({ ...sceneBase, template: z.literal(template), visual: VisualSchemas[template] });

export const SceneSchema = z.discriminatedUnion('template', [
  sceneVariant('title_reveal'),
  sceneVariant('stat_comparison'),
  sceneVariant('timeline'),
  sceneVariant('process_steps'),
  sceneVariant('icon_grid'),
  sceneVariant('quote_focus'),
  sceneVariant('bar_chart'),
  sceneVariant('line_chart'),
  sceneVariant('before_after'),
  sceneVariant('closing_cta'),
]);
export type Scene = z.infer<typeof SceneSchema>;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const FONT_FAMILIES = ['Inter', 'Poppins'] as const;

export const ThemeSchema = z.object({
  background: hex,
  surface: hex,
  primary: hex,
  accent: hex,
  text: hex,
  mutedText: hex,
  fontFamily: z.enum(FONT_FAMILIES),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const THEME_PRESETS = {
  minkflow_dark: {
    background: '#0B1020',
    surface: '#171E32',
    primary: '#635BFF',
    accent: '#23D5E8',
    text: '#FFFFFF',
    mutedText: '#C3C9DA',
    fontFamily: 'Inter',
  },
  paper_light: {
    background: '#F7F9FC',
    surface: '#FFFFFF',
    primary: '#4B44E0',
    accent: '#0E8A99',
    text: '#0B1020',
    mutedText: '#475069',
    fontFamily: 'Inter',
  },
  warm_studio: {
    background: '#1C1410',
    surface: '#2A1F19',
    primary: '#F28C38',
    accent: '#FFD166',
    text: '#FFF8F0',
    mutedText: '#E6D5C3',
    fontFamily: 'Poppins',
  },
} as const satisfies Record<string, Theme>;
export type ThemePresetId = keyof typeof THEME_PRESETS;

export const BrandKitSchema = z.object({
  theme: ThemeSchema,
  captionsEnabled: z.boolean(),
  logoAssetId: z.uuid().nullable(),
});
export type BrandKit = z.infer<typeof BrandKitSchema>;

export const DEFAULT_BRAND_KIT: BrandKit = {
  theme: THEME_PRESETS.minkflow_dark,
  captionsEnabled: true,
  logoAssetId: null,
};
