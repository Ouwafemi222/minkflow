import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GrantCreditsForm } from '@/components/GrantCreditsForm';
import { adminOverview } from '@/lib/admin';
import { requireSession } from '@/lib/auth';
import { isAdminEmail } from '@/lib/env';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

const date = (d: Date | string | null) => (d ? new Date(d).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default async function AdminPage() {
  const session = await requireSession();
  if (!isAdminEmail(session.email)) notFound();
  const o = await adminOverview();
  return (
    <div className="stack" style={{ ['--gap' as string]: '24px', maxWidth: 1100 }}>
      <h1 style={{ margin: 0 }}>Admin diagnostics</h1>
      <div className="grid" style={{ ['--min' as string]: '200px' }}>
        <div className="card">
          <div className="muted small">Provider spend today (UTC, estimated)</div>
          <strong style={{ fontSize: 24 }}>${o.spendTodayUsd.toFixed(2)}</strong>
        </div>
        <div className="card">
          <div className="muted small">Workspaces</div>
          <strong style={{ fontSize: 24 }}>{o.workspaces}</strong>
        </div>
        <div className="card">
          <div className="muted small">Jobs (24h)</div>
          <div className="small">{Object.entries(o.jobsLast24h).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'none'}</div>
        </div>
        <div className="card">
          <div className="muted small">Stuck running jobs</div>
          <strong style={{ fontSize: 24, color: o.stuckJobs.length ? 'var(--state-error)' : undefined }}>{o.stuckJobs.length}</strong>
        </div>
      </div>

      <section className="card stack" aria-labelledby="grant">
        <h2 id="grant" style={{ margin: 0 }}>
          Grant beta credits
        </h2>
        <GrantCreditsForm />
      </section>

      <section className="stack" aria-labelledby="failed">
        <h2 id="failed" style={{ margin: 0 }}>
          Recent failed jobs (dead-letter)
        </h2>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Finished</th>
                <th scope="col">Type</th>
                <th scope="col">Error</th>
                <th scope="col">Attempts</th>
                <th scope="col">Job id</th>
              </tr>
            </thead>
            <tbody>
              {o.failedJobs.map((j) => (
                <tr key={j.id}>
                  <td>{date(j.finished_at)}</td>
                  <td>{j.type}</td>
                  <td>
                    <code>{j.error_code}</code> <span className="small muted">{j.error_message?.slice(0, 160)}</span>
                  </td>
                  <td>{j.attempt_count}</td>
                  <td className="small">
                    <code>{j.id}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack" aria-labelledby="spend">
        <h2 id="spend" style={{ margin: 0 }}>
          Top spend today
        </h2>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Workspace</th>
                <th scope="col">USD (est.)</th>
              </tr>
            </thead>
            <tbody>
              {o.topSpendToday.map((r) => (
                <tr key={r.workspace_id}>
                  <td>
                    <code>{r.workspace_id}</code>
                  </td>
                  <td>${Number(r.usd).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack" aria-labelledby="webhooks">
        <h2 id="webhooks" style={{ margin: 0 }}>
          Recent webhooks
        </h2>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Received</th>
                <th scope="col">Provider</th>
                <th scope="col">Event</th>
                <th scope="col">Processed</th>
              </tr>
            </thead>
            <tbody>
              {o.webhooks.map((w, i) => (
                <tr key={i}>
                  <td>{date(w.created_at)}</td>
                  <td>{w.provider}</td>
                  <td>{w.event_type}</td>
                  <td>{date(w.processed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
