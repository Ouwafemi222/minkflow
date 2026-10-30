import type { VisualFor } from '@minkflow/contracts';
import { fadeUp, progress } from '../anim';
import { Icon } from '../icons';
import { Card, Heading, SafeArea, type TemplateProps } from '../layout';

export function Timeline({ visual, theme, frame, captions }: TemplateProps<VisualFor<'timeline'>>) {
  const line = progress(frame, 6, 40);
  const n = visual.events.length;
  return (
    <SafeArea captions={captions}>
      {visual.heading ? <Heading theme={theme} style={{ ...fadeUp(frame, 0), marginBottom: 80, textAlign: 'center' }}>{visual.heading}</Heading> : null}
      <div style={{ position: 'relative', height: 360 }}>
        <div style={{ position: 'absolute', top: 60, left: `${50 / n}%`, height: 8, width: `${line * (100 - 100 / n)}%`, background: theme.primary, borderRadius: 4 }} />
        {visual.events.map((event, i) => {
          const left = ((i + 0.5) / n) * 100;
          const style = fadeUp(frame, 10 + i * 8, 30);
          return (
            <div key={i} style={{ position: 'absolute', left: `${left}%`, top: 0, transform: `translateX(-50%) ${style.transform}`, opacity: style.opacity, width: 1680 / n - 24, textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: theme.accent, height: 44 }}>{event.label}</div>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: theme.text, border: `6px solid ${theme.primary}`, margin: '6px auto 24px' }} />
              <div style={{ fontSize: n > 4 ? 30 : 38, lineHeight: 1.25, color: theme.text, fontWeight: 600 }}>{event.title}</div>
            </div>
          );
        })}
      </div>
    </SafeArea>
  );
}

export function ProcessSteps({ visual, theme, frame, captions }: TemplateProps<VisualFor<'process_steps'>>) {
  return (
    <SafeArea captions={captions}>
      {visual.heading ? <Heading theme={theme} style={{ ...fadeUp(frame, 0), marginBottom: 56, textAlign: 'center' }}>{visual.heading}</Heading> : null}
      <div style={{ display: 'flex', gap: 28, alignItems: 'stretch' }}>
        {visual.steps.map((step, i) => (
          <Card key={i} theme={theme} style={{ ...fadeUp(frame, 6 + i * 10), flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ width: 72, height: 72, borderRadius: 36, background: theme.primary, color: '#FFFFFF', fontSize: 40, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {i + 1}
              </div>
              {step.icon ? <Icon id={step.icon} size={56} color={theme.accent} /> : null}
            </div>
            <div style={{ fontSize: 40, fontWeight: 700, color: theme.text, lineHeight: 1.2 }}>{step.title}</div>
            {step.description ? <div style={{ fontSize: 30, color: theme.mutedText, lineHeight: 1.35 }}>{step.description}</div> : null}
          </Card>
        ))}
      </div>
    </SafeArea>
  );
}

export function IconGrid({ visual, theme, frame, captions }: TemplateProps<VisualFor<'icon_grid'>>) {
  const columns = visual.items.length <= 3 ? visual.items.length : visual.items.length === 4 ? 2 : 3;
  return (
    <SafeArea captions={captions}>
      {visual.heading ? <Heading theme={theme} style={{ ...fadeUp(frame, 0), marginBottom: 48, textAlign: 'center' }}>{visual.heading}</Heading> : null}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 32 }}>
        {visual.items.map((item, i) => (
          <Card key={i} theme={theme} style={{ ...fadeUp(frame, 6 + i * 5), display: 'flex', alignItems: 'center', gap: 28, padding: '28px 36px' }}>
            <Icon id={item.icon} size={72} color={theme.accent} />
            <span style={{ fontSize: 40, fontWeight: 600, color: theme.text }}>{item.label}</span>
          </Card>
        ))}
      </div>
    </SafeArea>
  );
}

export function BeforeAfter({ visual, theme, frame, captions }: TemplateProps<VisualFor<'before_after'>>) {
  const column = (side: 'before' | 'after', delay: number) => {
    const data = visual[side];
    const color = side === 'before' ? theme.mutedText : theme.accent;
    return (
      <Card theme={theme} style={{ ...fadeUp(frame, delay), flex: 1, borderTop: `10px solid ${side === 'before' ? theme.mutedText : theme.primary}` }}>
        <div style={{ fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', color, fontWeight: 700 }}>{side}</div>
        <div style={{ fontSize: 52, fontWeight: 800, color: theme.text, margin: '12px 0 24px' }}>{data.title}</div>
        {data.points.map((point, i) => (
          <div key={i} style={{ ...fadeUp(frame, delay + 8 + i * 5, 20), display: 'flex', gap: 16, fontSize: 34, color: theme.text, marginBottom: 14, lineHeight: 1.3 }}>
            <Icon id={side === 'before' ? 'x' : 'check'} size={38} color={color} strokeWidth={3} />
            <span>{point}</span>
          </div>
        ))}
      </Card>
    );
  };
  return (
    <SafeArea captions={captions}>
      <div style={{ display: 'flex', gap: 48 }}>
        {column('before', 0)}
        {column('after', 14)}
      </div>
    </SafeArea>
  );
}
