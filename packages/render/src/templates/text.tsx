import type { VisualFor } from '@minkflow/contracts';
import { enter, fadeUp, progress } from '../anim';
import { Icon } from '../icons';
import { SafeArea, type TemplateProps } from '../layout';

export function TitleReveal({ visual, theme, frame, captions }: TemplateProps<VisualFor<'title_reveal'>>) {
  const bar = progress(frame, 10, 20);
  return (
    <SafeArea captions={captions} style={{ alignItems: 'center', textAlign: 'center' }}>
      {visual.icon ? (
        <div style={{ ...fadeUp(frame, 0), marginBottom: 36, background: theme.surface, borderRadius: 40, padding: 32 }}>
          <Icon id={visual.icon} size={120} color={theme.accent} />
        </div>
      ) : null}
      <h1 style={{ ...fadeUp(frame, 4), margin: 0, fontSize: 104, lineHeight: 1.08, fontWeight: 800, color: theme.text, letterSpacing: -2, maxWidth: 1500 }}>
        {visual.title}
      </h1>
      <div style={{ height: 10, width: 260 * bar, background: theme.primary, borderRadius: 5, margin: '36px auto' }} />
      {visual.subtitle ? (
        <p style={{ ...fadeUp(frame, 14), margin: 0, fontSize: 44, lineHeight: 1.3, color: theme.mutedText, maxWidth: 1300 }}>
          {visual.subtitle}
        </p>
      ) : null}
    </SafeArea>
  );
}

export function QuoteFocus({ visual, theme, frame, captions }: TemplateProps<VisualFor<'quote_focus'>>) {
  return (
    <SafeArea captions={captions} style={{ alignItems: 'center', textAlign: 'center' }}>
      <div style={{ ...fadeUp(frame, 0), fontSize: 220, lineHeight: 0.6, color: theme.primary, fontWeight: 800, height: 120 }}>“</div>
      <blockquote style={{ ...fadeUp(frame, 6), margin: 0, fontSize: visual.quote.length > 120 ? 56 : 72, lineHeight: 1.25, fontWeight: 600, color: theme.text, maxWidth: 1450 }}>
        {visual.quote}
      </blockquote>
      {visual.attribution ? (
        <p style={{ ...fadeUp(frame, 16), marginTop: 40, fontSize: 38, color: theme.accent, fontWeight: 600 }}>— {visual.attribution}</p>
      ) : null}
    </SafeArea>
  );
}

export function ClosingCta({ visual, theme, frame, captions }: TemplateProps<VisualFor<'closing_cta'>>) {
  const pulse = 1 + 0.03 * Math.sin((frame / 30) * Math.PI * 2) * enter(frame, 20);
  return (
    <SafeArea captions={captions} style={{ alignItems: 'center', textAlign: 'center' }}>
      <h2 style={{ ...fadeUp(frame, 0), margin: 0, fontSize: 92, lineHeight: 1.1, fontWeight: 800, color: theme.text, maxWidth: 1500 }}>
        {visual.headline}
      </h2>
      <div
        style={{
          ...fadeUp(frame, 10),
          marginTop: 56,
          padding: '28px 64px',
          borderRadius: 999,
          background: theme.primary,
          color: '#FFFFFF',
          fontSize: 52,
          fontWeight: 700,
          transform: `${fadeUp(frame, 10).transform} scale(${pulse})`,
        }}
      >
        {visual.cta}
      </div>
      {visual.handle ? <p style={{ ...fadeUp(frame, 18), marginTop: 36, fontSize: 40, color: theme.mutedText }}>{visual.handle}</p> : null}
    </SafeArea>
  );
}
