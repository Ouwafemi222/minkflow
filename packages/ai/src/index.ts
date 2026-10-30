export * from './types';
export * from './structured';
export * from './prompts';
export * from './planner';
export { createOpenAiProvider, type OpenAiConfig } from './openai';
export { createElevenLabsProvider, parseVoiceList, wordsFromCharacterAlignment, type ElevenLabsConfig } from './elevenlabs';
export { createMockLlm, createMockTts, MOCK_VOICES } from './mock';

import { createElevenLabsProvider, parseVoiceList } from './elevenlabs';
import { createMockLlm, createMockTts } from './mock';
import { createOpenAiProvider } from './openai';
import type { LlmProvider, TtsProvider } from './types';

export interface AiEnv {
  AI_PROVIDER_MODE: 'mock' | 'live';
  OPENAI_API_KEY?: string | undefined;
  OPENAI_MODEL_SCRIPT?: string | undefined;
  OPENAI_MODEL_STORYBOARD?: string | undefined;
  OPENAI_MODEL_MODERATION?: string | undefined;
  OPENAI_INPUT_USD_PER_1M?: string | undefined;
  OPENAI_OUTPUT_USD_PER_1M?: string | undefined;
  ELEVENLABS_API_KEY?: string | undefined;
  ELEVENLABS_MODEL_ID?: string | undefined;
  ELEVENLABS_VOICE_IDS?: string | undefined;
  ELEVENLABS_USD_PER_1K_CHARS?: string | undefined;
}

export function createProvidersFromEnv(env: AiEnv): { llm: LlmProvider; tts: TtsProvider } {
  if (env.AI_PROVIDER_MODE !== 'live') return { llm: createMockLlm(), tts: createMockTts() };
  const required = ['OPENAI_API_KEY', 'OPENAI_MODEL_SCRIPT', 'OPENAI_MODEL_STORYBOARD', 'ELEVENLABS_API_KEY', 'ELEVENLABS_MODEL_ID', 'ELEVENLABS_VOICE_IDS'] as const;
  const missing = required.filter((k) => !env[k]);
  if (missing.length > 0) throw new Error(`AI_PROVIDER_MODE=live requires: ${missing.join(', ')}`);
  return {
    llm: createOpenAiProvider({
      apiKey: env.OPENAI_API_KEY!,
      scriptModel: env.OPENAI_MODEL_SCRIPT!,
      storyboardModel: env.OPENAI_MODEL_STORYBOARD!,
      moderationModel: env.OPENAI_MODEL_MODERATION || 'omni-moderation-latest',
      inputUsdPer1M: Number(env.OPENAI_INPUT_USD_PER_1M ?? 5),
      outputUsdPer1M: Number(env.OPENAI_OUTPUT_USD_PER_1M ?? 15),
    }),
    tts: createElevenLabsProvider({
      apiKey: env.ELEVENLABS_API_KEY!,
      modelId: env.ELEVENLABS_MODEL_ID!,
      voices: parseVoiceList(env.ELEVENLABS_VOICE_IDS),
      usdPer1kChars: Number(env.ELEVENLABS_USD_PER_1K_CHARS ?? 0.3),
    }),
  };
}
