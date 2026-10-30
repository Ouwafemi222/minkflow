import { updateMyProfile } from '@minkflow/db';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';
import { registerImageUpload } from '@/lib/uploads';

/** Verifies an uploaded profile photo (see /api/assets/upload-url) and makes it the user's avatar. */
export const POST = authed(
  async (ctx) => {
    const { key } = await readJson(ctx.req, z.object({ key: z.string().min(10).max(300) }));
    const asset = await registerImageUpload(ctx, key, {
      kind: 'upload',
      license: { declaredBy: 'user', note: 'Profile photo uploaded by the account owner.' },
    });
    await ctx.asUser((tx) => updateMyProfile(tx, { avatarMode: 'upload', avatarAssetId: asset.id }));
    return { ok: true };
  },
  { rateLimit: { key: 'upload', perMinute: 10 } },
);
