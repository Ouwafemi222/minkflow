import type { VisualFor } from '@minkflow/contracts';
import { fadeUp, formatNumber, progress } from '../anim';
import { Card, Heading, SafeArea, type TemplateProps } from '../layout';

export function StatComparison({ visual, theme, frame, captions }: TemplateProps<VisualFor<'stat_comparison'>>) {
  return (
    <SafeArea captions={captions}>
      {visual.heading ? <Heading theme={theme} style={{ ...fadeUp(frame, 0), marginBottom: 56, textAlign: 'center' }}>{visual.heading}</Heading> : null}
      <div style={{ display: 'flex', gap: 40, justifyContent: 'center' }}>
        {visual.items.map((item, i) => {
          const p = progress(frame, 8 + i * 6, 30);
          const value = item.value * p;
          const shown = Number.isInteger(item.value) ? Math.round(value) : value;
          return (
            <Card key={i} theme={theme} style={{ ...fadeUp(frame, 6 + i * 6), flex: 1, textAlign: 'center', borderTop: `8px solid ${i === 0 ? theme.primary : theme.accent}` }}>
              <div style={{ fontSize: 112, fontWeight: 800, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>
                {item.prefix ?? ''}{formatNumber(shown)}{item.suffix ?? ''}
              </div>
              <div style={{ fontSize: 40, color: theme.mutedText, marginTop: 12 }}>{item.label}</div>
            </Card>
          );
        })}
      </div>
    </SafeArea>
  );
}

export function BarChart({ visual, theme, frame, captions }: TemplateProps<VisualFor<'bar_chart'>>) {
  const max = Math.max(...visual.bars.map((b) => b.value), 1);
  const chartHeight = captions ? 470 : 560;
  return (
    <SafeArea captions={captions}>
      <Heading theme={theme} style={{ ...fadeUp(frame, 0), marginBottom: 40 }}>
        {visual.title}
        {visual.unit ? <span style={{ fontSize: 36, color: theme.mutedText, fontWeight: 500 }}> ({visual.unit})</span> : null}
      </Heading>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, height: chartHeight, borderBottom: `4px solid ${theme.mutedText}` }}>
        {visual.bars.map((bar, i) => {
          const p = progress(frame, 10 + i * 4, 28);
          const h = (bar.value / max) * (chartHeight - 70) * p;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: theme.text, opacity: p, marginBottom: 10 }}>{formatNumber(bar.value)}</div>
              <div style={{ width: '100%', height: h, background: i % 2 === 0 ? theme.primary : theme.accent, borderRadius: '14px 14px 0 0' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 28, marginTop: 16 }}>
        {visual.bars.map((bar, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 30, color: theme.mutedText }}>{bar.label}</div>
        ))}
      </div>
    </SafeArea>
  );
}

export function LineChart({ visual, theme, frame, captions }: TemplateProps<VisualFor<'line_chart'>>) {
  const width = 1600;
  const height = captions ? 440 : 540;
  const values = visual.points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 30;
  const coords = visual.points.map((p, i) => ({
    x: pad + (i / (visual.points.length - 1)) * (width - pad * 2),
    y: pad + (1 - (p.value - min) / span) * (height - pad * 2),
  }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const length = coords.reduce((sum, c, i) => (i === 0 ? 0 : sum + Math.hypot(c.x - coords[i - 1]!.x, c.y - coords[i - 1]!.y)), 0);
  const draw = progress(frame, 10, 45);
  return (
    <SafeArea captions={captions}>
      <Heading theme={theme} style={{ ...fadeUp(frame, 0), marginBottom: 32 }}>
        {visual.title}
        {visual.unit ? <span style={{ fontSize: 36, color: theme.mutedText, fontWeight: 500 }}> ({visual.unit})</span> : null}
      </Heading>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke={theme.mutedText} strokeWidth={3} />
        <path d={path} fill="none" stroke={theme.primary} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={length} strokeDashoffset={length * (1 - draw)} />
        {coords.map((c, i) => {
          const visible = draw >= i / (coords.length - 1) ? 1 : 0;
          return <circle key={i} cx={c.x} cy={c.y} r={14} fill={theme.accent} opacity={visible} />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', width, marginTop: 12 }}>
        {visual.points.map((p, i) => (
          <span key={i} style={{ fontSize: 28, color: theme.mutedText, width: 120, textAlign: 'center' }}>{p.label}</span>
        ))}
      </div>
    </SafeArea>
  );
}
