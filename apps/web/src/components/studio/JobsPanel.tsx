'use client';

import { api, errorMessage } from '@/lib/client';
import type { JobDto } from '@/lib/jobs';
import { credits, JOB_LABELS } from '@/lib/labels';

const ACTIVE = new Set(['queued', 'running', 'retry_pending']);

export function JobsPanel({ jobs, onChanged, onError }: { jobs: JobDto[]; onChanged: () => void; onError: (text: string) => void }) {
  const active = jobs.filter((j) => ACTIVE.has(j.status));
  const latestFailed = jobs.find((j) => j.status === 'failed' && !jobs.some((o) => o.type === j.type && o.createdAt > j.createdAt));
  if (active.length === 0 && !latestFailed) return null;

  async function act(path: string) {
    try {
      await api(path, { method: 'POST' });
      onChanged();
    } catch (error) {
      onError(errorMessage(error));
    }
  }

  return (
    <section className="stack" aria-live="polite">
      {active.map((job) => (
        <div key={job.id} className="card stack" style={{ ['--gap' as string]: '8px' }}>
          <div className="spread">
            <strong>
              {JOB_LABELS[job.type]} — {job.status === 'queued' ? 'waiting for a worker' : job.status === 'retry_pending' ? `retrying (attempt ${job.attempt + 1} of ${job.maxAttempts})` : (job.stage ?? 'working').replace(/_/g, ' ')}
            </strong>
            <button className="btn sm danger" disabled={job.cancelRequested} onClick={() => void act(`/api/jobs/${job.id}/cancel`)}>
              {job.cancelRequested ? 'Canceling…' : 'Cancel'}
            </button>
          </div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.progress * 100)} aria-label={`${JOB_LABELS[job.type]} progress`}>
            <span style={{ width: `${Math.max(3, Math.round(job.progress * 100))}%` }} />
          </div>
          <span className="small muted">Up to {credits(job.reservedCredits)} credits reserved; unused credits are returned when it finishes.</span>
        </div>
      ))}
      {latestFailed ? (
        <div className="alert error spread" role="alert">
          <span>
            <strong>{JOB_LABELS[latestFailed.type]} failed.</strong> {latestFailed.error?.message ?? 'Your credits were refunded.'}
          </span>
          {latestFailed.error?.retryable !== false ? (
            <button className="btn sm" onClick={() => void act(`/api/jobs/${latestFailed.id}/retry`)}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
