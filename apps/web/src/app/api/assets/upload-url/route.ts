import { storageKeys } from '@minkflow/storage';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';
import { storage } from '@/lib/services';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;

/** Signed PUT for a logo upload. SVG is not accepted (ADR-012); type is re-checked from magic bytes on completion. */
export const POST = authed(
  async (ctx) => {
    const body = await readJson(ctx.req, z.object({ contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']), size: z.number().int().min(1).max(MAX_LOGO_BYTES) }));
    const ws = await ctx.workspace();
    const key = storageKeys.upload(ws.id, crypto.randomUUID(), TYPES[body.contentType]);
    const url = await storage().signedPutUrl(key, body.contentType, { ttlSeconds: 300, maxBytes: MAX_LOGO_BYTES });
    return { key, url, method: 'PUT', headers: { 'Content-Type': body.contentType } };
  },
  { rateLimit: { key: 'upload', perMinute: 10 } },
);
