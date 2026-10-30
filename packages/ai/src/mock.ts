import type { IconId, Script, StoryboardSceneDraft } from '@minkflow/contracts';
import { synthesizeToneNarration } from '@minkflow/shared';
import type { ChatMessage, LlmProvider, TtsProvider, Usage, Voice } from './types';

/**
 * Deterministic offline providers for local development and CI. They produce schema-valid output from the
 * user's own text, never call the network, and cost nothing. They are NOT production integrations.
 */
const BLOCKLIST = [/\bhow to (make|build) (a )?(bomb|weapon)\b/i, /\bkill (yourself|myself)\b/i, /\bchild (porn|sexual)/i];

const usage = (operation: string, quantity: number, unit: Usage['unit']): Usage => ({
  provider: 'mock', model: 'mock-1', operation, quantity, unit, estimatedUsd: 0, providerRequestId: null,
});

function between(content: string, label: string): string {
  const start = content.indexOf(`<<<${label}\n`);
  const end = content.indexOf(`\n${label}>>>`);
  return start >= 0 && end > start ? content.slice(start + label.length + 4, end) : '';
}

const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`).trim() || s.slice(0, max);
const sentences = (text: string) => text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
const ICON_ROTATION: IconId[] = ['lightbulb', 'target', 'rocket', 'brain', 'globe', 'zap', 'shield', 'star', 'clock', 'users'];

function mockScript(user: string): Script {
  const topic = between(user, 'TOPIC').trim();
  const pasted = between(user, 'SCRIPT').trim();
  if (pasted) {
    const paragraphs = pasted.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length >= 10);
    const chunks = paragraphs.length >= 2 ? paragraphs : sentences(pasted).reduce<string[]>((acc, s, i) => {
      if (i % 3 === 0) acc.push(s); else acc[acc.length - 1] += ` ${s}`;
      return acc;
    }, []);
    const safeChunks = chunks.length >= 2 ? chunks : [pasted.slice(0, Math.ceil(pasted.length / 2)), pasted.slice(Math.ceil(pasted.length / 2))];
    const sections = safeChunks.slice(0, 20).map((text, i, all) => ({
      kind: i === 0 ? ('hook' as const) : i === all.length - 1 ? ('outro' as const) : i === 1 ? ('example' as const) : ('body' as const),
      heading: clip(sentences(text)[0] ?? `Part ${i + 1}`, 80),
      text: clip(text, 2500).padEnd(10, '.'),
    }));
    return { title: clip(sections[0]!.heading, 100).padEnd(3, '.'), sections, claims: claimsFor(sections) };
  }
  const t = topic || 'this topic';
  const sections = [
    { kind: 'hook' as const, heading: `Why ${t} matters`, text: `Have you ever wondered how ${t} really works? In the next few minutes, we will break it down into simple ideas you can remember.` },
    { kind: 'body' as const, heading: 'The core idea', text: `At its heart, ${t} is about a few connected parts working together. Once you see those parts, the whole picture becomes much easier to follow.` },
    { kind: 'body' as const, heading: 'How it works', text: `First, something starts the process. Next, each step builds on the one before it. Finally, the result shows up in a way we can measure and explain.` },
    { kind: 'example' as const, heading: 'A simple example', text: `Imagine explaining ${t} to a friend over coffee. You would start with one clear example, then show how the same idea appears in everyday life.` },
    { kind: 'outro' as const, heading: 'Key takeaway', text: `So remember the three steps: start, build, and result. If this helped, subscribe for more simple explainers like this one.` },
  ].map((s) => ({ ...s, heading: clip(s.heading, 80), text: clip(s.text, 2500) }));
  return { title: clip(`${t.charAt(0).toUpperCase()}${t.slice(1)}, explained`, 100), sections, claims: claimsFor(sections) };
}

function claimsFor(sections: Script['sections']): Script['claims'] {
  return sections.flatMap((s, sectionIndex) =>
    sentences(s.text)
      .filter((sentence) => /\d|percent|always|never|proven|studies/i.test(sentence))
      .slice(0, 2)
      .map((text) => ({ text: clip(text, 300).padEnd(3, '.'), sectionIndex, reason: 'Contains a factual or numeric statement to verify.' })),
  ).slice(0, 30);
}

function mockStoryboard(user: string): { scenes: StoryboardSceneDraft[] } {
  const parsed = JSON.parse(between(user, 'APPROVED_SCRIPT') || '{"title":"Explainer","sections":[]}') as Pick<Script, 'title' | 'sections'>;
  const all = parsed.sections.flatMap((s) => sentences(s.text).map((sentence) => ({ sentence, heading: s.heading })));
  const groups: Array<{ text: string; heading: string }> = [];
  for (const item of all) {
    const last = groups.at(-1);
    if (last && last.text.split(/\s+/).length < 28 && last.heading === item.heading) last.text += ` ${item.sentence}`;
    else groups.push({ text: item.sentence, heading: item.heading });
  }
  const scenes: StoryboardSceneDraft[] = groups.map((g, i): StoryboardSceneDraft => {
    const narration = clip(g.text, 600).padEnd(5, '.');
    const heading = clip(g.heading, 60);
    const words = g.text.replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter((w) => w.length > 4);
    const label = (n: number, max: number) => clip(words[n % Math.max(1, words.length)] ?? `Point ${n + 1}`, max);
    const numbers = (g.text.match(/\d[\d,.]*/g) ?? []).map((n) => Number(n.replace(/,/g, ''))).filter(Number.isFinite);
    if (i === 0) return { template: 'title_reveal', narration, visual: { title: clip(parsed.title, 80), subtitle: heading, icon: 'sparkles' }, transition: 'fade' };
    if (i === groups.length - 1) return { template: 'closing_cta', narration, visual: { headline: heading, cta: 'Subscribe for more' }, transition: 'fade' };
    if (numbers.length >= 2) return { template: 'stat_comparison', narration, visual: { heading, items: numbers.slice(0, 4).map((value, k) => ({ label: label(k, 40), value })) }, transition: 'zoom' };
    const pick = i % 4;
    if (pick === 1) return { template: 'icon_grid', narration, visual: { heading, items: [0, 1, 2].map((k) => ({ icon: ICON_ROTATION[(i + k) % ICON_ROTATION.length]!, label: label(k, 30) })) }, transition: 'slide_left' };
    if (pick === 2) return { template: 'process_steps', narration, visual: { heading, steps: [0, 1, 2].map((k) => ({ title: label(k + 3, 40), icon: ICON_ROTATION[(i + k + 3) % ICON_ROTATION.length]! })) }, transition: 'slide_up' };
    if (pick === 3) return { template: 'quote_focus', narration, visual: { quote: clip(sentences(g.text)[0] ?? g.text, 200) }, transition: 'fade' };
    return { template: 'before_after', narration, visual: { before: { title: 'Before', points: [label(0, 50)] }, after: { title: 'After', points: [label(1, 50)] } }, transition: 'fade' };
  });
  if (scenes.length < 2) scenes.push({ template: 'closing_cta', narration: 'Thanks for watching.', visual: { headline: 'Thanks for watching', cta: 'Subscribe' }, transition: 'fade' });
  return { scenes };
}

function mockRegenerate(user: string): StoryboardSceneDraft {
  const current = JSON.parse(between(user, 'CURRENT_SCENE')) as StoryboardSceneDraft;
  const request = between(user, 'CREATOR_REQUEST').trim();
  return {
    template: 'icon_grid',
    narration: current.narration,
    visual: { heading: clip(request || 'Key ideas', 60), items: [{ icon: 'lightbulb', label: 'Idea' }, { icon: 'target', label: 'Goal' }, { icon: 'rocket', label: 'Result' }] },
    transition: current.transition ?? 'fade',
  };
}

export function createMockLlm(options: { failFirstAttempts?: number } = {}): LlmProvider {
  let failures = options.failFirstAttempts ?? 0;
  return {
    name: 'mock',
    async completeJson(messages: ChatMessage[]) {
      const system = messages[0]?.content ?? '';
      const user = messages.find((m) => m.role === 'user')?.content ?? '';
      if (failures > 0) {
        failures--;
        return { text: '{"not":"valid"}', usage: usage('chat', 10, 'tokens') };
      }
      const value = system.includes('narration scripts') ? mockScript(user) : system.includes('ONE scene') ? mockRegenerate(user) : mockStoryboard(user);
      const text = JSON.stringify(value);
      return { text, usage: usage('chat', Math.ceil(text.length / 4), 'tokens') };
    },
    async moderate(text) {
      const hit = BLOCKLIST.find((re) => re.test(text));
      return { flagged: Boolean(hit), categories: hit ? ['policy'] : [], usage: null };
    },
  };
}

export const MOCK_VOICES: Voice[] = [
  { id: 'mock-ava', name: 'Ava (mock)', description: 'Placeholder tones, not real speech' },
  { id: 'mock-leo', name: 'Leo (mock)', description: 'Placeholder tones, not real speech' },
];

export function createMockTts(): TtsProvider {
  return {
    name: 'mock',
    model: 'mock-tones-1',
    listVoices: () => MOCK_VOICES,
    async synthesize(text) {
      const narration = synthesizeToneNarration(text);
      return {
        audio: narration.wav,
        mime: 'audio/wav',
        extension: 'wav',
        alignmentEndMs: narration.words.at(-1)?.endMs ?? 0,
        words: narration.words,
        usage: usage('tts', text.length, 'characters'),
      };
    },
  };
}
