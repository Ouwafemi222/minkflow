export const credits = (micro: number) => (micro / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 });

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  script_pending: 'Writing script…',
  script_ready: 'Script ready',
  storyboard_pending: 'Building storyboard…',
  storyboard_ready: 'Storyboard ready',
  media_pending: 'Generating voice…',
  media_ready: 'Voice ready',
  preview_ready: 'Preview ready',
  render_queued: 'Render queued',
  rendering: 'Rendering…',
  completed: 'Video ready',
  failed: 'Needs attention',
  canceled: 'Canceled',
  retry_pending: 'Retrying…',
};

export const JOB_LABELS: Record<string, string> = {
  noop: 'System check',
  script: 'Script',
  storyboard: 'Storyboard',
  scene_regenerate: 'Scene redesign',
  media: 'Voice & captions',
  preview: 'Draft preview',
  render: 'Final render',
  retention_sweep: 'Cleanup',
};

export function statusTone(status: string): '' | 'success' | 'warning' | 'error' {
  if (status === 'completed' || status.endsWith('_ready')) return 'success';
  if (status === 'failed') return 'error';
  if (status === 'canceled' || status === 'retry_pending') return 'warning';
  return '';
}
