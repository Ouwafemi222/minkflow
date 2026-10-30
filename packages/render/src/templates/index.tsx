import { TEMPLATE_META, type Scene, type Theme } from '@minkflow/contracts';
import type { ReactElement } from 'react';
import { BarChart, LineChart, StatComparison } from './data';
import { BeforeAfter, IconGrid, ProcessSteps, Timeline } from './structure';
import { ClosingCta, QuoteFocus, TitleReveal } from './text';

export { TEMPLATE_META };

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
