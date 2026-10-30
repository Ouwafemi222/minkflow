import { RenderInternals } from '@remotion/renderer';
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { delimiter, dirname, isAbsolute } from 'node:path';

export interface QcExpectations {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  expectAudio: boolean;
  /** Silence longer than this (seconds) is a failure when narration is expected. */
  maxSilenceSeconds?: number;
  /** Uniform (blank/black) frames lasting longer than this (seconds) fail QC. */
  maxBlankSeconds?: number;
}

export interface QcReport {
  ok: boolean;
  failures: string[];
  probe: { width?: number; height?: number; fps?: number; durationSeconds?: number; videoCodec?: string; audioCodec?: string | null; sizeBytes: number };
  blankSegments: Array<{ start: number; end: number }>;
  silentSegments: Array<{ start: number; end: number }>;
  audio: { rmsDbfs: number; peakDbfs: number; clippedSamples: number } | null;
}

const SAMPLE_FPS = 4;
const THUMB_W = 64;
const THUMB_H = 36;
const AUDIO_RATE = 8000;

/** Spawns Remotion's bundled ffmpeg/ffprobe (binary-safe stdout). Paths passed in args must be absolute. */
function runFf(bin: 'ffmpeg' | 'ffprobe', args: string[]): Promise<{ stdout: Buffer; stderr: string }> {
  const executable = RenderInternals.getExecutablePath({ type: bin, indent: false, logLevel: 'error', binariesDirectory: null });
  const cwd = dirname(executable);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: { ...process.env, LD_LIBRARY_PATH: cwd, PATH: `${cwd}${delimiter}${process.env.PATH ?? ''}` },
    });
    const out: Buffer[] = [];
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => { err += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code: number | null) => {
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr: err });
      else reject(new Error(`${bin} exited with ${code}: ${err.slice(-2000)}`));
    });
  });
}

function parseRate(rate: string | undefined): number | undefined {
  if (!rate) return undefined;
  const [n, d] = rate.split('/').map(Number);
  return n && d ? n / d : undefined;
}

export function parseIntervals(stderr: string, startKey: string, endKey: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  let pending: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const s = new RegExp(`${startKey}[:=]\\s*(-?[\\d.]+)`).exec(line);
    const e = new RegExp(`${endKey}[:=]\\s*(-?[\\d.]+)`).exec(line);
    if (s && !e) pending = Number(s[1]);
    if (e) {
      const start = s ? Number(s[1]) : pending;
      if (start !== null) out.push({ start, end: Number(e[1]) });
      pending = null;
    }
  }
  return out;
}

/** Finds runs of uniform frames (std-dev of luma below threshold): black screens or missing content. */
export function findBlankRuns(gray: Uint8Array, frameSize: number, sampleFps: number, minSeconds: number): Array<{ start: number; end: number }> {
  const frames = Math.floor(gray.length / frameSize);
  const runs: Array<{ start: number; end: number }> = [];
  let runStart = -1;
  for (let f = 0; f <= frames; f++) {
    let blank = false;
    if (f < frames) {
      let sum = 0;
      let sumSq = 0;
      for (let i = f * frameSize; i < (f + 1) * frameSize; i++) {
        const v = gray[i]!;
        sum += v;
        sumSq += v * v;
      }
      const mean = sum / frameSize;
      blank = Math.sqrt(Math.max(0, sumSq / frameSize - mean * mean)) < 2;
    }
    if (blank && runStart < 0) runStart = f;
    if (!blank && runStart >= 0) {
      const duration = (f - runStart) / sampleFps;
      if (duration >= minSeconds) runs.push({ start: runStart / sampleFps, end: f / sampleFps });
      runStart = -1;
    }
  }
  return runs;
}

export function audioLevels(pcm: Int16Array): { rmsDbfs: number; peakDbfs: number; clippedSamples: number } {
  let sumSq = 0;
  let peak = 0;
  let clipped = 0;
  for (const s of pcm) {
    const a = Math.abs(s);
    sumSq += s * s;
    if (a > peak) peak = a;
    if (a >= 32760) clipped++;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, pcm.length));
  const db = (v: number) => (v <= 0 ? -120 : 20 * Math.log10(v / 32768));
  return { rmsDbfs: +db(rms).toFixed(1), peakDbfs: +db(peak).toFixed(1), clippedSamples: clipped };
}

