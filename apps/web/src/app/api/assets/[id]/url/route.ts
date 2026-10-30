import { getAsset } from '@minkflow/db';
import { z } from 'zod';
import { authed } from '@/lib/api';
import { env } from '@/lib/env';
import { storage } from '@/lib/services';

/** Signed URL for an asset the user can read through RLS (narration for the editor preview, logos). */
export const GET = authed<{ id: string }>(async (ctx, { id }) => {
  const asset = await ctx.asUser((tx) => getAsset(tx, z.uuid().parse(id)));
  const url = await storage().signedGetUrl(asset.storage_key, { ttlSeconds: env().SIGNED_URL_TTL_SECONDS });
  return { url, mime: asset.mime, durationMs: asset.duration_ms, expiresInSeconds: env().SIGNED_URL_TTL_SECONDS };
});
