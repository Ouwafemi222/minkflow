import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import { continueRender, delayRender } from 'remotion';

/** Fonts are bundled locally (no network during render). Block frame capture until they are loaded. */
export function waitForFonts(): void {
  if (typeof document === 'undefined') return;
  const handle = delayRender('Loading bundled fonts');
  const families = ['Inter', 'Poppins'];
  const weights = [400, 600, 700, 800];
  Promise.all(families.flatMap((f) => weights.map((w) => document.fonts.load(`${w} 48px ${f}`))))
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
}
