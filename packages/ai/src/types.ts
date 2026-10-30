export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Usage {
  provider: string;
  model: string;
  operation: string;
  quantity: number;
  unit: 'tokens' | 'characters' | 'calls';
  estimatedUsd: number;
  providerRequestId: string | null;
}

/** Low-level JSON completion. Implementations must not interpret or execute the returned content. */
export interface LlmProvider {
  readonly name: string;
  completeJson(messages: ChatMessage[], options: { model: 'script' | 'storyboard'; maxOutputTokens: number; temperature?: number }): Promise<{ text: string; usage: Usage }>;
  moderate(text: string): Promise<{ flagged: boolean; categories: string[]; usage: Usage | null }>;
}

export interface TimedWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface TtsResult {
  audio: Uint8Array;
  mime: 'audio/mpeg' | 'audio/wav';
  extension: 'mp3' | 'wav';
  /** Provider-reported speech end; the worker re-measures actual file duration. */
  alignmentEndMs: number;
  words: TimedWord[];
  usage: Usage;
}

export interface Voice {
  id: string;
  name: string;
  description: string;
}

export interface TtsProvider {
  readonly name: string;
  readonly model: string;
  listVoices(): Voice[];
  synthesize(text: string, voiceId: string): Promise<TtsResult>;
}
