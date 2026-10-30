import { AppError } from '@minkflow/shared';
import { postJson } from './http';
import type { TimedWord, TtsProvider, Voice } from './types';

export interface ElevenLabsConfig {
  apiKey: string;
  modelId: string;
  voices: Voice[];
  baseUrl?: string;
  /** USD per 1K characters; TO VERIFY (docs/VERIFY.md V-03). */
  usdPer1kChars: number;
}

/** Shape documented for POST /v1/text-to-speech/{voice_id}/with-timestamps (TO VERIFY, V-02). */
interface WithTimestampsResponse {
  audio_base64: string;
  alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } | null;
}

export function wordsFromCharacterAlignment(chars: string[], starts: number[], ends: number[]): TimedWord[] {
  if (chars.length !== starts.length || chars.length !== ends.length) throw new AppError('ALIGNMENT_UNRELIABLE', 'Alignment arrays differ in length');
  const words: TimedWord[] = [];
  let text = '';
  let start = 0;
  let end = 0;
  const flush = () => {
    if (text.trim()) words.push({ text: text.trim(), startMs: Math.round(start * 1000), endMs: Math.round(end * 1000) });
    text = '';
  };
  chars.forEach((c, i) => {
    if (/\s/.test(c)) {
      flush();
      return;
    }
    if (!text) start = starts[i]!;
    text += c;
    end = ends[i]!;
  });
  flush();
  for (let i = 1; i < words.length; i++) {
    if (words[i]!.startMs < words[i - 1]!.startMs) throw new AppError('ALIGNMENT_UNRELIABLE', 'Alignment is not monotonic');
  }
  return words;
}

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function createElevenLabsProvider(config: ElevenLabsConfig): TtsProvider {
  const base = config.baseUrl ?? 'https://api.elevenlabs.io/v1';
  const allowed = new Set(config.voices.map((v) => v.id));
  return {
    name: 'elevenlabs',
    model: config.modelId,
    listVoices: () => config.voices,
    async synthesize(text, voiceId) {
      if (!allowed.has(voiceId)) throw new AppError('VALIDATION_FAILED', 'Voice is not available');
      const { data, requestId } = await postJson<WithTimestampsResponse>(
        `${base}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
        { 'xi-api-key': config.apiKey },
        { text, model_id: config.modelId },
        { timeoutMs: 120_000 },
      );
      if (!data.alignment || !data.audio_base64) throw new AppError('ALIGNMENT_UNRELIABLE', 'Provider returned no alignment');
      const { characters, character_start_times_seconds, character_end_times_seconds } = data.alignment;
      if (normalizeForCompare(characters.join('')) !== normalizeForCompare(text)) {
        throw new AppError('ALIGNMENT_UNRELIABLE', 'Alignment text does not match narration');
      }
      const words = wordsFromCharacterAlignment(characters, character_start_times_seconds, character_end_times_seconds);
      return {
        audio: new Uint8Array(Buffer.from(data.audio_base64, 'base64')),
        mime: 'audio/mpeg',
        extension: 'mp3',
        alignmentEndMs: Math.round((character_end_times_seconds.at(-1) ?? 0) * 1000),
        words,
        usage: {
          provider: 'elevenlabs',
          model: config.modelId,
          operation: 'tts',
          quantity: text.length,
          unit: 'characters',
          estimatedUsd: (text.length / 1000) * config.usdPer1kChars,
          providerRequestId: requestId,
        },
      };
    },
  };
}

export function parseVoiceList(raw: string | undefined): Voice[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, name, description] = entry.split(':');
      return { id: id!.trim(), name: (name ?? id!).trim(), description: (description ?? '').trim() };
    });
}