/** Validates a rendered MP4: codec/dimensions/fps/duration/audio, blank frames, silence, levels and clipping. */
export async function qcVideo(path: string, expect: QcExpectations): Promise<QcReport> {
  if (!isAbsolute(path)) throw new Error(`qcVideo requires an absolute path, got ${path}`);
  const failures: string[] = [];
  const sizeBytes = statSync(path).size;
  if (sizeBytes <= 0) failures.push('Output file is empty');

  const { stdout } = await runFf('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', path]);
  const probeJson = JSON.parse(stdout.toString()) as {
    streams: Array<{ codec_type: string; codec_name: string; width?: number; height?: number; avg_frame_rate?: string }>;
    format: { duration?: string };
  };
  const video = probeJson.streams.find((s) => s.codec_type === 'video');
  const audio = probeJson.streams.find((s) => s.codec_type === 'audio');
  const probe = {
    width: video?.width,
    height: video?.height,
    fps: parseRate(video?.avg_frame_rate),
    durationSeconds: probeJson.format.duration ? Number(probeJson.format.duration) : undefined,
    videoCodec: video?.codec_name,
    audioCodec: audio?.codec_name ?? null,
    sizeBytes,
  };
  if (!video) failures.push('No video stream');
  if (video && video.codec_name !== 'h264') failures.push(`Unexpected video codec ${video.codec_name}`);
  if (probe.width !== expect.width || probe.height !== expect.height) failures.push(`Dimensions ${probe.width}x${probe.height} != ${expect.width}x${expect.height}`);
  if (!probe.fps || Math.abs(probe.fps - expect.fps) > 0.01) failures.push(`FPS ${probe.fps} != ${expect.fps}`);
  if (probe.durationSeconds === undefined || Math.abs(probe.durationSeconds - expect.durationSeconds) > 0.25) {
    failures.push(`Duration ${probe.durationSeconds}s != expected ${expect.durationSeconds.toFixed(2)}s`);
  }
  if (expect.expectAudio && !audio) failures.push('Missing audio stream');
  if (expect.expectAudio && audio && audio.codec_name !== 'aac') failures.push(`Unexpected audio codec ${audio.codec_name}`);

  const frames = await runFf('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', '-i', path, '-an', '-vf', `scale=${THUMB_W}:${THUMB_H}`, '-r', String(SAMPLE_FPS), '-pix_fmt', 'gray', '-c:v', 'rawvideo', '-f', 'image2pipe', 'pipe:1']);
  const blankSegments = findBlankRuns(new Uint8Array(frames.stdout), THUMB_W * THUMB_H, SAMPLE_FPS, expect.maxBlankSeconds ?? 0.75);
  if (blankSegments.length > 0) failures.push(`Detected ${blankSegments.length} blank/black segment(s)`);

  let silentSegments: Array<{ start: number; end: number }> = [];
  let levels: QcReport['audio'] = null;
  if (audio) {
    const maxSilence = expect.maxSilenceSeconds ?? 3;
    const pcm = await runFf('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-vn', '-af', `silencedetect=n=-50dB:d=${maxSilence}`, '-ac', '1', '-ar', String(AUDIO_RATE), '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1']);
    silentSegments = parseIntervals(pcm.stderr, 'silence_start', 'silence_end');
    if (expect.expectAudio && silentSegments.length > 0) failures.push(`Detected ${silentSegments.length} silence(s) longer than ${maxSilence}s`);
    const dataStart = pcm.stdout.indexOf('data') + 8;
    const body = pcm.stdout.subarray(dataStart);
    const aligned = Buffer.from(body.subarray(0, body.byteLength - (body.byteLength % 2)));
    const samples = new Int16Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / 2);
    levels = audioLevels(samples);
    if (expect.expectAudio && levels.rmsDbfs < -45) failures.push(`Audio too quiet (${levels.rmsDbfs} dBFS RMS)`);
    if (levels.clippedSamples > AUDIO_RATE * 0.01) failures.push(`Audio clipping detected (${levels.clippedSamples} samples)`);
  }

  return { ok: failures.length === 0, failures, probe, blankSegments, silentSegments, audio: levels };
}
