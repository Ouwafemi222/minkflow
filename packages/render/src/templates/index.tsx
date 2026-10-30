import type { Scene, TemplateId, Theme } from '@minkflow/contracts';
import type { ReactElement } from 'react';
import { BarChart, LineChart, StatComparison } from './data';
import { BeforeAfter, IconGrid, ProcessSteps, Timeline } from './structure';
import { ClosingCta, QuoteFocus, TitleReveal } from './text';

export const TEMPLATE_META: Record<TemplateId, { label: string; description: string }> = {
  title_reveal: { label: 'Title reveal', description: 'Big title with optional subtitle and icon' },
  stat_comparison: { label: 'Stat comparison', description: '2–4 animated numbers side by side' },
  timeline: { label: 'Timeline', description: '2–6 dated events on a line' },
  process_steps: { label: 'Process steps', description: '2–5 numbered steps' },
  icon_grid: { label: 'Icon grid', description: '2–6 icons with labels' },
  quote_focus: { label: 'Quote focus', description: 'A single highlighted quote' },
  bar_chart: { label: 'Bar chart', description: '2–8 animated bars' },
  line_chart: { label: 'Line chart', description: '3–12 points drawn as a line' },
  before_after: { label: 'Before / after', description: 'Two-column contrast' },
  closing_cta: { label: 'Closing call to action', description: 'Outro with call to action' },
};

interface RenderArgs {
  scene: Scene;
  theme: Theme;
  frame: number;
  durationInFrames: number;
  captions: boolean;
}

export function renderTemplate({ scene, ...rest }: RenderArgs): ReactElement {
  switch (scene.template) {
    case 'title_reveal':
      return <TitleReveal visual={scene.visual} {...rest} />;
    case 'stat_comparison':
      return <StatComparison visual={scene.visual} {...rest} />;
    case 'timeline':
      return <Timeline visual={scene.visual} {...rest} />;
    case 'process_steps':
      return <ProcessSteps visual={scene.visual} {...rest} />;
    case 'icon_grid':
      return <IconGrid visual={scene.visual} {...rest} />;
    case 'quote_focus':
      return <QuoteFocus visual={scene.visual} {...rest} />;
    case 'bar_chart':
      return <BarChart visual={scene.visual} {...rest} />;
    case 'line_chart':
      return <LineChart visual={scene.visual} {...rest} />;
    case 'before_after':
      return <BeforeAfter visual={scene.visual} {...rest} />;
    case 'closing_cta':
      return <ClosingCta visual={scene.visual} {...rest} />;
  }
}
