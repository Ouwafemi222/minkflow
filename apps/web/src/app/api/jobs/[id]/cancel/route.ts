import { JOB_PROJECT_STAGES } from '@minkflow/contracts';
import { cancelJob, getJob, setProjectStatus } from '@minkflow/db';
import { z } from 'zod';
import { authed } from '@/lib/api';
import { toJobDto } from '@/lib/jobs';
import { db } from '@/lib/services';

/** Queued jobs cancel immediately with a full refund; running jobs stop at the next checkpoint. */
export const POST = authed<{ id: string }>(async (ctx, { id }) => {
  const jobId = z.uuid().parse(id);
  const result = await ctx.asUser((tx) => cancelJob(tx, jobId));
  const job = await ctx.asUser((tx) => getJob(tx, jobId));
  if (result === 'canceled' && job.project_id && job.type !== 'noop' && job.type !== 'retention_sweep') {
    const pending = JOB_PROJECT_STAGES[job.type].pending;
    if (pending) await setProjectStatus(db(), job.project_id, [pending, 'retry_pending'], 'canceled');
  }
  return { result, job: toJobDto(job) };
});
