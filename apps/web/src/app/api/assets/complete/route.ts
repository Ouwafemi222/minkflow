import { z } from 'zod';
import { authed, readJson } from '@/lib/api';
import { registerImageUpload } from '@/lib/uploads';

/** Verifies an uploaded logo (owner prefix, size, magic bytes) and registers it as an asset. */
export const POST = authed(
  async (ctx) => {
    const { key } = await readJson(ctx.req, z.object({ key: z.string().min(10).max(300) }));
    const asset = await registerImageUpload(ctx, key, {
      kind: 'logo',
      license: { declaredBy: 'user', note: 'User confirms they have rights to this logo (Terms §Content).' },
    });
    return { asset: { id: asset.id, mime: asset.mime, size: asset.size } };
  },
  { rateLimit: { key: 'upload', perMinute: 10 } },
);
