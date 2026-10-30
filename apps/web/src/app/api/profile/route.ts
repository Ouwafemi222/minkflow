import { updateMyProfile } from '@minkflow/db';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';

const Body = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    /** `upload` is set by POST /api/profile/avatar once the image is verified. */
    avatarMode: z.enum(['auto', 'none']).optional(),
  })
  .refine((b) => b.displayName !== undefined || b.avatarMode !== undefined, 'Nothing to update');

export const PATCH = authed(
  async (ctx) => {
    const body = await readJson(ctx.req, Body);
    const profile = await ctx.asUser((tx) => updateMyProfile(tx, body));
    return { profile: { displayName: profile.display_name, avatarMode: profile.avatar_mode } };
  },
  { rateLimit: { key: 'profile', perMinute: 20 } },
);
