import 'server-only';
import { MOCK_VOICES, parseVoiceList, type Voice } from '@minkflow/ai';
import { env } from './env';

export function availableVoices(): Voice[] {
  return env().AI_PROVIDER_MODE === 'live' ? parseVoiceList(env().ELEVENLABS_VOICE_IDS) : MOCK_VOICES;
}

export function isAllowedVoice(id: string): boolean {
  return availableVoices().some((v) => v.id === id);
}
