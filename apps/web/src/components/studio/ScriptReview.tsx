'use client';

import { useState } from 'react';
import { api, ApiError, errorMessage } from '@/lib/client';
import { credits } from '@/lib/labels';
import type { ProjectView } from '@/lib/project-view';

interface Props {
  view: ProjectView;
  busy: boolean;
  onSaved: (version: number) => void;
  onApproved: () => void;
  onBuildStoryboard: () => void;
  onRegenerate: () => void;
  onError: (text: string) => void;
}

export function ScriptReview({ view, busy, onSaved, onApproved, onBuildStoryboard, onRegenerate, onError }: Props) {
  const script = view.doc.script!;
  const [title, setTitle] = useState(script.title);
  const [sections, setSections] = useState(script.sections);
  const [ack, setAck] = useState(script.claimsAcknowledged);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const approved = view.scriptApproved && !dirty;
  const editable = ['script_ready', 'storyboard_ready', 'failed', 'canceled'].includes(view.project.status);

  async function save(): Promise<number | null> {
    if (!dirty) return view.project.version;
    setSaving(true);
    try {
      const res = await api<{ version: number }>(`/api/projects/${view.project.id}/document`, { method: 'PUT', body: { expectedVersion: view.project.version, script: { title, sections } } });
      setDirty(false);
      setAck(false);
      onSaved(res.version);
      return res.version;
    } catch (error) {
      onError(error instanceof ApiError && error.body.code === 'REVISION_CONFLICT' ? 'The script changed in another tab. Reload to continue.' : errorMessage(error));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    const version = await save();
    if (version === null) return;
    try {
      await api(`/api/projects/${view.project.id}/script/approve`, { method: 'POST', body: { expectedVersion: version, claimsAcknowledged: true } });
      onApproved();
    } catch (error) {
      onError(errorMessage(error));
    }
  }

  const update = (i: number, patch: Partial<(typeof sections)[number]>) => {
    setSections((s) => s.map((sec, j) => (j === i ? { ...sec, ...patch } : sec)));
    setDirty(true);
  };

  const words = sections.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);

  return (
    <section className="card stack" aria-labelledby="script-heading" style={{ ['--gap' as string]: '14px' }}>
      <div className="spread">
        <h2 id="script-heading" style={{ margin: 0 }}>
          Review your script
        </h2>
        <span className="small muted">
          {words} words · about {Math.round(words / 2.6)} seconds of narration
        </span>
      </div>
      <label className="field">
        Video title
        <input className="input" value={title} maxLength={100} disabled={!editable} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} onBlur={() => void save()} />
      </label>
      {sections.map((section, i) => (
        <div key={i} className="stack" style={{ ['--gap' as string]: '6px' }}>
          <label className="field">
            <span>
              <span className="badge">{section.kind}</span> Section {i + 1} heading
            </span>
            <input className="input" value={section.heading} maxLength={80} disabled={!editable} onChange={(e) => update(i, { heading: e.target.value })} onBlur={() => void save()} />
          </label>
          <label className="field">
            <span className="sr-only">Section {i + 1} narration</span>
            <textarea className="input" rows={4} value={section.text} maxLength={2500} disabled={!editable} onChange={(e) => update(i, { text: e.target.value })} onBlur={() => void save()} />
          </label>
          {script.claims.filter((c) => c.sectionIndex === i).map((c, k) => (
            <div key={k} className="claim small">
              <strong>Check this claim:</strong> “{c.text}” <span className="muted">— {c.reason}</span>
            </div>
          ))}
        </div>
      ))}

      {script.claims.length > 0 ? (
        <label className="row alert warning">
          <input type="checkbox" checked={ack} disabled={approved} onChange={(e) => setAck(e.target.checked)} />
          I have checked the {script.claims.length} flagged statement{script.claims.length === 1 ? '' : 's'} and I am responsible for their accuracy.
        </label>
      ) : null}

      <div className="row">
        {approved ? (
          <>
            <span className="badge success">Script approved</span>
            <button className="btn primary" disabled={busy} onClick={onBuildStoryboard}>
              Build storyboard · {credits(view.quotes.storyboard)} credits
            </button>
          </>
        ) : (
          <button className="btn primary" disabled={busy || saving || !editable || (script.claims.length > 0 && !ack)} onClick={() => void approve()}>
            {saving ? 'Saving…' : 'Approve script'}
          </button>
        )}
        <button className="btn ghost" disabled={busy || !editable} onClick={onRegenerate}>
          Rewrite from scratch · {credits(view.quotes.script)} credits
        </button>
        {dirty ? <span className="small muted">Unsaved changes</span> : null}
      </div>
    </section>
  );
}
