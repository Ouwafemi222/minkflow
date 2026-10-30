import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestDurationFrames } from '@minkflow/contracts';
import { buildFixtureManifest, FIXTURES, type FixtureName } from '../src/fixtures';
import { qcVideo, renderManifest, startStaticServer } from '../src/node';

const args = process.argv.slice(2);
const scaleArg = args.find((a) => a.startsWith('--scale='));
const scale = scaleArg ? Number(scaleArg.split('=')[1]) : 1;
const names = (args.filter((a) => !a.startsWith('--')) as FixtureName[]);
const selected: FixtureName[] = names.length > 0 ? names : ['finance60'];
for (const name of selected) if (!(name in FIXTURES)) throw new Error(`Unknown fixture ${name}. Options: ${Object.keys(FIXTURES).join(', ')}`);

const outRoot = resolve(fileURLToPath(new URL('..', import.meta.url)), 'out');
let failed = false;

for (const name of selected) {
  const dir = join(outRoot, name);
  mkdirSync(join(dir, 'audio'), { recursive: true });
  const { audio } = buildFixtureManifest(name);
  audio.forEach((wav, i) => writeFileSync(join(dir, 'audio', `scene-${i}.wav`), wav));
  const server = await startStaticServer(dir);
  try {
    const { manifest } = buildFixtureManifest(name, { audioSrc: (i) => server.url(`audio/scene-${i}.wav`), watermark: null });
    const output = join(dir, `${name}${scale === 1 ? '' : `-x${scale}`}.mp4`);
    const started = Date.now();
    let lastPct = -1;
    await renderManifest(manifest, {
      outputPath: output,
      scale,
      onProgress: (p) => {
        const pct = Math.floor(p * 10) * 10;
        if (pct !== lastPct) { lastPct = pct; process.stdout.write(`${name}: ${pct}%\n`); }
      },
    });
    const renderSeconds = (Date.now() - started) / 1000;
    const report = await qcVideo(output, {
      width: Math.round(1920 * scale),
      height: Math.round(1080 * scale),
      fps: 30,
      durationSeconds: manifestDurationFrames(manifest) / 30,
      expectAudio: true,
    });
    writeFileSync(join(dir, 'qc-report.json'), JSON.stringify({ name, renderSeconds, ...report }, null, 2));
    console.log(JSON.stringify({ name, ok: report.ok, failures: report.failures, renderSeconds, probe: report.probe, audio: report.audio }));
    if (!report.ok) failed = true;
  } finally {
    await server.close();
  }
}
process.exit(failed ? 1 : 0);
