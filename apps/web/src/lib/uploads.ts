import 'server-only';
import { insertAsset, type AssetRow } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { sha256 } from '@minkflow/shared/node';
import { sniffImageMime } from '@minkflow/storage';
import type { ApiContext } from './api';
import { db, storage } from './services';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Verifies an image the user PUT to a signed URL from /api/assets/upload-url (own workspace prefix, size, magic
 * bytes; SVG never accepted, ADR-012) and registers it as an asset. Rejected files are deleted.
 */
export async function registerImageUpload(
  ctx: ApiContext,
  key: string,
  asset: { kind: 'logo' | 'upload'; license: Record<string, unknown> },
): Promise<AssetRow> {
  const ws = await ctx.workspace();
  if (!key.startsWith(`ws/${ws.id}/uploads/`)) throw new AppError('FORBIDDEN');
  const head = await storage().head(key);
  if (!head || head.size <= 0 || head.size > MAX_IMAGE_BYTES) throw new AppError('UNSUPPORTED_UPLOAD');
  const bytes = await storage().get(key);
  const mime = sniffImageMime(bytes);
  if (!mime) {
    await storage().delete(key);
    throw new AppError('UNSUPPORTED_UPLOAD', 'Upload a PNG, JPEG or WebP image (max 2 MB).');
  }
  return insertAsset(db(), {
    workspaceId: ws.id,
    projectId: null,
    kind: asset.kind,
    storageKey: key,
    mime,
    size: bytes.byteLength,
    sha256: sha256(bytes),
    provenance: { source: 'user_upload', uploadedBy: ctx.session.userId },
    license: asset.license,
  });
}
