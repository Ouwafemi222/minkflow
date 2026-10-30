import type { StoryboardSceneDraft } from './ai';
import type { CaptionToken, Scene } from './scene';
import { SceneSchema } from './scene';
import { sceneFramesForAudio } from './timeline';

export interface TimedWord {
  text: string;
  startMs: number;
  endMs: number;
}

export function captionsFromWords(words: TimedWord[]): CaptionToken[] {
  return words
    .filter((w) => w.text.trim().length > 0)
    .map((w) => ({
      text: w.text.trim().slice(0, 64),
      startMs: Math.max(0, Math.round(w.startMs)),
      endMs: Math.max(Math.round(w.startMs), Math.round(w.endMs)),
    }));
}

/** Builds a validated Scene from an AI draft plus measured narration. Throws on invalid output. */
export function assembleScene(
  draft: StoryboardSceneDraft,
  narration: { durationMs: number; words: TimedWord[] } | null,
  options: { id?: string; voiceAssetId?: string; fallbackDurationMs?: number } = {},
): Scene {
  const durationMs = narration?.durationMs ?? options.fallbackDurationMs ?? 4000;
  return SceneSchema.parse({
    id: options.id ?? crypto.randomUUID(),
    template: draft.template,
    narration: draft.narration,
    visual: draft.visual,
    transition: draft.transition ?? 'fade',
    durationFrames: sceneFramesForAudio(durationMs),
    captions: narration ? captionsFromWords(narration.words) : [],
    assets: [],
    ...(options.voiceAssetId ? { voiceAssetId: options.voiceAssetId } : {}),
  });
}
