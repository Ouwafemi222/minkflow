import {
  ScriptSchema,
  StoryboardDraftSchema,
  StoryboardSceneDraftSchema,
  type ProjectInput,
  type Script,
  type StoryboardDraft,
  type StoryboardSceneDraft,
} from '@minkflow/contracts';
import { AppError } from '@minkflow/shared';
import { sceneRegenerateMessages, scriptMessages, storyboardMessages } from './prompts';
import { generateStructured } from './structured';
import type { LlmProvider, Usage } from './types';

export async function moderateOrThrow(llm: LlmProvider, text: string): Promise<Usage[]> {
  const result = await llm.moderate(text.slice(0, 20_000));
  if (result.flagged) throw new AppError('CONTENT_REJECTED', undefined, { categories: result.categories });
  return result.usage ? [result.usage] : [];
}

export async function planScript(llm: LlmProvider, input: ProjectInput): Promise<{ script: Script; usages: Usage[] }> {
  const usages = await moderateOrThrow(llm, `${input.topic ?? ''}\n${input.script ?? ''}`);
  const result = await generateStructured(llm, ScriptSchema, scriptMessages(input), {
    model: 'script',
    maxOutputTokens: 4000,
    postValidate: (s) => (s.claims.some((c) => c.sectionIndex >= s.sections.length) ? 'claims[].sectionIndex must reference an existing section' : null),
  });
  const outputModeration = await moderateOrThrow(llm, result.value.sections.map((s) => s.text).join('\n'));
  return { script: result.value, usages: [...usages, ...result.usages, ...outputModeration] };
}

export async function planStoryboard(llm: LlmProvider, script: Script, input: ProjectInput): Promise<{ storyboard: StoryboardDraft; usages: Usage[] }> {
  const result = await generateStructured(llm, StoryboardDraftSchema, storyboardMessages(script, input), {
    model: 'storyboard',
    maxOutputTokens: 8000,
    postValidate: (b) => {
      const words = b.scenes.reduce((n, s) => n + s.narration.split(/\s+/).length, 0);
      const maxWords = Math.round((input.targetSeconds + 60) * 3);
      return words > maxWords ? `Total narration is ${words} words; keep it under ${maxWords}.` : null;
    },
  });
  return { storyboard: result.value, usages: result.usages };
}

export async function regenerateScene(
  llm: LlmProvider,
  scene: StoryboardSceneDraft,
  neighbors: { before: string | null; after: string | null },
  instruction: string | null,
): Promise<{ scene: StoryboardSceneDraft; usages: Usage[] }> {
  const usages = instruction ? await moderateOrThrow(llm, instruction) : [];
  const result = await generateStructured(llm, StoryboardSceneDraftSchema, sceneRegenerateMessages(scene, neighbors, instruction), {
    model: 'storyboard',
    maxOutputTokens: 1500,
  });
  return { scene: result.value, usages: [...usages, ...result.usages] };
}
