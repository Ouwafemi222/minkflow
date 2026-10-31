import { DELETION_REASON_IDS } from '@minkflow/contracts';
import { setAccountDeletion } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';

const Body = z.object({
  requested: z.boolean(),
  reason: z.enum(DELETION_REASON_IDS).optional(),
  note: z.string().trim().max(200).optional(),
});

/**
 * Requests (or cancels) account deletion. Deletion itself is carried out by an operator within 30 days
 * (docs/RUNBOOKS.md) because ledger and payment records have retention rules.
 */
export const POST = authed(
  async (ctx) => {
    const { requested, reason, note } = await readJson(ctx.req, Body);
    if (requested && !reason) throw new AppError('VALIDATION_FAILED', 'Choose a reason for deleting your account.');
    if (requested && reason === 'other' && !note) throw new AppError('VALIDATION_FAILED', 'Please tell us a bit more.');
    const at = await ctx.asUser((tx) => setAccountDeletion(tx, requested, reason, note));
    return { deletionRequestedAt: at };
  },
  { rateLimit: { key: 'profile', perMinute: 20 } },
);
