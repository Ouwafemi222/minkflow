import { fulfillPayment } from '@minkflow/db';
import { createLogger } from '@minkflow/shared';
import { sha256 } from '@minkflow/shared/node';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { verifyPaystackSignature, verifyTransaction } from '@/lib/paystack';
import { db } from '@/lib/services';

const log = createLogger({ svc: 'web', route: 'paystack-webhook' });

interface PaystackEvent {
  event: string;
  data?: { id?: number; reference?: string; amount?: number; currency?: string; status?: string };
}

/**
 * Paystack webhook. Signature (HMAC-SHA512 of the raw body) is verified first; the event is deduplicated and
 * the amount/currency are checked against the server-side payment row inside one SQL transaction
 * (`fulfill_payment`), so retries and replays never double-grant credits.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyPaystackSignature(raw, req.headers.get('x-paystack-signature'))) {
    log.warn('invalid webhook signature');
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }
  let event: PaystackEvent;
  try {
    event = JSON.parse(raw) as PaystackEvent;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (event.event !== 'charge.success' || !event.data?.reference || !event.data.id) return NextResponse.json({ ok: true, ignored: event.event });

  const verified = env().APP_ENV === 'local' ? event.data : await verifyTransaction(event.data.reference);
  if (!verified || verified.status !== 'success') {
    log.warn('transaction not verified as success', { reference: event.data.reference });
    return NextResponse.json({ error: 'not verified' }, { status: 409 });
  }
  const outcome = await fulfillPayment(db(), {
    eventId: `${event.event}:${event.data.id}`,
    eventType: event.event,
    payloadHash: sha256(raw),
    reference: event.data.reference,
    externalId: String(verified.id ?? event.data.id),
    amountMinor: Number(verified.amount),
    currency: String(verified.currency),
  });
  log.info('paystack webhook processed', { reference: event.data.reference, outcome });
  if (outcome === 'mismatch') return NextResponse.json({ error: 'amount or currency mismatch' }, { status: 409 });
  return NextResponse.json({ ok: true, outcome });
}
