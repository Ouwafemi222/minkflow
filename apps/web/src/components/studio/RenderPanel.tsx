'use client';

import { DURATION_LIMITS } from '@minkflow/contracts';
import { Download, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { errorMessage } from '@/lib/client';
import { downloadJobVideo } from '@/lib/download-video';
import type { JobDto } from '@/lib/jobs';
import { credits } from '@/lib/labels';
import type { ProjectView } from '@/lib/project-view';
import type { SaveState } from './StoryboardEditor';

type Step = 'media' | 'preview' | 'render';

function latest(jobs: JobDto[], type: string) {
  return jobs.find((j) => j.type === type && j.status === 'completed');
}

export function RenderPanel({
  view,
  voices,
  busy,
  saveState,
  onRun,
  onVoiceChange,
}: {
  view: ProjectView;
  voices: Array<{ id: string; name: string; description: string }>;
  busy: string | null;
  saveState: SaveState;
  onRun: (step: Step) => void;
  onVoiceChange: (voiceId: string) => void;
}) {
  const scenes = view.doc.storyboard?.scenes ?? [];
  const missingVoice = scenes.some((s) => !s.voiceAssetId);
  const active = view.jobs.some((j) => j.status === 'queued' || j.status === 'running' || j.status === 'retry_pending');
  const unsaved = saveState !== 'saved';
  const tooLong = view.seconds > DURATION_LIMITS.maxTotalSeconds;
  const blocked = busy !== null || active || unsaved;
  const preview = latest(view.jobs, 'preview');
  const render = latest(view.jobs, 'render');
  const ready = render ?? preview;
  const [dlError, setDlError] = useState<string | null>(null);
  const [dlBusy, setDlBusy] = useState(false);
  const afford = (quote: number) => view.balance >= quote;
  const filename = `${view.project.title.replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'video'}${ready && !render ? '-preview' : ''}.mp4`;

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
      {voices.length ? (
        <label className="field" style={{ maxWidth: 360 }}>
          Voice
          <select className="input" value={view.doc.input.voiceId} disabled={blocked} onChange={(e) => onVoiceChange(e.target.value)}>
            {voices.some((v) => v.id === view.doc.input.voiceId) ? null : <option value={view.doc.input.voiceId}>Previous voice (choose a new one)</option>}
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
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

      {ready ? (
        <div className="stack" style={{ ['--gap' as string]: '8px' }}>
          <h3 style={{ margin: 0 }}>{render ? 'Final video' : 'Draft preview'}</h3>
          <video controls autoPlay playsInline preload="auto" src={`/api/jobs/${ready.id}/download?inline=1`} style={{ width: '100%', maxWidth: 720, borderRadius: 12 }} />
          {dlError ? (
            <p className="alert error small" role="alert">
              {dlError}
            </p>
          ) : null}
          <div className="row">
            <Link className="btn primary" href={`/studio/projects/${view.project.id}/edit`}>
              <Pencil size={16} aria-hidden /> Open edit screen
            </Link>
            <button
              className="btn"
              type="button"
              disabled={dlBusy}
              onClick={() => {
                setDlBusy(true);
                setDlError(null);
                void downloadJobVideo(ready.id, filename).catch((error) => setDlError(errorMessage(error))).finally(() => setDlBusy(false));
              }}
            >
              <Download size={16} aria-hidden /> {dlBusy ? 'Preparing…' : 'Download MP4'}
            </button>
            <span className="small muted">{render ? 'Kept for 30 days after rendering.' : 'Low-resolution draft, kept for 7 days.'}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
