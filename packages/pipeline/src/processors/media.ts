import { resolveVoiceId } from '@minkflow/ai';
import { captionsFromWords, MICRO, PRICING, SceneSchema, sceneFramesForAudio, type Scene } from '@minkflow/contracts';
import { applyToLatestRevision, extendAssetExpiry, findAssetByCacheKey, getAssets, insertAsset, linkJobArtifact, loadLatestDocument, type AssetRow } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { sha256 } from '@minkflow/shared/node';
import { storageKeys } from '@minkflow/storage';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { JobContext, Processor } from '../types';
import { assertSpendAllowed, recordUsages } from '../usage';

interface Narration {
  assetId: string;
  durationMs: number;
  words: Array<{ text: string; startMs: number; endMs: number }>;
}

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

export function narrationCacheKey(provider: string, model: string, voiceId: string, text: string): string {
  return `tts:${sha256(`${provider}\n${model}\n${voiceId}\n${text.trim()}`).slice(0, 40)}`;
}

function fromAsset(asset: AssetRow): Narration {
  const words = (asset.meta_json.words as Narration['words'] | undefined) ?? [];
  return { assetId: asset.id, durationMs: asset.duration_ms ?? 0, words };
}

async function synthesizeScene(ctx: JobContext, scene: Scene, voiceId: string, cacheKey: string, tmp: string): Promise<{ narration: Narration; chargedMicro: number }> {
  const { tts, storage, db, renderer, config } = ctx.deps;
  await assertSpendAllowed(ctx);
  const result = await tts.synthesize(scene.narration, voiceId);
  await recordUsages(ctx, [result.usage]);
  const hash = cacheKey.slice(4);
  const file = join(tmp, `${hash}.${result.extension}`);
  await writeFile(file, result.audio);
  const durationMs = await renderer.probeDurationMs(file);
  if (Math.abs(durationMs - result.alignmentEndMs) > 1500 && result.alignmentEndMs > 0) {
    ctx.log.warn('narration duration differs from alignment', { durationMs, alignmentEndMs: result.alignmentEndMs });
  }
  const key = storageKeys.narration(ctx.job.workspace_id, hash, result.extension);
  await storage.put(key, result.audio, result.mime);
  const words = result.words.map((w) => ({ ...w, endMs: Math.min(w.endMs, durationMs) }));
  let asset: AssetRow;
  try {
    asset = await insertAsset(db, {
      workspaceId: ctx.job.workspace_id,
      projectId: null,
      kind: 'narration',
      storageKey: key,
      mime: result.mime,
      size: result.audio.byteLength,
      sha256: sha256(result.audio),
      cacheKey,
      durationMs,
      meta: { words, voiceId, chars: scene.narration.length },
      provenance: { provider: tts.name, model: tts.model, voiceId, generatedAt: new Date().toISOString() },
      license: { source: tts.name === 'mock' ? 'synthetic-placeholder' : 'provider-terms (TO VERIFY V-02)' },
      expiresAt: days(config.narrationRetentionDays),
    });
  } catch (error) {
    // Another job inserted the same cache entry concurrently (unique index); reuse it.
    const existing = await findAssetByCacheKey(db, ctx.job.workspace_id, cacheKey);
    if (!existing) throw error;
    asset = existing;
  }
  const chargedMicro = Math.ceil((scene.narration.length / 1000) * PRICING.mediaCreditsPer1kChars * MICRO);
  return { narration: { assetId: asset.id, durationMs, words }, chargedMicro };
}

export const processMedia: Processor = async (ctx) => {
  const projectId = ctx.job.project_id;
  if (!projectId) throw new AppError('VALIDATION_FAILED', 'Job has no project');
  const { db, tts, config } = ctx.deps;
  const { doc } = await loadLatestDocument(db, projectId);
  if (!doc.storyboard) throw new AppError('INVALID_STATE', 'Generate a storyboard first');
  const voiceId = resolveVoiceId(doc.input.voiceId, tts.listVoices());
  if (voiceId !== doc.input.voiceId) {
    await applyToLatestRevision(db, projectId, (d) => ({ ...d, input: { ...d.input, voiceId } }));
  }
  const scenes = doc.storyboard.scenes;
  const existing = new Map((await getAssets(db, scenes.flatMap((s) => (s.voiceAssetId ? [s.voiceAssetId] : [])))).map((a) => [a.id, a]));
  const results = new Map<string, { narration: string; data: Narration }>();
  let synthesized = 0;
  let cachedHits = 0;
  const tmp = await mkdtemp(join(config.tempDir, `media-${ctx.job.id.slice(0, 8)}-`));
  try {
    for (const [i, scene] of scenes.entries()) {
      await ctx.checkpoint();
      ctx.setProgress(i / scenes.length, `narrating_scene_${i + 1}`);
      const cacheKey = narrationCacheKey(tts.name, tts.model, voiceId, scene.narration);
      const current = scene.voiceAssetId ? existing.get(scene.voiceAssetId) : undefined;
      const cached = current?.cache_key === cacheKey ? current : await findAssetByCacheKey(db, ctx.job.workspace_id, cacheKey);
      if (cached) {
        await extendAssetExpiry(db, cached.id, days(config.narrationRetentionDays));
        await recordUsages(ctx, [{ provider: tts.name, model: tts.model, operation: 'tts', quantity: scene.narration.length, unit: 'characters', estimatedUsd: 0, providerRequestId: null }], true);
        results.set(scene.id, { narration: scene.narration, data: fromAsset(cached) });
        cachedHits++;
        continue;
      }
      const { narration, chargedMicro } = await synthesizeScene(ctx, scene, voiceId, cacheKey, tmp);
      ctx.charged += chargedMicro;
      synthesized++;
      await linkJobArtifact(db, ctx.job.id, narration.assetId, 'narration');
      results.set(scene.id, { narration: scene.narration, data: narration });
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  ctx.setProgress(0.95, 'saving');
  let complete = true;
  await applyToLatestRevision(db, projectId, (d) => {
    if (!d.storyboard) throw new AppError('INVALID_STATE', 'Storyboard was removed');
    complete = true;
    d.storyboard.scenes = d.storyboard.scenes.map((s) => {
      const r = results.get(s.id);
      // Only apply narration produced for the text the scene still has (user may have edited meanwhile).
      if (!r || r.narration !== s.narration) {
        if (!s.voiceAssetId) complete = false;
        return s;
      }
      return SceneSchema.parse({ ...s, voiceAssetId: r.data.assetId, captions: captionsFromWords(r.data.words), durationFrames: sceneFramesForAudio(r.data.durationMs) });
    });
    return d;
  });
  return {
    result: { scenes: scenes.length, synthesized, cached: cachedHits, complete },
    chargedMicro: ctx.charged,
    nextStatus: complete ? 'media_ready' : 'storyboard_ready',
  };
};
