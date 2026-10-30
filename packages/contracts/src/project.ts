import { z } from 'zod';
import { ScriptSchema, type ProjectInput } from './ai';
import { DURATION_LIMITS, SceneSchema, VIDEO, type BrandKit, type Scene } from './scene';
import { sceneFramesForAudio } from './timeline';

/** Script as stored on a revision. Approval requires explicit acknowledgement of flagged claims (ADR-010). */
export const ScriptStateSchema = ScriptSchema.extend({
  approvedAt: z.iso.datetime().nullable().default(null),
  claimsAcknowledged: z.boolean().default(false),
});
export type ScriptState = z.infer<typeof ScriptStateSchema>;

export const StoryboardStateSchema = z.object({
  scenes: z.array(SceneSchema).min(1).max(DURATION_LIMITS.maxScenes),
});
export type StoryboardState = z.infer<typeof StoryboardStateSchema>;

export interface ProjectDocument {
  input: ProjectInput;
  script: ScriptState | null;
  storyboard: StoryboardState | null;
  brand: BrandKit;
}

export function isScriptApproved(script: ScriptState | null): boolean {
  return Boolean(script?.approvedAt && script.claimsAcknowledged);
}

/** Small deterministic string hash (cyrb53) for change detection; not a security primitive. */
export function contentHash(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
    .join(',')}}`;
}

export function sceneHash(scene: Scene): string {
  return contentHash(stable({ template: scene.template, narration: scene.narration, visual: scene.visual, transition: scene.transition, voice: scene.voiceAssetId ?? null }));
}

/** Rough speech-length estimate (~2.6 words/s) used only until real narration is generated. */
export function estimateNarrationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 2.6) * 1000);
}

export function estimatedSceneFrames(narration: string): number {
  return sceneFramesForAudio(estimateNarrationMs(narration));
}

export const SceneEditSchema = z.object({
  narration: z.string().trim().min(1).max(600).optional(),
  visual: z.record(z.string(), z.unknown()).optional(),
  transition: z.enum(['none', 'fade', 'slide_left', 'slide_up', 'zoom']).optional(),
});
export type SceneEdit = z.infer<typeof SceneEditSchema>;

/**
 * Applies a user edit. Changing narration invalidates the scene's voice, captions and measured duration
 * (hash invalidation); other scenes are untouched so their cached narration is reused.
 */
export function applySceneEdit(scene: Scene, edit: SceneEdit): Scene {
  const narrationChanged = edit.narration !== undefined && edit.narration !== scene.narration;
  const next: Record<string, unknown> = {
    ...scene,
    ...(edit.narration !== undefined ? { narration: edit.narration } : {}),
    ...(edit.visual !== undefined ? { visual: edit.visual } : {}),
    ...(edit.transition !== undefined ? { transition: edit.transition } : {}),
  };
  if (narrationChanged) {
    delete next.voiceAssetId;
    next.captions = [];
    next.durationFrames = estimatedSceneFrames(edit.narration!);
  }
  return SceneSchema.parse(next);
}

/** What the editor may send for a scene. Timing, captions and voice are server-owned. */
export const ClientSceneSchema = z.object({
  id: z.uuid(),
  template: z.string(),
  narration: z.string().trim().min(1).max(600),
  visual: z.unknown(),
  transition: z.enum(['none', 'fade', 'slide_left', 'slide_up', 'zoom']),
});
export const ClientStoryboardSchema = z.object({ scenes: z.array(ClientSceneSchema).min(1).max(DURATION_LIMITS.maxScenes) });

/**
 * Merges an editor storyboard onto the previous server state. Voice/captions/duration are kept only when the
 * scene id and narration are unchanged; otherwise they are reset (hash invalidation). Throws on invalid scenes.
 */
export function mergeClientStoryboard(previous: Scene[], incoming: z.infer<typeof ClientStoryboardSchema>): Scene[] {
  const prev = new Map(previous.map((s) => [s.id, s]));
  const ids = new Set<string>();
  return incoming.scenes.map((c) => {
    if (ids.has(c.id)) throw new Error(`Duplicate scene id ${c.id}`);
    ids.add(c.id);
    const old = prev.get(c.id);
    const keepVoice = old && old.narration === c.narration && old.voiceAssetId;
    return SceneSchema.parse({
      id: c.id,
      template: c.template,
      narration: c.narration,
      visual: c.visual,
      transition: c.transition,
      assets: old?.assets ?? [],
      captions: keepVoice ? old.captions : [],
      durationFrames: keepVoice ? old.durationFrames : estimatedSceneFrames(c.narration),
      ...(keepVoice ? { voiceAssetId: old.voiceAssetId } : {}),
    });
  });
}

const clip = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…');

/** A valid starting visual for `template`, seeded from the scene's narration (used when switching templates). */
export function defaultVisualFor(template: Scene['template'], narration: string): Scene['visual'] {
  const firstSentence = clip(narration.split(/(?<=[.!?])\s/)[0] ?? narration, 200);
  const heading = clip(firstSentence.replace(/[.!?]$/, ''), 60);
  switch (template) {
    case 'title_reveal':
      return { title: clip(heading, 80), subtitle: undefined, icon: 'sparkles' } as Scene['visual'];
    case 'stat_comparison':
      return { heading, items: [{ label: 'Before', value: 10 }, { label: 'After', value: 25 }] };
    case 'timeline':
      return { heading, events: [{ label: 'Step 1', title: 'Start' }, { label: 'Step 2', title: 'Grow' }, { label: 'Step 3', title: 'Result' }] };
    case 'process_steps':
      return { heading, steps: [{ title: 'First', icon: 'play' }, { title: 'Then', icon: 'flag' }, { title: 'Finally', icon: 'check' }] };
    case 'icon_grid':
      return { heading, items: [{ icon: 'lightbulb', label: 'Idea' }, { icon: 'target', label: 'Goal' }, { icon: 'rocket', label: 'Result' }] };
    case 'quote_focus':
      return { quote: firstSentence };
    case 'bar_chart':
      return { title: heading, bars: [{ label: 'A', value: 3 }, { label: 'B', value: 5 }, { label: 'C', value: 8 }] };
    case 'line_chart':
      return { title: heading, points: [{ label: '1', value: 1 }, { label: '2', value: 3 }, { label: '3', value: 6 }, { label: '4', value: 10 }] };
    case 'before_after':
      return { before: { title: 'Before', points: ['The old way'] }, after: { title: 'After', points: ['The new way'] } };
    case 'closing_cta':
      return { headline: clip(heading, 80), cta: 'Subscribe for more' };
  }
}

export function needsNarration(scene: Scene): boolean {
  return !scene.voiceAssetId;
}

export function storyboardSeconds(scenes: Pick<Scene, 'durationFrames'>[]): number {
  return scenes.reduce((n, s) => n + s.durationFrames, 0) / VIDEO.fps;
}

export function sceneRows(scenes: Scene[]) {
  return scenes.map((scene, position) => ({ id: scene.id, position, template_id: scene.template, scene_json: scene, content_hash: sceneHash(scene) }));
}
