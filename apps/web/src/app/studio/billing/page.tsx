import { CREDIT_PACKS, formatCredits, PRICING } from '@minkflow/contracts';
import { getBalance, getMyWorkspace, listLedger, listPayments, listUsage, withUser } from '@minkflow/db';
import type { Metadata } from 'next';
import { BuyPackButton } from '@/components/BuyPackButton';
import { requireSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { db } from '@/lib/services';

export const metadata: Metadata = { title: 'Credits & billing' };

// A job reserves its quote up front; unused or refunded credits come back as a separate "release" entry.
const KIND_LABELS: Record<string, string> = { grant: 'Grant', purchase: 'Purchase', reserve: 'Used', release: 'Returned', adjustment: 'Adjustment', refund: 'Refund' };
const date = (d: Date | string) => new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const session = await requireSession();
  const { reference } = await searchParams;
  const { balance, ledger, payments, usage } = await withUser(db(), session.userId, async (tx) => {
    const ws = await getMyWorkspace(tx);
    // One transaction client: queries must run sequentially.
    return { balance: await getBalance(tx, ws.id), ledger: await listLedger(tx, 40), payments: await listPayments(tx, 10), usage: await listUsage(tx, 30) };
  });
  const paymentsEnabled = env().PAYMENTS_ENABLED;
  const returned = reference ? payments.find((p) => p.reference === reference) : undefined;

  return (
    <div className="stack" style={{ ['--gap' as string]: '24px', maxWidth: 1000 }}>
      <header className="stack" style={{ ['--gap' as string]: '4px' }}>
        <h1 style={{ margin: 0 }}>Credits & billing</h1>
        <p className="muted" style={{ margin: 0 }}>
          Balance: <strong>{formatCredits(balance)} credits</strong>
        </p>
      </header>

      {reference ? (
        <p className={`alert ${returned?.status === 'success' ? 'success' : 'warning'}`} role="status">
          {returned?.status === 'success' ? 'Payment received — your credits have been added.' : 'We are confirming your payment with Paystack. Credits appear here as soon as it is confirmed (refresh in a minute).'}
        </p>
      ) : null}

      <section className="stack" aria-labelledby="packs">
        <h2 id="packs" style={{ margin: 0 }}>
          Credit packs
        </h2>
        {!paymentsEnabled ? (
          <p className="alert warning">During the beta, credits are granted by the Minkflow team. Card payments open once USD payouts are approved.</p>
        ) : null}
        <div className="grid" style={{ ['--min' as string]: '220px' }}>
          {CREDIT_PACKS.map((pack) => (
            <div key={pack.id} className="card stack" style={{ ['--gap' as string]: '8px' }}>
              <strong>{pack.label}</strong>
              <span style={{ fontSize: 28, fontWeight: 800 }}>${(pack.usdCents / 100).toFixed(0)}</span>
              <span className="muted">{pack.credits.toLocaleString('en-US')} credits · about {Math.floor(pack.credits / (60 * PRICING.renderCreditsPerSecond + 20))} finished 60-second videos</span>
              <BuyPackButton packId={pack.id} disabled={!paymentsEnabled} />
            </div>
          ))}
        </div>
        <p className="small muted">Prices in USD. Credits do not expire during the beta. Failed and canceled jobs return their credits automatically.</p>
      </section>

      <section className="stack" aria-labelledby="ledger">
        <h2 id="ledger" style={{ margin: 0 }}>
          Credit history
        </h2>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Type</th>
                <th scope="col">Credits</th>
                <th scope="col">For</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td>{date(l.created_at)}</td>
                  <td>{KIND_LABELS[l.kind] ?? l.kind}</td>
                  <td style={{ color: Number(l.amount) < 0 ? 'var(--text-secondary)' : 'var(--state-success)' }}>
                    {Number(l.amount) > 0 ? '+' : ''}
                    {formatCredits(Number(l.amount))}
                  </td>
                  <td className="small muted">{l.reference_type.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {payments.length > 0 ? (
        <section className="stack" aria-labelledby="payments">
          <h2 id="payments" style={{ margin: 0 }}>
            Payments
          </h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Pack</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{date(p.created_at)}</td>
                    <td>{p.pack_id}</td>
                    <td>
                      {(Number(p.amount_minor) / 100).toFixed(2)} {p.currency}
                    </td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="stack" aria-labelledby="usage">
        <h2 id="usage" style={{ margin: 0 }}>
          Recent AI and voice usage
        </h2>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Operation</th>
                <th scope="col">Amount</th>
                <th scope="col">Cached</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.id}>
                  <td>{date(u.created_at)}</td>
                  <td>{u.operation.replace(/_/g, ' ')}</td>
                  <td>
                    {Number(u.quantity).toLocaleString('en-US')} {u.unit}
                  </td>
                  <td>{u.cached ? 'Yes (free)' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
