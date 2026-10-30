import { probeMediaDurationMs, qcVideo, renderManifest } from '@minkflow/render/node';
import type { Renderer } from './types';

export function createRemotionRenderer(options: { concurrency: number | null; timeoutMs?: number }): Renderer {
  return {
    async render(manifest, { outputPath, scale, onProgress, isCanceled }) {
      await renderManifest(manifest, { outputPath, scale, concurrency: options.concurrency ?? undefined, timeoutMs: options.timeoutMs ?? 120_000, onProgress, isCanceled });
    },
    qc: qcVideo,
    probeDurationMs: probeMediaDurationMs,
  };
}
