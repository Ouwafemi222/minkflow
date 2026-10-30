import 'server-only';
import { canTransition, JOB_PROJECT_STAGES, statusesThatCanReach, type JobType } from '@minkflow/contracts';
import { createJob, getProject, setProjectStatus, type JobRow } from '@minkflow/db';
import { AppError, ERROR_CODES, type ErrorCode } from '@minkflow/shared';
import { log, type ApiContext } from './api';
import { env } from './env';
import { db, publisher } from './services';

export interface JobDto {
  id: string;
  projectId: string | null;
  type: JobType;
  status: JobRow['status'];
  progress: number;
  stage: string | null;
  attempt: number;
  maxAttempts: number;
  reservedCredits: number;
  error: { code: string; message: string; retryable: boolean } | null;
  result: Record<string, unknown> | null;
  cancelRequested: boolean;
  createdAt: string;
  finishedAt: string | null;
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

export function toJobDto(job: JobRow): JobDto {
  const known = job.error_code && job.error_code in ERROR_CODES ? ERROR_CODES[job.error_code as ErrorCode] : null;
  return {
    id: job.id,
    projectId: job.project_id,
    type: job.type,
    status: job.status,
    progress: Number(job.progress ?? 0),
    stage: job.stage,
    attempt: job.attempt_count,
    maxAttempts: job.max_attempts,
    reservedCredits: Number(job.reserved_credits),
    error: job.error_code
      ? { code: job.error_code, message: known?.message ?? 'The job stopped unexpectedly. Your credits were refunded.', retryable: known?.retryable ?? true }
      : null,
    result: job.result_json,
    cancelRequested: job.cancel_requested,
    createdAt: iso(job.created_at)!,
    finishedAt: iso(job.finished_at),
  };
}

/**
 * Creates a job (atomically reserving credits, enforcing idempotency and concurrency in SQL), moves the project
 * into its pending status, and signals workers. The project is loaded through RLS, so ownership is enforced.
 */
export async function enqueueProjectJob(
  ctx: ApiContext,
  args: { projectId: string; type: Exclude<JobType, 'noop' | 'retention_sweep'>; input?: Record<string, unknown>; credits: number; idempotencyKey: string; revisionId?: string | null },
): Promise<{ job: JobDto; created: boolean }> {
  const ws = await ctx.workspace();
  const project = await ctx.asUser((tx) => getProject(tx, args.projectId));
  const stage = JOB_PROJECT_STAGES[args.type];
  if (stage.pending && project.status !== stage.pending && !canTransition(project.status, stage.pending)) {
    throw new AppError('INVALID_STATE', `This step is not available while the project is ${project.status.replace(/_/g, ' ')}.`);
  }
  const { job, created } = await createJob(db(), {
    workspaceId: ws.id,
    projectId: project.id,
    revisionId: args.revisionId ?? project.current_revision_id,
    type: args.type,
    idempotencyKey: `${args.type}:${project.id}:${args.idempotencyKey}`,
    input: args.input ?? {},
    credits: args.credits,
    maxActive: env().MAX_ACTIVE_JOBS_PER_WORKSPACE,
  });
  if (created) {
    if (stage.pending) await setProjectStatus(db(), project.id, statusesThatCanReach(stage.pending), stage.pending);
    await publisher()
      .publish({ jobId: job.id, type: job.type })
      .catch((error: unknown) => log.warn('queue publish failed; workers will pick the job up by polling', { jobId: job.id, error: String(error) }));
  }
  return { job: toJobDto(job), created };
}
