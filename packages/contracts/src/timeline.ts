import type { CaptionToken } from './scene';
import { VIDEO } from './scene';

/** Narration starts this many frames into each scene so entry animations are not covered by speech. */
export const AUDIO_LEAD_FRAMES = 9;
/** Silent hold after narration ends before the next scene. */
export const AUDIO_TAIL_FRAMES = 15;

export function msToFrames(ms: number, fps: number = VIDEO.fps): number {
  return Math.ceil((ms / 1000) * fps);
}

/** Scene length is derived from measured audio duration, never from word count estimates. */
export function sceneFramesForAudio(audioDurationMs: number, fps: number = VIDEO.fps): number {
  if (!Number.isFinite(audioDurationMs) || audioDurationMs < 0) {
    throw new Error(`Invalid audio duration: ${audioDurationMs}`);
  }
  const frames = AUDIO_LEAD_FRAMES + msToFrames(audioDurationMs, fps) + AUDIO_TAIL_FRAMES;
  return Math.min(VIDEO.maxSceneFrames, Math.max(VIDEO.minSceneFrames, frames));
}

export function sceneOffsets(durations: number[]): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const d of durations) {
    if (!Number.isInteger(d) || d <= 0) throw new Error(`Invalid scene duration: ${d}`);
    offsets.push(cursor);
    cursor += d;
  }
  return offsets;
}

export function totalFrames(durations: number[]): number {
  return durations.reduce((sum, d) => sum + d, 0);
}

export interface CaptionLine {
  tokens: CaptionToken[];
  startMs: number;
  endMs: number;
}

/** Groups word tokens into readable caption lines (max words / chars), breaking after sentence punctuation. */
export function groupCaptionLines(tokens: CaptionToken[], maxWords = 7, maxChars = 42): CaptionLine[] {
  const lines: CaptionLine[] = [];
  let current: CaptionToken[] = [];
  const flush = () => {
    if (current.length === 0) return;
    lines.push({ tokens: current, startMs: current[0]!.startMs, endMs: current.at(-1)!.endMs });
    current = [];
  };
  for (const token of tokens) {
    const chars = current.reduce((n, t) => n + t.text.length + 1, 0) + token.text.length;
    if (current.length >= maxWords || (current.length > 0 && chars > maxChars)) flush();
    current.push(token);
    if (/[.!?]$/.test(token.text)) flush();
  }
  flush();
  return lines;
}

export function activeCaptionLine(lines: CaptionLine[], ms: number): CaptionLine | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const nextStart = lines[i + 1]?.startMs ?? Number.POSITIVE_INFINITY;
    if (ms >= line.startMs && ms < Math.min(nextStart, line.endMs + 600)) return line;
  }
  return null;
}
