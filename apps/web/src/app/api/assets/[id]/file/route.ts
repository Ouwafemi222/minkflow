import { getAsset } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed } from '@/lib/api';
import { readStoredObject, streamStoredObject } from '@/lib/media-stream';

/** Same-origin stream for narration/logos so the in-browser preview can play without a signed-URL redirect. */
export const GET = authed<{ id: string }>(async (ctx, { id }) => {
  const asset = await ctx.asUser((tx) => getAsset(tx, z.uuid().parse(id)));
  if (asset.expires_at && new Date(asset.expires_at) < new Date()) throw new AppError('NOT_FOUND', 'This file has expired.');
  const body = await readStoredObject(asset.storage_key);
  return streamStoredObject(ctx.req, body, { mime: asset.mime, inline: true, key: asset.storage_key });
});
