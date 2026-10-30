import { brand } from '@minkflow/brand';
import { manifestDurationFrames, MICRO, PRICING, RenderManifestSchema, VIDEO, type RenderManifest } from '@minkflow/contracts';
import { getAssets, hasSuccessfulPayment, insertAsset, linkJobArtifact, loadRevisionDocument } from '@minkflow/db';
import { startStaticServer } from '@minkflow/render/node';
import { AppError } from '@minkflow/shared';
import { sha256 } from '@minkflow/shared/node';
import { storageKeys } from '@minkflow/storage';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { JobContext, ProcessorResult } from '../types';

const EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const PREVIEW_SCALE = 1 / 3;

async function renderVideo(ctx: JobContext, kind: 'preview' | 'render'): Promise<ProcessorResult> {
  const { db, storage, renderer, config } = ctx.deps;
  const { job } = ctx;
  if (!job.project_id || !job.revision_id) throw new AppError('VALIDATION_FAILED', 'Render job needs a project revision');
  const { doc } = await loadRevisionDocument(db, job.revision_id);
  const scenes = doc.storyboard?.scenes ?? [];
  if (scenes.length === 0) throw new AppError('INVALID_STATE', 'Nothing to render');
  if (scenes.some((s) => !s.voiceAssetId)) throw new AppError('INVALID_STATE', 'Generate narration for every scene before rendering');

  const assetIds = [...scenes.map((s) => s.voiceAssetId!), ...(doc.brand.logoAssetId ? [doc.brand.logoAssetId] : [])];
  const assets = new Map((await getAssets(db, assetIds)).map((a) => [a.id, a]));
  for (const id of assetIds) {
    const asset = assets.get(id);
    if (!asset || asset.workspace_id !== job.workspace_id) throw new AppError('INVALID_STATE', 'A narration or logo file has expired. Regenerate media and try again.');
  }

  const tmp = await mkdtemp(join(config.tempDir, `${kind}-${job.id.slice(0, 8)}-`));
  const server = await startStaticServer(tmp);
  try {
    ctx.setProgress(0.02, 'fetching_assets');
    const files = new Map<string, string>();
    for (const id of new Set(assetIds)) {
      const asset = assets.get(id)!;
      const name = `${asset.id}.${EXT[asset.mime] ?? 'bin'}`;
      await writeFile(join(tmp, name), await storage.get(asset.storage_key));
      files.set(id, server.url(name));
    }
    await ctx.checkpoint();

    const watermark = (await hasSuccessfulPayment(db, job.workspace_id)) ? null : brand.watermarkLabel();
    const logoSrc = doc.brand.logoAssetId ? files.get(doc.brand.logoAssetId)! : null;
    const manifest: RenderManifest = RenderManifestSchema.parse({
      manifestVersion: 1,
      projectId: job.project_id,
      revisionId: job.revision_id,
      fps: VIDEO.fps,
      width: VIDEO.width,
      height: VIDEO.height,
      theme: doc.brand.theme,
      captionsEnabled: doc.brand.captionsEnabled,
      watermark,
      scenes: scenes.map((scene) => ({
        scene,
        audio: { src: files.get(scene.voiceAssetId!)!, durationMs: assets.get(scene.voiceAssetId!)!.duration_ms ?? 1 },
        logoSrc,
      })),
    });
    const durationSeconds = manifestDurationFrames(manifest) / VIDEO.fps;
    const scale = kind === 'preview' ? PREVIEW_SCALE : 1;
    const output = join(tmp, `${kind}.mp4`);

    ctx.setProgress(0.05, 'rendering');
    try {
      await renderer.render(manifest, {
        outputPath: output,
        scale,
        onProgress: (f) => ctx.setProgress(0.05 + f * 0.8, 'rendering'),
        isCanceled: () => ctx.isCanceled(),
      });
    } catch (error) {
      await ctx.checkpoint();
      throw new AppError('RENDER_FAILED', undefined, { cause: error instanceof Error ? error.message.slice(0, 300) : String(error) });
    }
    await ctx.checkpoint();

    ctx.setProgress(0.88, 'quality_check');
    const qc = await renderer.qc(output, {
      width: Math.round(VIDEO.width * scale),
      height: Math.round(VIDEO.height * scale),
      fps: VIDEO.fps,
      durationSeconds,
      expectAudio: true,
    });
    if (!qc.ok) {
      ctx.log.error('render QC failed', { failures: qc.failures });
      throw new AppError('RENDER_QC_FAILED', undefined, { failures: qc.failures });
    }

    // Publish only after QC passes: upload to an immutable per-job key, then register the asset.
    ctx.setProgress(0.94, 'publishing');
    const bytes = await readFile(output);
    const key = kind === 'preview' ? storageKeys.preview(job.workspace_id, job.project_id, job.revision_id, job.id) : storageKeys.render(job.workspace_id, job.project_id, job.revision_id, job.id);
    await storage.put(key, bytes, 'video/mp4');
    const retentionDays = kind === 'preview' ? config.previewRetentionDays : config.renderRetentionDays;
    const asset = await insertAsset(db, {
      workspaceId: job.workspace_id,
      projectId: job.project_id,
      kind,
      storageKey: key,
      mime: 'video/mp4',
      size: bytes.byteLength,
      sha256: sha256(bytes),
      durationMs: Math.round(durationSeconds * 1000),
      meta: { watermark: Boolean(watermark), scale, probe: qc.probe, audio: qc.audio },
      provenance: { revisionId: job.revision_id, jobId: job.id, renderer: 'remotion@4.0.539' },
      expiresAt: new Date(Date.now() + retentionDays * 86_400_000),
    });
    await linkJobArtifact(db, job.id, asset.id, 'output');
    const rate = kind === 'preview' ? PRICING.previewCreditsPerSecond : PRICING.renderCreditsPerSecond;
    return {
      result: { assetId: asset.id, durationSeconds, watermark: Boolean(watermark), sizeBytes: bytes.byteLength },
      chargedMicro: Math.ceil(durationSeconds * rate * MICRO),
    };
  } finally {
    await server.close();
    await rm(tmp, { recursive: true, force: true });
  }
}

export const processPreview = (ctx: JobContext) => renderVideo(ctx, 'preview');
export const processRender = (ctx: JobContext) => renderVideo(ctx, 'render');
