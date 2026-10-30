import type { CSSProperties } from 'react';
import { Easing, interpolate, spring } from 'remotion';
import type { Transition } from '@minkflow/contracts';

export const FPS = 30;

/** 0 -> 1 eased entrance starting at `delay` frames. Deterministic; no randomness. */
export function enter(frame: number, delay = 0, durationInFrames = 18): number {
  return spring({ frame: frame - delay, fps: FPS, durationInFrames, config: { damping: 200 } });
}

export function fadeUp(frame: number, delay = 0, distance = 40): CSSProperties {
  const p = enter(frame, delay);
  return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` };
}

export function progress(frame: number, start: number, length: number): number {
  return interpolate(frame, [start, start + length], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

const ENTER_FRAMES = 12;
const EXIT_FRAMES = 8;

/** Scene-level in/out transition applied by the composition wrapper. */
export function transitionStyle(transition: Transition, frame: number, durationInFrames: number): CSSProperties {
  if (transition === 'none') return {};
  const inP = progress(frame, 0, ENTER_FRAMES);
  const outP = 1 - progress(frame, durationInFrames - EXIT_FRAMES, EXIT_FRAMES);
  const opacity = Math.min(inP, outP);
  switch (transition) {
    case 'fade':
      return { opacity };
    case 'slide_left':
      return { opacity, transform: `translateX(${(1 - inP) * 120}px)` };
    case 'slide_up':
      return { opacity, transform: `translateY(${(1 - inP) * 80}px)` };
    case 'zoom':
      return { opacity, transform: `scale(${0.94 + 0.06 * inP})` };
  }
}

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${+(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 10_000) return `${+(value / 1_000).toFixed(1)}K`;
  return Number.isInteger(value) ? value.toLocaleString('en-US') : value.toFixed(1);
}
