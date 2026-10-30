import { describe, expect, it } from 'vitest';
import {
  AUDIO_LEAD_FRAMES,
  activeCaptionLine,
  assembleScene,
  canTransition,
  canTransitionJob,
  groupCaptionLines,
  ProjectInputSchema,
  RenderManifestSchema,
  SceneSchema,
  sceneFramesForAudio,
  sceneOffsets,
  StoryboardDraftSchema,
  THEME_PRESETS,
  VIDEO,
} from './index';

const uuid = () => crypto.randomUUID();

describe('scene schema', () => {
  it('accepts a valid scene and rejects unknown templates and over-long text', () => {
    const scene = {
      id: uuid(),
      template: 'title_reveal',
      narration: 'Welcome to compound interest.',
      durationFrames: 90,
      captions: [],
      transition: 'fade',
      assets: [],
      visual: { title: 'Compound interest', icon: 'piggy-bank' },
    };
    expect(SceneSchema.safeParse(scene).success).toBe(true);
    expect(SceneSchema.safeParse({ ...scene, template: 'arbitrary_js' }).success).toBe(false);
    expect(SceneSchema.safeParse({ ...scene, visual: { title: 'x'.repeat(81) } }).success).toBe(false);
    expect(SceneSchema.safeParse({ ...scene, visual: { title: 'ok', icon: 'not-an-icon' } }).success).toBe(false);
  });

  it('rejects visual payload mismatched with template (discriminated union)', () => {
    const result = SceneSchema.safeParse({
      id: uuid(),
      template: 'bar_chart',
      narration: 'Bars',
      durationFrames: 90,
      captions: [],
      transition: 'none',
      assets: [],
      visual: { title: 'Hello' },
    });
    expect(result.success).toBe(false);
  });

  it('enforces frame bounds', () => {
    expect(
      SceneSchema.safeParse({
        id: uuid(), template: 'quote_focus', narration: 'Hi there', durationFrames: -5, captions: [],
        transition: 'none', assets: [], visual: { quote: 'Hi' },
      }).success,
    ).toBe(false);
  });
});

describe('timeline', () => {
  it('derives scene frames from audio with lead/tail padding and minimum', () => {
    expect(sceneFramesForAudio(10_000)).toBe(AUDIO_LEAD_FRAMES + 300 + 15);
    expect(sceneFramesForAudio(100)).toBe(VIDEO.minSceneFrames);
    expect(() => sceneFramesForAudio(Number.NaN)).toThrow();
  });
  it('computes offsets and rejects non-positive durations', () => {
    expect(sceneOffsets([90, 60, 30])).toEqual([0, 90, 150]);
    expect(() => sceneOffsets([90, 0])).toThrow();
  });
  it('groups caption lines and finds the active one', () => {
    const words = 'One two three four five six seven eight. Nine ten'.split(' ').map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 }));
    const lines = groupCaptionLines(words);
    expect(lines.map((l) => l.tokens.length)).toEqual([7, 1, 2]);
    expect(activeCaptionLine(lines, 0)?.tokens[0]?.text).toBe('One');
    expect(activeCaptionLine(lines, 2400)?.tokens[0]?.text).toBe('Nine');
    expect(activeCaptionLine(lines, 99_999)).toBeNull();
  });
});

describe('state machines', () => {
  it('allows only defined project transitions', () => {
    expect(canTransition('draft', 'script_pending')).toBe(true);
    expect(canTransition('draft', 'rendering')).toBe(false);
    expect(canTransition('rendering', 'failed')).toBe(true);
    expect(canTransition('completed', 'failed')).toBe(false);
  });
  it('makes terminal job states final', () => {
    expect(canTransitionJob('queued', 'running')).toBe(true);
    expect(canTransitionJob('completed', 'running')).toBe(false);
    expect(canTransitionJob('canceled', 'queued')).toBe(false);
  });
});

describe('assembly and manifest', () => {
  const draft = StoryboardDraftSchema.parse({
    scenes: [
      { template: 'title_reveal', narration: 'Hello there friends.', visual: { title: 'Hello' } },
      { template: 'closing_cta', narration: 'Subscribe for more.', visual: { headline: 'Thanks', cta: 'Subscribe' } },
    ],
  });

  it('assembles scenes with captions and audio-derived duration', () => {
    const scene = assembleScene(draft.scenes[0]!, { durationMs: 3000, words: [{ text: 'Hello', startMs: 0, endMs: 400 }] });
    expect(scene.durationFrames).toBe(AUDIO_LEAD_FRAMES + 90 + 15);
    expect(scene.captions).toEqual([{ text: 'Hello', startMs: 0, endMs: 400 }]);
  });

  it('rejects a manifest where speech would be clipped', () => {
    const scene = assembleScene(draft.scenes[0]!, { durationMs: 3000, words: [] });
    const base = {
      manifestVersion: 1, projectId: uuid(), revisionId: uuid(), fps: 30, width: 1920, height: 1080,
      theme: THEME_PRESETS.minkflow_dark, captionsEnabled: true, watermark: null,
    };
    expect(RenderManifestSchema.safeParse({ ...base, scenes: [{ scene, audio: { src: 'a.wav', durationMs: 3000 } }] }).success).toBe(true);
    expect(
      RenderManifestSchema.safeParse({ ...base, scenes: [{ scene: { ...scene, durationFrames: 60 }, audio: { src: 'a.wav', durationMs: 3000 } }] }).success,
    ).toBe(false);
    expect(RenderManifestSchema.safeParse({ ...base, scenes: [{ scene, audio: null }, { scene, audio: null }] }).success).toBe(false);
  });
});

describe('project input', () => {
  const base = { audience: 'general', tone: 'friendly', targetSeconds: 60, language: 'en', aspectRatio: '16:9', voiceId: 'v1' };
  it('requires topic or script depending on mode', () => {
    expect(ProjectInputSchema.safeParse({ ...base, mode: 'topic', topic: 'Black holes' }).success).toBe(true);
    expect(ProjectInputSchema.safeParse({ ...base, mode: 'topic' }).success).toBe(false);
    expect(ProjectInputSchema.safeParse({ ...base, mode: 'script', script: 'short' }).success).toBe(false);
    expect(ProjectInputSchema.safeParse({ ...base, mode: 'topic', topic: 'x', language: 'fr' }).success).toBe(false);
  });
});
