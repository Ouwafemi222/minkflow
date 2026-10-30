import { insertAsset } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { sha256 } from '@minkflow/shared/node';
import { sniffImageMime } from '@minkflow/storage';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';
import { db, storage } from '@/lib/services';

const MAX = 2 * 1024 * 1024;

/** Verifies an uploaded logo (owner prefix, size, magic bytes) and registers it as an asset. */
export const POST = authed(
  async (ctx) => {
    const { key } = await readJson(ctx.req, z.object({ key: z.string().min(10).max(300) }));
    const ws = await ctx.workspace();
    if (!key.startsWith(`ws/${ws.id}/uploads/`)) throw new AppError('FORBIDDEN');
    const head = await storage().head(key);
    if (!head || head.size <= 0 || head.size > MAX) throw new AppError('UNSUPPORTED_UPLOAD');
    const bytes = await storage().get(key);
    const mime = sniffImageMime(bytes);
    if (!mime) {
      await storage().delete(key);
      throw new AppError('UNSUPPORTED_UPLOAD', 'Upload a PNG, JPEG or WebP image (max 2 MB).');
    }
    const asset = await insertAsset(db(), {
      workspaceId: ws.id,
      projectId: null,
      kind: 'logo',
      storageKey: key,
      mime,
      size: bytes.byteLength,
      sha256: sha256(bytes),
      provenance: { source: 'user_upload', uploadedBy: ctx.session.userId },
      license: { declaredBy: 'user', note: 'User confirms they have rights to this logo (Terms §Content).' },
    });
    return { asset: { id: asset.id, mime: asset.mime, size: asset.size } };
  },
  { rateLimit: { key: 'upload', perMinute: 10 } },
);
