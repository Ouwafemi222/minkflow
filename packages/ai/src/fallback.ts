import { AppError } from '@minkflow/shared';
import type { LlmProvider } from './types';

export function isProviderQuotaExhausted(error: unknown): boolean {
  return error instanceof AppError && (error.details as { reason?: string } | undefined)?.reason === 'provider_quota_exhausted';
}

/** When the paid writing API is out of billing credit, keep generating with the built-in planner. */
export function withQuotaFallback(primary: LlmProvider, fallback: LlmProvider): LlmProvider {
  return {
    name: primary.name,
    async completeJson(messages, options) {
      try {
        return await primary.completeJson(messages, options);
      } catch (error) {
        if (!isProviderQuotaExhausted(error)) throw error;
        return fallback.completeJson(messages, options);
      }
    },
    async moderate(text) {
      try {
        return await primary.moderate(text);
      } catch (error) {
        if (!isProviderQuotaExhausted(error)) throw error;
        return fallback.moderate(text);
      }
    },
  };
}
