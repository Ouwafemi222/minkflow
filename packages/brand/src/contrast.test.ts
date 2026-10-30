import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio, palette } from './index';

const AA_TEXT = 4.5;
const AA_UI = 3;

function tokens(selector: ':root' | "[data-studio-theme='dark']"): Record<string, string> {
  const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) {
    out[match[1]!] = match[2]!;
  }
  return out;
}

describe('brand palette contrast (WCAG AA)', () => {
  it('white text on primary button meets large-text/UI contrast and strong variant meets body text', () => {
    expect(contrastRatio(palette.white, palette.primary)).toBeGreaterThanOrEqual(AA_UI);
    expect(contrastRatio(palette.white, palette.primaryStrong)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('cyan is never used as text on white', () => {
    expect(contrastRatio(palette.cyan, palette.white)).toBeLessThan(AA_TEXT);
  });

  for (const theme of [':root', "[data-studio-theme='dark']"] as const) {
    it(`${theme}: text tokens are readable on page and card surfaces`, () => {
      const light = tokens(':root');
      const t = { ...light, ...tokens(theme) };
      for (const text of ['text-primary', 'text-secondary', 'text-muted', 'text-link']) {
        for (const surface of ['surface-page', 'surface-card']) {
          expect(contrastRatio(t[text]!, t[surface]!), `${text} on ${surface}`).toBeGreaterThanOrEqual(AA_TEXT);
        }
      }
      for (const state of ['state-success', 'state-warning', 'state-error', 'state-info']) {
        expect(contrastRatio(t[state]!, t[`${state}-bg`]!), state).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });
  }
});
