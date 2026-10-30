'use client';

import { DURATION_LIMITS } from '@minkflow/contracts';
import { Download } from 'lucide-react';
import type { JobDto } from '@/lib/jobs';
import { credits } from '@/lib/labels';
import type { ProjectView } from '@/lib/project-view';
import type { SaveState } from './StoryboardEditor';

type Step = 'media' | 'preview' | 'render';

function latest(jobs: JobDto[], type: string) {
  return jobs.find((j) => j.type === type && j.status === 'completed');
}

export function RenderPanel({ view, busy, saveState, onRun }: { view: ProjectView; busy: string | null; saveState: SaveState; onRun: (step: Step) => void }) {
  const scenes = view.doc.storyboard?.scenes ?? [];
  const missingVoice = scenes.some((s) => !s.voiceAssetId);
  const active = view.jobs.some((j) => j.status === 'queued' || j.status === 'running' || j.status === 'retry_pending');
  const unsaved = saveState !== 'saved';
  const tooLong = view.seconds > DURATION_LIMITS.maxTotalSeconds;
  const blocked = busy !== null || active || unsaved;
  const preview = latest(view.jobs, 'preview');
  const render = latest(view.jobs, 'render');
  const afford = (quote: number) => view.balance >= quote;

  const stepButton = (step: Step, label: string, quote: number, enabled: boolean, primary: boolean) => (
    <button className={`btn${primary ? ' primary' : ''}`} disabled={blocked || !enabled || !afford(quote)} onClick={() => onRun(step)}>
      {busy === step ? 'Starting…' : label} · {credits(quote)} credits
    </button>
  );

  return (
    <section className="card stack" aria-labelledby="export-heading" style={{ ['--gap' as string]: '14px' }}>
      <h2 id="export-heading" style={{ margin: 0 }}>
        Voice, preview and export
      </h2>
      {unsaved ? <p className="small muted">Saving your edits before the next step…</p> : null}
      {tooLong ? (
        <p className="alert warning small">
          This video is {Math.round(view.seconds)}s. The limit is {DURATION_LIMITS.maxTotalSeconds / 60} minutes — shorten or remove scenes.
        </p>
      ) : null}
      {view.watermark ? <p className="small muted">Exports include a small “Made with Minkflow” watermark until your first credit purchase.</p> : null}
      <div className="row">
        {stepButton('media', missingVoice ? 'Generate voice & captions' : 'Voice up to date', view.quotes.media, missingVoice, missingVoice)}
        {stepButton('preview', 'Draft preview (low-res)', view.quotes.preview, !missingVoice && !tooLong, false)}
        {stepButton('render', 'Render final 1080p MP4', view.quotes.render, !missingVoice && !tooLong, !missingVoice)}
      </div>
      {!afford(Math.min(view.quotes.preview, view.quotes.render)) && !missingVoice ? (
        <p className="alert warning small">
          Not enough credits. <a href="/studio/billing">Get credits</a>
        </p>
      ) : null}

      {render ? (
        <div className="stack" style={{ ['--gap' as string]: '8px' }}>
          <h3 style={{ margin: 0 }}>Final video</h3>
          <video controls preload="metadata" src={`/api/jobs/${render.id}/download?inline=1`} style={{ width: '100%', maxWidth: 720, borderRadius: 12 }} />
          <div className="row">
            <a className="btn primary" href={`/api/jobs/${render.id}/download`}>
              <Download size={16} aria-hidden /> Download MP4
            </a>
            <span className="small muted">Kept for 30 days after rendering.</span>
          </div>
        </div>
      ) : preview ? (
        <div className="stack" style={{ ['--gap' as string]: '8px' }}>
          <h3 style={{ margin: 0 }}>Draft preview</h3>
          <video controls preload="metadata" src={`/api/jobs/${preview.id}/download?inline=1`} style={{ width: '100%', maxWidth: 720, borderRadius: 12 }} />
          <span className="small muted">Low-resolution draft, kept for 7 days.</span>
        </div>
      ) : null}
    </section>
  );
}
