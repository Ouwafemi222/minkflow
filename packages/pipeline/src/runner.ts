import { JOB_PROJECT_STAGES, statusesThatCanReach, type JobType, type ProjectStatus } from '@minkflow/contracts';
import { completeJob, failJob, finishCanceledJob, heartbeatJob, setProjectStatus, type JobRow } from '@minkflow/db';
import { AppError, backoffDelay, isAppError } from '@minkflow/shared';
import { runRetentionSweep } from './maintenance';
import { processMedia } from './processors/media';
import { processSceneRegenerate, processScript, processStoryboard } from './processors/planning';
import { processPreview, processRender } from './processors/render';
import { JobCanceledSignal, type JobContext, type PipelineDeps, type Processor } from './types';

const PROCESSORS: Record<JobType, Processor> = {
  noop: async (ctx) => {
    ctx.setProgress(0.5, 'noop');
    await ctx.checkpoint();
    return { result: { ok: true, echo: ctx.job.input_json }, chargedMicro: 0 };
  },
  script: processScript,
  storyboard: processStoryboard,
  scene_regenerate: processSceneRegenerate,
  media: processMedia,
  preview: processPreview,
  render: processRender,
  retention_sweep: async (ctx) => ({ result: await runRetentionSweep(ctx.deps), chargedMicro: 0 }),
};

export type RunOutcome = 'completed' | 'retry_pending' | 'failed' | 'canceled' | 'lost';

function stagesFor(type: JobType): { pending?: ProjectStatus; done?: ProjectStatus } {
  return type === 'noop' || type === 'retention_sweep' ? {} : JOB_PROJECT_STAGES[type];
}

function inProgressStatuses(pending: ProjectStatus): ProjectStatus[] {
  return pending === 'render_queued' ? ['render_queued', 'rendering', 'retry_pending'] : [pending, 'retry_pending'];
}

/** Runs one claimed job end-to-end: heartbeats, cancellation, settlement, project status, retries. */
export async function runJob(deps: PipelineDeps, job: JobRow): Promise<RunOutcome> {
  const { db, config } = deps;
  const log = deps.logger.child({ jobId: job.id, jobType: job.type, workspaceId: job.workspace_id, attempt: job.attempt_count });
  const stages = stagesFor(job.type);
  let progress = job.progress ?? 0;
  let stage: string | null = null;
  let canceled = false;
  let lost = false;

  const heartbeat = async () => {
    try {
      const r = await heartbeatJob(db, job.id, config.workerId, config.leaseSeconds, Math.min(1, Math.max(0, progress)), stage);
      if (r === 'cancel') canceled = true;
      if (r === 'lost') lost = true;
    } catch (error) {
      log.warn('heartbeat failed', { error: String(error) });
    }
  };
  const timer = setInterval(() => void heartbeat(), Math.max(1000, (config.leaseSeconds * 1000) / 3));

  const ctx: JobContext = {
    job,
    deps,
    log,
    charged: 0,
    setProgress(fraction, nextStage) {
      progress = fraction;
      if (nextStage) stage = nextStage;
    },
    async checkpoint() {
      await heartbeat();
      if (lost) throw new JobCanceledSignal('lost');
      if (canceled) throw new JobCanceledSignal('canceled');
    },
    isCanceled: () => canceled || lost,
  };

  const started = Date.now();
  try {
    if (job.type === 'render' && job.project_id) await setProjectStatus(db, job.project_id, ['render_queued', 'retry_pending'], 'rendering');
    if (stages.pending && job.project_id && job.attempt_count > 1) await setProjectStatus(db, job.project_id, ['retry_pending'], stages.pending);
    log.info('job started');
    const out = await PROCESSORS[job.type](ctx);
    await ctx.checkpoint();
    const charged = Math.min(job.reserved_credits, Math.max(0, Math.round(out.chargedMicro)));
    const ok = await completeJob(db, job.id, config.workerId, out.result, charged);
    if (!ok) return 'lost';
    const next = out.nextStatus === undefined ? stages.done : out.nextStatus;
    if (next && job.project_id) {
      const from = stages.pending ? inProgressStatuses(stages.pending) : statusesThatCanReach(next);
      await setProjectStatus(db, job.project_id, from, next);
    }
    log.info('job completed', { ms: Date.now() - started, charged });
    return 'completed';
  } catch (error) {
    if (error instanceof JobCanceledSignal || canceled || lost) {
      if (lost || (error instanceof JobCanceledSignal && error.reason === 'lost')) {
        log.warn('job lease lost; another worker or the sweeper owns it now');
        return 'lost';
      }
      const charged = Math.min(job.reserved_credits, ctx.charged);
      await finishCanceledJob(db, job.id, config.workerId, charged);
      if (stages.pending && job.project_id) await setProjectStatus(db, job.project_id, inProgressStatuses(stages.pending), 'canceled');
      log.info('job canceled', { charged });
      return 'canceled';
    }
    const appError = isAppError(error) ? error : new AppError('INTERNAL', undefined, { cause: String(error) });
    if (!isAppError(error)) log.error('job crashed', { error: error instanceof Error ? error.stack : String(error) });
    const delaySeconds = appError.code === 'SPEND_CAP_REACHED' ? 900 : Math.ceil(backoffDelay(job.attempt_count, { baseMs: 10_000, maxMs: 300_000 }) / 1000);
    const result = await failJob(db, job.id, config.workerId, appError.code, appError.message, appError.retryable, delaySeconds);
    if (result === 'failed' && stages.pending && job.project_id) await setProjectStatus(db, job.project_id, inProgressStatuses(stages.pending), 'failed');
    if (result === 'retry_pending' && stages.pending && job.project_id) await setProjectStatus(db, job.project_id, inProgressStatuses(stages.pending), 'retry_pending');
    log.warn('job failed', { code: appError.code, result, details: appError.details });
    return result;
  } finally {
    clearInterval(timer);
  }
}
