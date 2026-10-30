import {
  assembleScene,
  StoryboardDraftSchema,
  THEME_PRESETS,
  type RenderManifest,
  type StoryboardSceneDraft,
  type Theme,
} from '@minkflow/contracts';
import { synthesizeToneNarration } from '@minkflow/shared';

const FIXTURE_PROJECT_ID = '00000000-0000-4000-8000-000000000001';
const FIXTURE_REVISION_ID = '00000000-0000-4000-8000-000000000002';
const sceneId = (fixture: number, i: number) => `00000000-0000-4000-8${String(fixture).padStart(3, '0')}-${String(i).padStart(12, '0')}`;

export const financeExplainer60s: StoryboardSceneDraft[] = StoryboardDraftSchema.parse({
  scenes: [
    { template: 'title_reveal', narration: 'What if your money could quietly work for you while you sleep? Let us talk about compound interest.', visual: { title: 'Compound interest', subtitle: 'How small savings grow over time', icon: 'piggy-bank' } },
    { template: 'stat_comparison', narration: 'Imagine saving one hundred dollars a month. After thirty years you put in thirty six thousand dollars, but at seven percent it can grow to over one hundred twenty thousand.', visual: { heading: 'Saving $100 a month for 30 years', items: [{ label: 'You contribute', value: 36000, prefix: '$' }, { label: 'At 7% per year', value: 122000, prefix: '$' }] } },
    { template: 'bar_chart', narration: 'Growth looks slow at first, then speeds up, because each year you earn returns on your earlier returns.', visual: { title: 'Balance by decade', unit: 'USD', bars: [{ label: 'Year 10', value: 17300 }, { label: 'Year 20', value: 52000 }, { label: 'Year 30', value: 122000 }] } },
    { template: 'line_chart', narration: 'Plot it on a line and the curve bends upward. That bend is compounding in action.', visual: { title: 'The compounding curve', points: [{ label: '0', value: 0 }, { label: '5', value: 7100 }, { label: '10', value: 17300 }, { label: '15', value: 31700 }, { label: '20', value: 52000 }, { label: '25', value: 81000 }, { label: '30', value: 122000 }] } },
    { template: 'process_steps', narration: 'To use it, start early, contribute regularly, and leave the money invested long enough to grow.', visual: { heading: 'Three habits', steps: [{ title: 'Start early', icon: 'clock' }, { title: 'Contribute monthly', icon: 'calendar' }, { title: 'Stay invested', icon: 'trending-up' }] } },
    { template: 'closing_cta', narration: 'Returns are never guaranteed, so do your own research. Subscribe for more money basics.', visual: { headline: 'Time is your biggest asset', cta: 'Subscribe', handle: '@moneybasics' } },
  ],
}).scenes;

const techTopics: Array<[string, StoryboardSceneDraft['template']]> = [
  ['How the internet moves data', 'title_reveal'], ['Packets', 'icon_grid'], ['Routers', 'process_steps'], ['Latency', 'stat_comparison'],
  ['A short history', 'timeline'], ['Bandwidth growth', 'bar_chart'], ['Traffic over a day', 'line_chart'], ['Old vs new networks', 'before_after'],
  ['A famous idea', 'quote_focus'], ['DNS lookups', 'process_steps'], ['Encryption', 'icon_grid'], ['Data centers', 'stat_comparison'],
  ['Undersea cables', 'timeline'], ['Mobile networks', 'bar_chart'], ['Peak usage', 'line_chart'], ['Caching', 'before_after'],
  ['Content delivery', 'icon_grid'], ['Security basics', 'process_steps'], ['The future', 'quote_focus'], ['Key takeaways', 'icon_grid'],
  ['Thanks for watching', 'closing_cta'],
];

