import { findPack, toMicro } from '@minkflow/contracts';
import { audit, createPayment } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';
import { env } from '@/lib/env';
import { initializeTransaction } from '@/lib/paystack';
import { db } from '@/lib/services';

/** Starts a Paystack USD checkout for a credit pack. Prices come from the server, never from the client. */
export const POST = authed(
  async (ctx) => {
    if (!env().PAYMENTS_ENABLED) throw new AppError('PAYMENTS_UNAVAILABLE', 'Payments are not enabled yet. Beta credits are granted by the team.');
    const { packId } = await readJson(ctx.req, z.object({ packId: z.string() }));
    const pack = findPack(packId);
    if (!pack) throw new AppError('VALIDATION_FAILED', 'Unknown pack');
    const ws = await ctx.workspace();
    const reference = `mf_${crypto.randomUUID().replace(/-/g, '')}`;
    await createPayment(db(), { workspaceId: ws.id, reference, amountMinor: pack.usdCents, currency: 'USD', credits: toMicro(pack.credits), packId: pack.id });
    await audit(db(), { actorId: ctx.session.userId, workspaceId: ws.id, action: 'checkout.started', targetId: reference, metadata: { packId: pack.id } });
    const { authorizationUrl } = await initializeTransaction({
      email: ctx.session.email,
      amountMinor: pack.usdCents,
      reference,
      callbackUrl: new URL(`/studio/billing?reference=${reference}`, env().APP_BASE_URL).toString(),
      metadata: { workspaceId: ws.id, packId: pack.id },
    });
    return { authorizationUrl, reference };
  },
  { rateLimit: { key: 'checkout', perMinute: 5 } },
);
