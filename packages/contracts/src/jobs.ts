import { z } from 'zod';

export const PROJECT_STATUSES = [
  'draft',
  'script_pending',
  'script_ready',
  'storyboard_pending',
  'storyboard_ready',
  'media_pending',
  'media_ready',
  'preview_ready',
  'render_queued',
  'rendering',
  'completed',
  'failed',
  'canceled',
  'retry_pending',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const ASYNC_STAGES: ProjectStatus[] = ['script_pending', 'storyboard_pending', 'media_pending', 'render_queued', 'rendering'];

/** Explicit, server-enforced project pipeline transitions (doc 03). */
export const PROJECT_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  draft: ['script_pending', 'script_ready'],
  script_pending: ['script_ready'],
  script_ready: ['script_pending', 'storyboard_pending'],
  storyboard_pending: ['storyboard_ready'],
  storyboard_ready: ['storyboard_pending', 'media_pending', 'script_pending'],
  media_pending: ['media_ready'],
  media_ready: ['preview_ready', 'render_queued', 'media_pending', 'storyboard_pending', 'storyboard_ready'],
  preview_ready: ['preview_ready', 'render_queued', 'media_pending', 'storyboard_pending', 'storyboard_ready'],
  render_queued: ['rendering'],
  rendering: ['completed'],
  completed: ['render_queued', 'media_pending', 'storyboard_pending', 'storyboard_ready', 'preview_ready'],
  failed: ['retry_pending', 'script_pending', 'storyboard_pending', 'media_pending', 'render_queued', 'storyboard_ready'],
  canceled: ['script_pending', 'storyboard_pending', 'media_pending', 'render_queued', 'storyboard_ready'],
  retry_pending: ['script_pending', 'storyboard_pending', 'media_pending', 'render_queued'],
};

/** All statuses from which `to` is reachable; used for compare-and-set status updates. */
export function statusesThatCanReach(to: ProjectStatus): ProjectStatus[] {
  return PROJECT_STATUSES.filter((from) => canTransition(from, to));
}

/** Statuses in which the storyboard may be edited; edits after media invalidate it back to storyboard_ready. */
export const STORYBOARD_EDITABLE: readonly ProjectStatus[] = ['storyboard_ready', 'media_ready', 'preview_ready', 'completed', 'failed', 'canceled'];

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  if ((to === 'failed' || to === 'canceled' || to === 'retry_pending') && ASYNC_STAGES.includes(from)) return true;
  return PROJECT_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ProjectStatus, to: ProjectStatus): void {
  if (!canTransition(from, to)) throw new Error(`Invalid project transition ${from} -> ${to}`);
}

export const JOB_TYPES = ['noop', 'script', 'storyboard', 'scene_regenerate', 'media', 'preview', 'render', 'retention_sweep'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['queued', 'running', 'completed', 'failed', 'canceled', 'retry_pending'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  queued: ['running', 'canceled'],
  running: ['completed', 'failed', 'canceled', 'retry_pending'],
  retry_pending: ['running', 'canceled', 'failed'],
  completed: [],
  failed: [],
  canceled: [],
};

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = ['completed', 'failed', 'canceled'];

/**
 * Which project status a job type moves the project into when queued, and on success. Jobs without `pending`
 * (preview, scene regeneration) never block the editor and leave the status alone if they fail.
 */
export const JOB_PROJECT_STAGES: Record<Exclude<JobType, 'noop' | 'retention_sweep'>, { pending?: ProjectStatus; done?: ProjectStatus }> = {
  script: { pending: 'script_pending', done: 'script_ready' },
  storyboard: { pending: 'storyboard_pending', done: 'storyboard_ready' },
  scene_regenerate: {},
  media: { pending: 'media_pending', done: 'media_ready' },
  preview: { done: 'preview_ready' },
  render: { pending: 'render_queued', done: 'completed' },
};

export const JobPayloadSchema = z.object({
  jobId: z.uuid(),
  type: z.enum(JOB_TYPES),
});
export type JobPayload = z.infer<typeof JobPayloadSchema>;
