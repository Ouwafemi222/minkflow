export interface ToneWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface ToneNarration {
  wav: Uint8Array;
  durationMs: number;
  words: ToneWord[];
}

const SAMPLE_RATE = 24_000;
const MS_PER_CHAR = 65;
const MIN_WORD_MS = 160;
const GAP_MS = 70;
const LEAD_MS = 120;
const TAIL_MS = 200;

/**
 * Deterministic placeholder "speech": one soft tone per word with word timings.
 * Used by the mock TTS provider and render fixtures. It is not real speech.
 */
export function synthesizeToneNarration(text: string): ToneNarration {
  const tokens = text.split(/\s+/).filter(Boolean);
  const words: ToneWord[] = [];
  let cursor = LEAD_MS;
  for (const token of tokens) {
    const length = Math.max(MIN_WORD_MS, token.replace(/[^\p{L}\p{N}]/gu, '').length * MS_PER_CHAR);
    words.push({ text: token, startMs: cursor, endMs: cursor + length });
    cursor += length + (/[.!?]$/.test(token) ? GAP_MS * 4 : /[,;:]$/.test(token) ? GAP_MS * 2 : GAP_MS);
  }
  const durationMs = Math.max(cursor + TAIL_MS, 500);
  const totalSamples = Math.ceil((durationMs / 1000) * SAMPLE_RATE);
  const pcm = new Int16Array(totalSamples);
  words.forEach((word, index) => {
    const frequency = 180 + ((index * 37) % 120);
    const start = Math.floor((word.startMs / 1000) * SAMPLE_RATE);
    const end = Math.min(totalSamples, Math.floor((word.endMs / 1000) * SAMPLE_RATE));
    const span = Math.max(1, end - start);
    for (let i = start; i < end; i++) {
      const t = (i - start) / span;
      const envelope = Math.sin(Math.PI * t);
      const sample = Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE) * envelope * 0.25;
      pcm[i] = Math.round(sample * 32767);
    }
  });
  return { wav: encodeWav(pcm, SAMPLE_RATE), durationMs, words };
}

export function encodeWav(pcm: Int16Array, sampleRate: number): Uint8Array {
  const dataSize = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i]!, true);
  return new Uint8Array(buffer);
}
