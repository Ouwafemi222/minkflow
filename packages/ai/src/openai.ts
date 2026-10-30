import { AppError } from '@minkflow/shared';
import { postJson } from './http';
import type { ChatMessage, LlmProvider, Usage } from './types';

export interface OpenAiConfig {
  apiKey: string;
  scriptModel: string;
  storyboardModel: string;
  moderationModel: string;
  baseUrl?: string;
  /** USD per 1M tokens; TO VERIFY against current pricing (docs/VERIFY.md V-01). */
  inputUsdPer1M: number;
  outputUsdPer1M: number;
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{ message: { content: string | null }; finish_reason: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

interface ModerationResponse {
  results: Array<{ flagged: boolean; categories: Record<string, boolean> }>;
}

/** OpenAI via documented REST endpoints (Chat Completions JSON mode, Moderations). */
export function createOpenAiProvider(config: OpenAiConfig): LlmProvider {
  const base = config.baseUrl ?? 'https://api.openai.com/v1';
  const headers = { Authorization: `Bearer ${config.apiKey}` };
  return {
    name: 'openai',
    async completeJson(messages: ChatMessage[], options) {
      const model = options.model === 'script' ? config.scriptModel : config.storyboardModel;
      const { data, requestId } = await postJson<ChatCompletionResponse>(
        `${base}/chat/completions`,
        headers,
        {
          model,
          messages,
          response_format: { type: 'json_object' },
          max_completion_tokens: options.maxOutputTokens,
          ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        },
        { timeoutMs: 120_000 },
      );
      const content = data.choices[0]?.message.content;
      if (!content) throw new AppError('AI_OUTPUT_INVALID', 'Empty model response');
      const input = data.usage?.prompt_tokens ?? 0;
      const output = data.usage?.completion_tokens ?? 0;
      const usage: Usage = {
        provider: 'openai',
        model,
        operation: `chat.${options.model}`,
        quantity: input + output,
        unit: 'tokens',
        estimatedUsd: (input * config.inputUsdPer1M + output * config.outputUsdPer1M) / 1_000_000,
        providerRequestId: requestId ?? data.id,
      };
      return { text: content, usage };
    },
    async moderate(text) {
      const { data, requestId } = await postJson<ModerationResponse>(`${base}/moderations`, headers, { model: config.moderationModel, input: text }, { timeoutMs: 30_000 });
      const result = data.results[0];
      return {
        flagged: Boolean(result?.flagged),
        categories: Object.entries(result?.categories ?? {}).filter(([, v]) => v).map(([k]) => k),
        usage: { provider: 'openai', model: config.moderationModel, operation: 'moderation', quantity: 1, unit: 'calls', estimatedUsd: 0, providerRequestId: requestId },
      };
    },
  };
}
