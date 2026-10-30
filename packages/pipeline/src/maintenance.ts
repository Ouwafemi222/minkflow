import { expiredAssets, markAssetsDeleted, purgeDeletedProjects, reconcileProjectStatuses, sweepStuckJobs } from '@minkflow/db';
import type { PipelineDeps } from './types';

/**
 * Retention (ADR-011): deletes expired files (final MP4 30d, previews 7d, narration 30d after last use) and
 * soft-deleted projects after 7 days. Storage is deleted before rows are marked, so a crash only re-tries.
 */
export async function runRetentionSweep(deps: Pick<PipelineDeps, 'db' | 'storage' | 'logger'>, maxBatches = 20): Promise<{ assets: number; projects: number }> {
  let total = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const assets = await expiredAssets(deps.db, 200);
    if (assets.length === 0) break;
    const deleted: string[] = [];
    for (const asset of assets) {
      try {
        await deps.storage.delete(asset.storage_key);
        deleted.push(asset.id);
      } catch (error) {
        deps.logger.warn('retention: storage delete failed', { assetId: asset.id, error: String(error) });
      }
    }
    await markAssetsDeleted(deps.db, deleted);
    total += deleted.length;
    if (deleted.length === 0) break;
  }
  const projects = await purgeDeletedProjects(deps.db);
  if (total || projects) deps.logger.info('retention sweep', { assets: total, projects });
  return { assets: total, projects };
}

/** Recovers jobs whose worker died (lease expired) and un-sticks project statuses. */
export async function runJobMaintenance(deps: Pick<PipelineDeps, 'db' | 'logger'>): Promise<{ swept: number; reconciled: number }> {
  const swept = await sweepStuckJobs(deps.db);
  const reconciled = await reconcileProjectStatuses(deps.db);
  if (swept || reconciled) deps.logger.warn('job maintenance', { swept, reconciled });
  return { swept, reconciled };
}
