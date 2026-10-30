import type { JobType } from '@minkflow/contracts';
import { Queue, Worker } from 'bullmq';

/**
 * Postgres is the source of truth for jobs (status, leases, credits). The queue is only a wake-up signal:
 *  - `postgres`: workers poll `claim_next_job` (no Redis needed; default for local dev and small deployments)
 *  - `bullmq`:   the web app publishes job ids to Redis so idle workers start immediately; workers still
 *                claim through Postgres and also poll slowly to pick up retries and missed signals.
 */
export type QueueDriver = 'postgres' | 'bullmq';

export const RENDER_JOB_TYPES: readonly JobType[] = ['preview', 'render'];
export const AI_JOB_TYPES: readonly JobType[] = ['noop', 'script', 'storyboard', 'scene_regenerate', 'media', 'retention_sweep'];
export const laneFor = (type: JobType): 'render' | 'ai' => (RENDER_JOB_TYPES.includes(type) ? 'render' : 'ai');
const queueName = (lane: 'render' | 'ai') => `minkflow-${lane}`;

export interface JobSignal {
  jobId: string;
  type: JobType;
}

export interface JobPublisher {
  publish(signal: JobSignal): Promise<void>;
  close(): Promise<void>;
}

export function createPublisher(driver: QueueDriver, redisUrl?: string): JobPublisher {
  if (driver === 'postgres') return { publish: async () => undefined, close: async () => undefined };
  if (!redisUrl) throw new Error('QUEUE_DRIVER=bullmq requires REDIS_URL');
  const connection = { url: redisUrl, maxRetriesPerRequest: null };
  const queues = { render: new Queue(queueName('render'), { connection }), ai: new Queue(queueName('ai'), { connection }) };
  return {
    async publish(signal) {
      await queues[laneFor(signal.type)].add('job', signal, { jobId: signal.jobId, removeOnComplete: 1000, removeOnFail: 1000 });
    },
    async close() {
      await Promise.all([queues.render.close(), queues.ai.close()]);
    },
  };
}

export interface SignalSubscriber {
  close(): Promise<void>;
}

/** Subscribes to wake-up signals; `onSignal` should try to claim the job and resolve when it finishes. */
export function subscribe(
  redisUrl: string,
  lane: 'render' | 'ai',
  concurrency: number,
  onSignal: (signal: JobSignal) => Promise<void>,
): SignalSubscriber {
  const worker = new Worker(queueName(lane), async (job) => onSignal(job.data as JobSignal), {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
    concurrency,
  });
  return { close: () => worker.close() };
}
