import { describe, expect, it } from 'vitest';
import { applySceneEdit, defaultVisualFor, mergeClientStoryboard, quoteMicro, SceneSchema, statusesThatCanReach, TEMPLATE_IDS, type Scene } from './index';

const voiced = (narration: string): Scene =>
  SceneSchema.parse({
    id: crypto.randomUUID(),
    template: 'quote_focus',
    narration,
    visual: { quote: 'Hello' },
    transition: 'fade',
    durationFrames: 120,
    captions: [{ text: 'Hello', startMs: 0, endMs: 400 }],
    assets: [],
    voiceAssetId: crypto.randomUUID(),
  });

describe('scene edits and hash invalidation', () => {
  it('keeps voice when only visuals change and drops it when narration changes', () => {
    const scene = voiced('Hello there.');
    expect(applySceneEdit(scene, { visual: { quote: 'New quote' } }).voiceAssetId).toBe(scene.voiceAssetId);
    const edited = applySceneEdit(scene, { narration: 'Something completely different now.' });
    expect(edited.voiceAssetId).toBeUndefined();
    expect(edited.captions).toEqual([]);
  });

  it('merges client storyboards without trusting client timing or voice', () => {
    const a = voiced('First scene narration.');
    const b = voiced('Second scene narration.');
    const merged = mergeClientStoryboard([a, b], {
      scenes: [
        { id: b.id, template: 'quote_focus', narration: b.narration, visual: { quote: 'Moved first' }, transition: 'zoom' },
        { id: a.id, template: 'quote_focus', narration: 'Rewritten narration.', visual: { quote: 'Hello' }, transition: 'fade' },
        { id: crypto.randomUUID(), template: 'closing_cta', narration: 'Thanks!', visual: { headline: 'Bye', cta: 'Subscribe' }, transition: 'fade' },
      ],
    });
    expect(merged[0]!.voiceAssetId).toBe(b.voiceAssetId);
    expect(merged[0]!.durationFrames).toBe(120);
    expect(merged[1]!.voiceAssetId).toBeUndefined();
    expect(merged[2]!.voiceAssetId).toBeUndefined();
  });

  it('rejects invalid visuals and duplicate ids', () => {
    const a = voiced('First.');
    expect(() => mergeClientStoryboard([a], { scenes: [{ id: a.id, template: 'quote_focus', narration: 'x', visual: { quote: '' }, transition: 'fade' }] })).toThrow();
    expect(() => mergeClientStoryboard([a], { scenes: [{ ...a, visual: a.visual }, { ...a, visual: a.visual }] })).toThrow();
  });
});

describe('template defaults', () => {
  it('produces a schema-valid visual for every template', () => {
    for (const template of TEMPLATE_IDS) {
      const scene = { id: crypto.randomUUID(), template, narration: 'Compound interest grows your money over time. It is simple.', visual: defaultVisualFor(template, 'Compound interest grows your money over time. It is simple.'), transition: 'fade', durationFrames: 90, captions: [], assets: [] };
      expect(SceneSchema.safeParse(scene).success, template).toBe(true);
    }
  });
});

describe('pricing and statuses', () => {
  it('quotes in microcredits', () => {
    expect(quoteMicro({ type: 'script' })).toBe(2_000_000);
    expect(quoteMicro({ type: 'render', seconds: 60 })).toBe(30_000_000);
    expect(quoteMicro({ type: 'media', uncachedChars: 1000 })).toBe(8_000_000);
  });
  it('lists statuses that can reach a target', () => {
    expect(statusesThatCanReach('script_pending')).toContain('draft');
    expect(statusesThatCanReach('render_queued')).not.toContain('draft');
  });
});
