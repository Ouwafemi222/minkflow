import type { CSSProperties, ReactNode } from 'react';
import type { Theme } from '@minkflow/contracts';

/** Title-safe area: 6% horizontal, 7% vertical; bottom reserves caption band when captions are on. */
export const SAFE = { x: 120, top: 80, bottomWithCaptions: 230, bottomNoCaptions: 90 } as const;

export interface TemplateProps<V> {
  visual: V;
  theme: Theme;
  frame: number;
  durationInFrames: number;
  captions: boolean;
}

export function SafeArea({ children, captions, style }: { children: ReactNode; captions: boolean; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE.x,
        right: SAFE.x,
        top: SAFE.top,
        bottom: captions ? SAFE.bottomWithCaptions : SAFE.bottomNoCaptions,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Heading({ theme, children, style }: { theme: Theme; children: ReactNode; style?: CSSProperties }) {
  return (
    <h2 style={{ margin: 0, fontSize: 64, lineHeight: 1.15, fontWeight: 700, color: theme.text, letterSpacing: -1, ...style }}>
      {children}
    </h2>
  );
}

export function Card({ theme, children, style }: { theme: Theme; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: theme.surface, borderRadius: 28, padding: '36px 40px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', ...style }}>
      {children}
    </div>
  );
}
