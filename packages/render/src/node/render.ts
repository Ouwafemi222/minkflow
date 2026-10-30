import { bundle } from '@remotion/bundler';
import { makeCancelSignal, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { manifestDurationFrames, RenderManifestSchema, type RenderManifest } from '@minkflow/contracts';
import { fileURLToPath } from 'node:url';
import { COMPOSITION_ID } from '../compositions';

let bundlePromise: Promise<string> | null = null;

/** Bundles the Remotion project once per process. */
export function getBundle(): Promise<string> {
  if (!bundlePromise) {
    const entryPoint = fileURLToPath(new URL('../remotion-entry.ts', import.meta.url));
    bundlePromise = bundle({ entryPoint, enableCaching: true }).catch((error: unknown) => {
      bundlePromise = null;
      throw error;
    });
  }
  return bundlePromise;
}

export interface RenderOptions {
  outputPath: string;
  /** 1 = final 1080p; 1/3 = 640x360 draft preview from the same compositions. */
  scale?: number;
  concurrency?: number;
  timeoutMs?: number;
  onProgress?: (fraction: number) => void;
  /** Return true to cancel the render. Polled during progress callbacks. */
  isCanceled?: () => boolean;
}

export async function renderManifest(input: RenderManifest, options: RenderOptions): Promise<{ durationFrames: number }> {
  const manifest = RenderManifestSchema.parse(input);
  const serveUrl = await getBundle();
  const inputProps = { manifest };
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });
  const { cancelSignal, cancel } = makeCancelSignal();
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    audioCodec: 'aac',
    pixelFormat: 'yuv420p',
    outputLocation: options.outputPath,
    inputProps,
    scale: options.scale ?? 1,
    concurrency: options.concurrency ?? null,
    timeoutInMilliseconds: options.timeoutMs ?? 60_000,
    cancelSignal,
    overwrite: true,
    onProgress: ({ progress }) => {
      options.onProgress?.(progress);
      if (options.isCanceled?.()) cancel();
    },
  });
  return { durationFrames: manifestDurationFrames(manifest) };
}

export async function renderFrameStill(input: RenderManifest, frame: number, outputPath: string): Promise<void> {
  const manifest = RenderManifestSchema.parse(input);
  const serveUrl = await getBundle();
  const inputProps = { manifest };
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });
  await renderStill({ composition, serveUrl, frame, output: outputPath, inputProps, imageFormat: 'png', overwrite: true });
}
