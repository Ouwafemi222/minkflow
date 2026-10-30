import 'server-only';
import { AppError } from '@minkflow/shared';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env';

/**
 * Paystack REST integration (TO VERIFY V-05/V-06: USD settlement approval and current webhook signature scheme).
 * Amounts are in the currency's minor unit (cents for USD).
 */
const BASE = 'https://api.paystack.co';

export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  const secret = env().PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = Buffer.from(createHmac('sha512', secret).update(rawBody).digest('hex'));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function initializeTransaction(args: { email: string; amountMinor: number; reference: string; callbackUrl: string; metadata: Record<string, unknown> }): Promise<{ authorizationUrl: string }> {
  const response = await fetch(`${BASE}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env().PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: args.email,
      amount: args.amountMinor,
      currency: env().PAYSTACK_CURRENCY,
      reference: args.reference,
      callback_url: args.callbackUrl,
      metadata: args.metadata,
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response?.ok) throw new AppError('PAYMENTS_UNAVAILABLE', 'Checkout is temporarily unavailable. You were not charged.');
  const json = (await response.json()) as { status: boolean; data?: { authorization_url?: string } };
  if (!json.status || !json.data?.authorization_url) throw new AppError('PAYMENTS_UNAVAILABLE');
  return { authorizationUrl: json.data.authorization_url };
}

/** Server-side confirmation of a transaction before granting credits (defence in depth on top of the signature). */
export async function verifyTransaction(reference: string): Promise<{ status: string; amount: number; currency: string; id: number } | null> {
  const response = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env().PAYSTACK_SECRET_KEY}` },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const json = (await response.json()) as { status: boolean; data?: { status: string; amount: number; currency: string; id: number } };
  return json.status && json.data ? json.data : null;
}
