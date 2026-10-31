'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { api, errorMessage } from '@/lib/client';
import { credits } from '@/lib/labels';
import type { ProjectView } from '@/lib/project-view';
import { BrandPanel } from './BrandPanel';
import { JobsPanel } from './JobsPanel';
import { RenderPanel } from './RenderPanel';
import { ScriptReview } from './ScriptReview';
import { StoryboardEditor, type SaveState } from './StoryboardEditor';

const ACTIVE = new Set(['queued', 'running', 'retry_pending']);
const PENDING_STATUSES = new Set(['script_pending', 'storyboard_pending', 'media_pending', 'render_queued', 'rendering', 'retry_pending']);

export function ProjectStudio({ initial, aiMode, voices }: { initial: ProjectView; aiMode: 'mock' | 'voice' | 'live'; voices: Array<{ id: string; name: string; description: string }> }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'warning'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState(initial.project.title);
  const [saveState, setSaveState] = useState<SaveState>('saved');

  const refresh = useCallback(async () => {
    const next = await api<ProjectView>(`/api/projects/${view.project.id}`);
    setView(next);
    return next;
  }, [view.project.id]);

  const working = view.jobs.some((j) => ACTIVE.has(j.status)) || PENDING_STATUSES.has(view.project.status);
  const wasWorking = useRef(working);
  const hadVideo = useRef(initial.jobs.some((j) => (j.type === 'render' || j.type === 'preview') && j.status === 'completed'));
  useEffect(() => {
    // Re-render server components (sidebar balance) once a job settles its credits.
    if (wasWorking.current && !working) router.refresh();
    wasWorking.current = working;
    const ready = view.jobs.find((j) => (j.type === 'render' || j.type === 'preview') && j.status === 'completed');
    if (ready && !hadVideo.current) {
      hadVideo.current = true;
      router.push(`/studio/projects/${view.project.id}/edit`);
      return;
    }
    if (ready) hadVideo.current = true;
    if (!working) return;
    const timer = setInterval(() => void refresh().catch(() => undefined), 2000);
    return () => clearInterval(timer);
  }, [working, refresh, router, view.jobs, view.project.id]);

  async function run(label: string, path: string, body?: unknown) {
    setBusy(label);
    setNotice(null);
    try {
      await api(path, { method: 'POST', body });
      await refresh();
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === view.project.title) return;
    try {
      await api(`/api/projects/${view.project.id}`, { method: 'PATCH', body: { title: trimmed } });
      setView((v) => ({ ...v, project: { ...v.project, title: trimmed } }));
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    }
  }

  const { doc, project, quotes } = view;
  const scriptWorking = project.status === 'script_pending' || (project.status === 'retry_pending' && !doc.script);
  const storyboardWorking = project.status === 'storyboard_pending';

  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }}>
      <header className="spread">
        <div className="stack" style={{ ['--gap' as string]: '6px', flex: 1, minWidth: 260 }}>
          <label className="sr-only" htmlFor="project-title">
            Project title
          </label>
          <input id="project-title" className="input" style={{ fontSize: 22, fontWeight: 700, background: 'transparent', border: '1px solid transparent', paddingLeft: 0 }} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} onBlur={() => void saveTitle()} />
          <div className="row small">
            <StatusBadge status={project.status} />
            <span className="muted">Balance: {credits(view.balance)} credits</span>
            {aiMode === 'mock' ? <span className="badge warning">Mock AI & voice</span> : null}
            {aiMode === 'voice' ? <span className="badge warning">Mock script · real voice</span> : null}
          </div>
        </div>
      </header>

      {notice ? (
        <p className={`alert ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      ) : null}

      <JobsPanel jobs={view.jobs} onChanged={() => void refresh()} onError={(text) => setNotice({ tone: 'error', text })} />

      {!doc.script ? (
        <section className="card stack" aria-busy={scriptWorking}>
          <h2 style={{ margin: 0 }}>Script</h2>
          {scriptWorking ? (
            <p className="muted">Writing your script… this usually takes under a minute.</p>
          ) : (
            <div className="row">
              <p className="muted" style={{ margin: 0 }}>No script yet.</p>
              <button className="btn primary" disabled={busy !== null} onClick={() => void run('script', `/api/projects/${project.id}/script`)}>
                Write script · {credits(quotes.script)} credits
              </button>
            </div>
          )}
        </section>
      ) : null}

      {doc.script && !doc.storyboard ? (
        <ScriptReview
          view={view}
          busy={busy !== null || storyboardWorking}
          onSaved={(version) => setView((v) => ({ ...v, project: { ...v.project, version } }))}
          onApproved={() => void refresh()}
          onBuildStoryboard={() => void run('storyboard', `/api/projects/${project.id}/storyboard`)}
          onRegenerate={() => void run('script', `/api/projects/${project.id}/script`)}
          onError={(text) => setNotice({ tone: 'error', text })}
        />
      ) : null}
      {storyboardWorking && !doc.storyboard ? <p className="card muted">Building your storyboard…</p> : null}

      {doc.storyboard ? (
        <>
          <StoryboardEditor
            key={project.id}
            view={view}
            onSaveState={setSaveState}
            onSaved={(version, status, scenes) =>
              setView((v) => ({ ...v, project: { ...v.project, version, status }, doc: { ...v.doc, storyboard: scenes ? { scenes } : v.doc.storyboard } }))
            }
            onConflict={() => setNotice({ tone: 'warning', text: 'This project changed in another tab. Reload the page to continue editing.' })}
            onError={(text) => setNotice({ tone: 'error', text })}
            onRegenerateScene={(sceneId, instruction) => void run('regenerate', `/api/projects/${project.id}/scenes/${sceneId}/regenerate`, { instruction })}
            busy={busy !== null}
          />
          <BrandPanel
            view={view}
            disabled={saveState !== 'saved' || busy !== null || view.jobs.some((j) => ACTIVE.has(j.status))}
            onSaved={(version, brand) => setView((v) => ({ ...v, project: { ...v.project, version }, doc: { ...v.doc, brand } }))}
            onError={(text) => setNotice({ tone: 'error', text })}
          />
          <RenderPanel
            view={view}
            voices={voices}
            busy={busy}
            saveState={saveState}
            onRun={(step) => void run(step, `/api/projects/${project.id}/${step}`)}
            onVoiceChange={(voiceId) =>
              void (async () => {
                setBusy('voice');
                setNotice(null);
                try {
                  const next = await api<ProjectView>(`/api/projects/${project.id}`, { method: 'PATCH', body: { voiceId } });
                  setView(next);
                } catch (error) {
                  setNotice({ tone: 'error', text: errorMessage(error) });
                } finally {
                  setBusy(null);
                }
              })()
            }
          />
        </>
      ) : null}
    </div>
  );
}
