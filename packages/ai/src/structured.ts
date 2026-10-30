import { AppError } from '@minkflow/shared';
import type { z } from 'zod';
import type { ChatMessage, LlmProvider, Usage } from './types';

export const MAX_REPAIRS = 2;

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(trimmed);
}

function summarizeIssues(error: z.ZodError): string {
  return error.issues.slice(0, 12).map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
}

/**
 * Requests JSON, validates with Zod, and asks the model to repair at most MAX_REPAIRS times.
 * Output is treated as untrusted data; it is never executed.
 */
export async function generateStructured<S extends z.ZodTypeAny>(
  llm: LlmProvider,
  schema: S,
  messages: ChatMessage[],
  options: { model: 'script' | 'storyboard'; maxOutputTokens: number; postValidate?: (value: z.infer<S>) => string | null },
): Promise<{ value: z.infer<S>; usages: Usage[]; repairs: number }> {
  const usages: Usage[] = [];
  const conversation = [...messages];
  for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {
    const { text, usage } = await llm.completeJson(conversation, { model: options.model, maxOutputTokens: options.maxOutputTokens });
    usages.push(usage);
    let problem: string;
    try {
      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) {
        const extra = options.postValidate?.(parsed.data) ?? null;
        if (!extra) return { value: parsed.data, usages, repairs: attempt };
        problem = extra;
      } else {
        problem = summarizeIssues(parsed.error);
      }
    } catch {
      problem = 'The response was not valid JSON.';
    }
    conversation.push(
      { role: 'assistant', content: text.slice(0, 20_000) },
      { role: 'user', content: `Your JSON did not match the required schema. Fix ONLY these problems and return the full corrected JSON object, nothing else:\n${problem}` },
    );
  }
  throw new AppError('AI_OUTPUT_INVALID', undefined, { repairs: MAX_REPAIRS });
}
