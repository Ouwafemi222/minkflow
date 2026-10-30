import { setAccountDeletion } from '@minkflow/db';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';

/**
 * Requests (or cancels) account deletion. Deletion itself is carried out by an operator within 30 days
 * (docs/RUNBOOKS.md) because ledger and payment records have retention rules.
 */
export const POST = authed(
  async (ctx) => {
    const { requested } = await readJson(ctx.req, z.object({ requested: z.boolean() }));
    const at = await ctx.asUser((tx) => setAccountDeletion(tx, requested));
    return { deletionRequestedAt: at };
  },
  { rateLimit: { key: 'profile', perMinute: 20 } },
);