function techVisual(title: string, template: StoryboardSceneDraft['template'], i: number): StoryboardSceneDraft['visual'] {
  switch (template) {
    case 'title_reveal': return { title, subtitle: 'A five minute technology explainer', icon: 'globe' };
    case 'icon_grid': return { heading: title, items: [{ icon: 'cpu', label: 'Compute' }, { icon: 'cloud', label: 'Cloud' }, { icon: 'lock', label: 'Security' }, { icon: 'zap', label: 'Speed' }] };
    case 'process_steps': return { heading: title, steps: [{ title: 'Request', description: 'Your device asks for data', icon: 'smartphone' }, { title: 'Route', description: 'Routers pick a path', icon: 'map-pin' }, { title: 'Respond', description: 'The server sends it back', icon: 'database' }] };
    case 'stat_comparison': return { heading: title, items: [{ label: 'Fiber', value: 5, suffix: ' ms' }, { label: 'Satellite', value: 600, suffix: ' ms' }] };
    case 'timeline': return { heading: title, events: [{ label: '1969', title: 'First network link' }, { label: '1983', title: 'TCP/IP adopted' }, { label: '1991', title: 'The web appears' }, { label: '2007', title: 'Smartphones spread' }] };
    case 'bar_chart': return { title, unit: 'Mbps', bars: [{ label: '2005', value: 3 + i }, { label: '2015', value: 25 + i }, { label: '2025', value: 200 + i }] };
    case 'line_chart': return { title, unit: '%', points: [{ label: '00h', value: 20 }, { label: '06h', value: 12 }, { label: '12h', value: 55 }, { label: '18h', value: 80 }, { label: '23h', value: 60 }] };
    case 'before_after': return { before: { title: 'Before', points: ['Slow page loads', 'Single server'] }, after: { title: 'After', points: ['Fast global access', 'Many edge locations'] } };
    case 'quote_focus': return { quote: 'Simple rules, applied at enormous scale, create surprisingly complex systems.', attribution: 'Illustrative quote' };
    case 'closing_cta': return { headline: title, cta: 'Subscribe for more', handle: '@techexplained' };
  }
}

export const techExplainer5min: StoryboardSceneDraft[] = StoryboardDraftSchema.parse({
  scenes: techTopics.map(([title, template], i) => ({
    template,
    narration: `${title}. In this part we explain the idea in plain language, give one concrete example, and connect it to what you already know about phones, laptops and the websites you visit every single day.`,
    visual: techVisual(title, template, i),
    transition: i % 3 === 0 ? 'slide_left' : i % 3 === 1 ? 'fade' : 'zoom',
  })),
}).scenes;

export const longCaptions: StoryboardSceneDraft[] = StoryboardDraftSchema.parse({
  scenes: [
    { template: 'quote_focus', narration: 'Long captions test: "Well — actually," she said, "it\'s not that simple; there are exceptions, caveats, and (sometimes) surprising edge-cases!" Isn\'t that interesting? Supercalifragilisticexpialidocious words, numbers like 3.14159, and URLs like example.com/path must wrap safely.', visual: { quote: 'Punctuation, numbers like 3.14159 and very long words must never overflow the caption safe area.', attribution: 'Caption stress test' } },
    { template: 'closing_cta', narration: 'End of the stress test.', visual: { headline: 'Stress test complete', cta: 'Done' } },
  ],
}).scenes;

export const FIXTURES = { finance60: financeExplainer60s, tech5min: techExplainer5min, longCaptions } as const;
export type FixtureName = keyof typeof FIXTURES;

export interface FixtureBuildOptions {
  theme?: Theme;
  captionsEnabled?: boolean;
  watermark?: string | null;
  /** Returns a URL the renderer can fetch for scene i's narration WAV, or null for silent scenes. */
  audioSrc?: (index: number) => string | null;
}

export function buildFixtureManifest(name: FixtureName, options: FixtureBuildOptions = {}): { manifest: RenderManifest; audio: Uint8Array[] } {
  const drafts = FIXTURES[name];
  const fixtureIndex = Object.keys(FIXTURES).indexOf(name) + 1;
  const audio: Uint8Array[] = [];
  const scenes = drafts.map((draft, i) => {
    const narration = synthesizeToneNarration(draft.narration);
    audio.push(narration.wav);
    const scene = assembleScene(draft, narration, { id: sceneId(fixtureIndex, i) });
    const src = options.audioSrc?.(i) ?? null;
    return { scene, audio: src ? { src, durationMs: narration.durationMs } : null, logoSrc: null };
  });
  const manifest: RenderManifest = {
    manifestVersion: 1,
    projectId: FIXTURE_PROJECT_ID,
    revisionId: FIXTURE_REVISION_ID,
    fps: 30,
    width: 1920,
    height: 1080,
    theme: options.theme ?? THEME_PRESETS.minkflow_dark,
    captionsEnabled: options.captionsEnabled ?? true,
    watermark: options.watermark ?? null,
    scenes,
  };
  return { manifest, audio };
}
