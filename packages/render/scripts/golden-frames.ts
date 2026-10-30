import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { sceneOffsets, THEME_PRESETS, type RenderManifest } from '@minkflow/contracts';
import { buildFixtureManifest } from '../src/fixtures';
import { renderFrameStill } from '../src/node';

/**
 * Golden-frame visual regression: every template at intro/middle/outro, plus a Poppins/warm theme variant.
 * `--update` rewrites goldens. Goldens are per-platform because font rasterization differs by OS.
 */
const update = process.argv.includes('--update');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const goldenDir = join(root, 'golden', process.platform);
const outDir = join(root, 'out', 'stills');
mkdirSync(goldenDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

interface Shot { name: string; manifest: RenderManifest; frame: number }
const shots: Shot[] = [];

function addTemplateShots(manifest: RenderManifest, suffix: string, positions: Array<'intro' | 'middle' | 'outro'>) {
  const offsets = sceneOffsets(manifest.scenes.map((s) => s.scene.durationFrames));
  const seen = new Set<string>();
  manifest.scenes.forEach(({ scene }, i) => {
    if (seen.has(scene.template)) return;
    seen.add(scene.template);
    const at = { intro: 14, middle: Math.floor(scene.durationFrames / 2), outro: scene.durationFrames - 12 };
    for (const pos of positions) shots.push({ name: `${scene.template}-${pos}${suffix}`, manifest, frame: offsets[i]! + at[pos] });
  });
}

addTemplateShots(buildFixtureManifest('tech5min').manifest, '', ['intro', 'middle', 'outro']);
addTemplateShots(buildFixtureManifest('finance60', { theme: THEME_PRESETS.warm_studio }).manifest, '-poppins', ['middle']);
addTemplateShots(buildFixtureManifest('longCaptions', { theme: THEME_PRESETS.paper_light }).manifest, '-longtext-light', ['middle']);

const MAX_DIFF_RATIO = 0.005;
const failures: string[] = [];
for (const shot of shots) {
  const actualPath = join(outDir, `${shot.name}.png`);
  await renderFrameStill(shot.manifest, shot.frame, actualPath);
  const goldenPath = join(goldenDir, `${shot.name}.png`);
  if (update || !existsSync(goldenPath)) {
    writeFileSync(goldenPath, readFileSync(actualPath));
    console.log(`${update ? 'updated' : 'created'} ${shot.name}`);
    continue;
  }
  const a = PNG.sync.read(readFileSync(actualPath));
  const g = PNG.sync.read(readFileSync(goldenPath));
  if (a.width !== g.width || a.height !== g.height) {
    failures.push(`${shot.name}: size mismatch`);
    continue;
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, g.data, diff.data, a.width, a.height, { threshold: 0.1 });
  const ratio = changed / (a.width * a.height);
  if (ratio > MAX_DIFF_RATIO) {
    writeFileSync(join(outDir, `${shot.name}.diff.png`), PNG.sync.write(diff));
    failures.push(`${shot.name}: ${(ratio * 100).toFixed(2)}% pixels differ`);
  } else {
    console.log(`ok ${shot.name} (${(ratio * 100).toFixed(3)}%)`);
  }
}
if (failures.length > 0) {
  console.error(`Golden-frame failures:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`${shots.length} golden frames checked`);
