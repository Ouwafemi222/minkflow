import type { JobType } from '@minkflow/contracts';
import { claimNextJob, type JobRow } from '@minkflow/db';
import type { RunOutcome } from '@minkflow/pipeline';
import type { Logger } from '@minkflow/shared';

export interface LaneDeps {
  claim: (types: JobType[]) => Promise<JobRow | null>;
  run: (job: JobRow) => Promise<RunOutcome>;
  logger: Logger;
}

/** A bounded pool of job slots for a set of job types (render lane is kept small: Chromium is heavy). */
export class Lane {
  private active = new Set<Promise<void>>();
  private filling = false;
  private stopped = false;

  constructor(
    readonly name: string,
    readonly types: JobType[],
    readonly max: number,
    private readonly deps: LaneDeps,
  ) {}

  get activeCount(): number {
    return this.active.size;
  }

  /** Claims jobs until the lane is full or nothing is runnable. Safe to call concurrently. */
  async fill(): Promise<void> {
    if (this.filling || this.stopped) return;
    this.filling = true;
    try {
      while (!this.stopped && this.active.size < this.max) {
        const job = await this.deps.claim(this.types);
        if (!job) break;
        const run: Promise<void> = this.deps
          .run(job)
          .then(() => undefined)
          .catch((error: unknown) => this.deps.logger.error('lane run crashed', { lane: this.name, jobId: job.id, error: String(error) }))
          .finally(() => {
            this.active.delete(run);
            void this.fill();
          });
        this.active.add(run);
      }
    } catch (error) {
      this.deps.logger.warn('lane claim failed', { lane: this.name, error: String(error) });
    } finally {
      this.filling = false;
    }
  }

  /** Stops claiming and waits (up to `graceMs`) for running jobs; unfinished jobs are recovered by lease expiry. */
  async drain(graceMs: number): Promise<boolean> {
    this.stopped = true;
    const all = Promise.all([...this.active]).then(() => true);
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), graceMs).unref());
    return Promise.race([all, timeout]);
  }
}

export const claimFromDb = (db: Parameters<typeof claimNextJob>[0], workerId: string, leaseSeconds: number) => (types: JobType[]) =>
  claimNextJob(db, workerId, leaseSeconds, types);
