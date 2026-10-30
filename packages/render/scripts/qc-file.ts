import { resolve } from 'node:path';
import { qcVideo } from '../src/node';

const [file, seconds, ...flags] = process.argv.slice(2);
if (!file || !seconds) {
  console.error('Usage: tsx scripts/qc-file.ts <video.mp4> <expectedSeconds> [--no-audio] [--scale=0.333]');
  process.exit(2);
}
const scale = Number(flags.find((f) => f.startsWith('--scale='))?.split('=')[1] ?? 1);
const report = await qcVideo(resolve(file), {
  width: Math.round(1920 * scale),
  height: Math.round(1080 * scale),
  fps: 30,
  durationSeconds: Number(seconds),
  expectAudio: !flags.includes('--no-audio'),
});
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
