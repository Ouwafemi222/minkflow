import { CREDIT_PACKS, PRICING } from '@minkflow/contracts';
import { getBalance, listLedger, listPayments, listUsage } from '@minkflow/db';
import { authed } from '@/lib/api';
import { env } from '@/lib/env';

export const GET = authed(async (ctx) => {
  const ws = await ctx.workspace();
  return ctx.asUser(async (tx) => {
    // One transaction client: queries must run sequentially.
    const balance = await getBalance(tx, ws.id);
    const ledger = await listLedger(tx, 50);
    const payments = await listPayments(tx, 20);
    const usage = await listUsage(tx, 50);
    return {
      balance,
      paymentsEnabled: env().PAYMENTS_ENABLED,
      packs: CREDIT_PACKS,
      pricing: PRICING,
      ledger: ledger.map((l) => ({ id: l.id, amount: l.amount, kind: l.kind, reference: `${l.reference_type}:${l.reference_id}`, createdAt: l.created_at })),
      payments: payments.map((p) => ({ id: p.id, reference: p.reference, status: p.status, amountMinor: p.amount_minor, currency: p.currency, credits: p.credits, packId: p.pack_id, createdAt: p.created_at })),
      usage: usage.map((u) => ({ id: u.id, operation: u.operation, provider: u.provider, quantity: u.quantity, unit: u.unit, cached: u.cached, createdAt: u.created_at })),
    };
  });
});
