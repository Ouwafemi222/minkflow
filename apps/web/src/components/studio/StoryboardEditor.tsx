'use client';

import { defaultVisualFor, mergeClientStoryboard, storyboardSeconds, TEMPLATE_IDS, TEMPLATE_META, DURATION_LIMITS, VIDEO, type Scene } from '@minkflow/contracts';
import type { PlayerRef } from '@remotion/player';
import { ArrowDown, ArrowUp, Copy, Mic, MicOff, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { z } from 'zod';
import { api, ApiError, errorMessage } from '@/lib/client';
import { createHistory, moveItem, push, redo, replace, undo, type History } from '@/lib/history';
import { credits } from '@/lib/labels';
import type { ProjectView } from '@/lib/project-view';
import { PreviewPlayer } from './PreviewPlayer';
import { VisualEditor } from './VisualEditor';

type Draft = { id: string; template: string; narration: string; visual: unknown; transition: Scene['transition'] };
type Action = { type: 'edit'; next: Draft[] } | { type: 'undo' } | { type: 'redo' } | { type: 'sync'; next: Draft[] };
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

const TRANSITIONS: Scene['transition'][] = ['none', 'fade', 'slide_left', 'slide_up', 'zoom'];
const EDITABLE = new Set(['storyboard_ready', 'media_ready', 'preview_ready', 'completed', 'failed', 'canceled']);
const toDraft = (s: Scene): Draft => ({ id: s.id, template: s.template, narration: s.narration, visual: s.visual, transition: s.transition });

function reducer(h: History<Draft[]>, a: Action): History<Draft[]> {
  if (a.type === 'edit') return push(h, a.next);
  if (a.type === 'undo') return undo(h);
  if (a.type === 'redo') return redo(h);
  return replace(h, a.next);
}

/** Validates a draft against the last saved scenes using the same merge the server runs (voice kept only if narration is unchanged). */
function derive(saved: Scene[], draft: Draft): { scene: Scene | null; error: string | null } {
  try {
    return { scene: mergeClientStoryboard(saved, { scenes: [draft] })[0]!, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return { scene: null, error: issue ? `${issue.path.join(' › ') || 'scene'}: ${issue.message}` : 'Invalid scene' };
    }
    return { scene: null, error: error instanceof Error ? error.message : 'Invalid scene' };
  }
}

interface Props {
  view: ProjectView;
  busy: boolean;
  onSaveState: (state: SaveState) => void;
  onSaved: (version: number, status: string, scenes: Scene[] | null) => void;
  onConflict: () => void;
  onError: (text: string) => void;
  onRegenerateScene: (sceneId: string, instruction: string) => void;
}

export function StoryboardEditor({ view, busy, onSaveState, onSaved, onConflict, onError, onRegenerateScene }: Props) {
  const serverScenes = view.doc.storyboard!.scenes;
  const [history, dispatch] = useReducer(reducer, serverScenes, (s) => createHistory(s.map(toDraft)));
  const [selectedId, setSelectedId] = useState(serverScenes[0]?.id ?? '');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [instruction, setInstruction] = useState('');
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const saved = useRef(serverScenes);
  const version = useRef(view.project.version);
  const editSeq = useRef(0);
  const savedSeq = useRef(0);
  const playerRef = useRef<PlayerRef>(null);
  const jobActive = view.jobs.some((j) => j.status === 'queued' || j.status === 'running' || j.status === 'retry_pending');
  const editable = EDITABLE.has(view.project.status) && !jobActive && saveState !== 'conflict';

  const updateSaveState = useCallback(
    (s: SaveState) => {
      setSaveState(s);
      onSaveState(s);
    },
    [onSaveState],
  );

  // Adopt server changes (voice generation, scene regeneration) when there are no local unsaved edits.
  useEffect(() => {
    if (view.project.version <= version.current || editSeq.current !== savedSeq.current) return;
    version.current = view.project.version;
    saved.current = view.doc.storyboard!.scenes;
    dispatch({ type: 'sync', next: saved.current.map(toDraft) });
  }, [view.project.version, view.doc.storyboard]);

  const derived = useMemo(() => history.present.map((d) => ({ draft: d, ...derive(saved.current, d) })), [history.present]);
  const valid = derived.every((d) => d.scene);
  const scenes = useMemo(() => derived.map((d) => d.scene).filter((s): s is Scene => s !== null), [derived]);
  const seconds = storyboardSeconds(scenes);
  const selectedIndex = Math.max(0, history.present.findIndex((d) => d.id === selectedId));
  const selected = derived[selectedIndex];

  const edit = (next: Draft[]) => {
    if (!editable) return;
    editSeq.current += 1;
    dispatch({ type: 'edit', next });
  };
  const patchSelected = (patch: Partial<Draft>) => edit(history.present.map((d, i) => (i === selectedIndex ? { ...d, ...patch } : d)));

  // Debounced autosave with optimistic concurrency.
  useEffect(() => {
    if (editSeq.current === savedSeq.current) return;
    if (!valid) {
      updateSaveState('error');
      return;
    }
    updateSaveState('dirty');
    const seq = editSeq.current;
    const timer = setTimeout(async () => {
      updateSaveState('saving');
      try {
        const res = await api<{ version: number; status: string; scenes: Scene[] | null }>(`/api/projects/${view.project.id}/document`, {
          method: 'PUT',
          body: { expectedVersion: version.current, storyboard: { scenes: history.present } },
        });
        version.current = res.version;
        if (res.scenes) saved.current = res.scenes;
        savedSeq.current = seq;
        onSaved(res.version, res.status, res.scenes);
        updateSaveState(editSeq.current === seq ? 'saved' : 'dirty');
      } catch (error) {
        if (error instanceof ApiError && error.body.code === 'REVISION_CONFLICT') {
          updateSaveState('conflict');
          onConflict();
        } else {
          updateSaveState('error');
          onError(errorMessage(error));
        }
      }
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.present]);

  // Signed URLs for narration audio and the logo, so the in-browser preview plays real voice.
  useEffect(() => {
    const missing = [...new Set(scenes.map((s) => s.voiceAssetId).filter((id): id is string => Boolean(id) && !audioUrls[id!]))];
    if (missing.length === 0) return;
    let cancelled = false;
    void Promise.all(missing.map(async (id) => [id, (await api<{ url: string }>(`/api/assets/${id}/url`)).url] as const))
      .then((pairs) => !cancelled && setAudioUrls((prev) => ({ ...prev, ...Object.fromEntries(pairs) })))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [scenes, audioUrls]);
  useEffect(() => {
    const id = view.doc.brand.logoAssetId;
    if (!id) return setLogoUrl(null);
    void api<{ url: string }>(`/api/assets/${id}/url`).then((r) => setLogoUrl(r.url), () => setLogoUrl(null));
  }, [view.doc.brand.logoAssetId]);

  // Keyboard: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y outside text fields; Alt+Arrow to reorder.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        editSeq.current += 1;
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        editSeq.current += 1;
        dispatch({ type: 'redo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const select = (id: string) => {
    setSelectedId(id);
    const index = history.present.findIndex((d) => d.id === id);
    const frame = scenes.slice(0, index).reduce((n, s) => n + s.durationFrames, 0);
    playerRef.current?.seekTo(frame);
  };

  const move = (from: number, to: number) => edit(moveItem(history.present, from, to));
  const duplicate = (i: number) => {
    if (history.present.length >= DURATION_LIMITS.maxScenes) return onError(`A video can have at most ${DURATION_LIMITS.maxScenes} scenes.`);
    const copy = { ...structuredClone(history.present[i]!), id: crypto.randomUUID() };
    edit([...history.present.slice(0, i + 1), copy, ...history.present.slice(i + 1)]);
    setSelectedId(copy.id);
  };
  const remove = (i: number) => {
    if (history.present.length <= 1) return onError('A video needs at least one scene.');
    const next = history.present.filter((_, j) => j !== i);
    edit(next);
    setSelectedId(next[Math.min(i, next.length - 1)]!.id);
  };
  const add = () => {
    if (history.present.length >= DURATION_LIMITS.maxScenes) return onError(`A video can have at most ${DURATION_LIMITS.maxScenes} scenes.`);
    const narration = 'Write the narration for this scene.';
    const draft: Draft = { id: crypto.randomUUID(), template: 'quote_focus', narration, visual: defaultVisualFor('quote_focus', narration), transition: 'fade' };
    edit([...history.present.slice(0, selectedIndex + 1), draft, ...history.present.slice(selectedIndex + 1)]);
    setSelectedId(draft.id);
  };

  const saveLabel: Record<SaveState, string> = { saved: 'All changes saved', dirty: 'Unsaved changes…', saving: 'Saving…', error: 'Not saved — fix the highlighted scene', conflict: 'Editing paused (changed elsewhere)' };
  const missingVoice = scenes.filter((s) => !s.voiceAssetId).length;

  return (
    <section className="editor" aria-label="Storyboard editor">
      <div className="spread" style={{ gridColumn: '1 / -1' }}>
        <div className="row">
          <h2 style={{ margin: 0 }}>Storyboard</h2>
          <span className="small muted">
            {history.present.length} scenes · {Math.round(seconds)}s
          </span>
          {missingVoice > 0 ? <span className="badge warning">{missingVoice === 1 ? '1 scene needs voice' : `${missingVoice} scenes need voice`}</span> : <span className="badge success">Voice ready</span>}
        </div>
        <div className="row">
          <span className="small muted" role="status" aria-live="polite">
            {saveLabel[saveState]}
          </span>
          <button className="btn sm ghost" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!editable || history.past.length === 0} onClick={() => { editSeq.current += 1; dispatch({ type: 'undo' }); }}>
            <Undo2 size={16} aria-hidden />
          </button>
          <button className="btn sm ghost" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!editable || history.future.length === 0} onClick={() => { editSeq.current += 1; dispatch({ type: 'redo' }); }}>
            <Redo2 size={16} aria-hidden />
          </button>
        </div>
      </div>

      <ol className="scene-list" aria-label="Scenes">
        {derived.map(({ draft, scene, error }, i) => (
          <li key={draft.id} className={`scene-item${i === selectedIndex ? ' selected' : ''}${error ? ' invalid' : ''}`}>
            <button className="scene-select" aria-current={i === selectedIndex} onClick={() => select(draft.id)}>
              <span className="small muted">
                {i + 1}. {TEMPLATE_META[draft.template as Scene['template']]?.label ?? draft.template}
              </span>
              <span className="scene-text">{draft.narration}</span>
              <span className="small muted row" style={{ ['--gap' as string]: '4px' }}>
                {scene?.voiceAssetId ? <Mic size={12} aria-label="Voice ready" /> : <MicOff size={12} aria-label="Needs voice" />}
                {scene ? `${(scene.durationFrames / VIDEO.fps).toFixed(1)}s` : 'Invalid'}
              </span>
            </button>
            {i === selectedIndex && editable ? (
              <div className="row" style={{ ['--gap' as string]: '2px' }}>
                <button className="btn sm ghost" aria-label="Move scene up" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button className="btn sm ghost" aria-label="Move scene down" disabled={i === derived.length - 1} onClick={() => move(i, i + 1)}>
                  <ArrowDown size={14} aria-hidden />
                </button>
                <button className="btn sm ghost" aria-label="Duplicate scene" onClick={() => duplicate(i)}>
                  <Copy size={14} aria-hidden />
                </button>
                <button className="btn sm ghost" aria-label="Delete scene" onClick={() => remove(i)}>
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            ) : null}
          </li>
        ))}
        {editable ? (
          <li>
            <button className="btn sm" style={{ width: '100%' }} onClick={add}>
              <Plus size={14} aria-hidden /> Add scene
            </button>
          </li>
        ) : null}
      </ol>

      <div className="stack" style={{ ['--gap' as string]: '10px', minWidth: 0 }}>
        {scenes.length > 0 ? (
          <PreviewPlayer
            ref={playerRef}
            projectId={view.project.id}
            scenes={scenes}
            theme={view.doc.brand.theme}
            captionsEnabled={view.doc.brand.captionsEnabled}
            watermark={view.watermark ? 'Made with Minkflow' : null}
            audioUrls={audioUrls}
            logoUrl={logoUrl}
          />
        ) : null}
        <div className="timeline" role="group" aria-label="Timeline" style={{ marginTop: 0 }}>
          {derived.map(({ draft, scene }, i) => (
            <button
              key={draft.id}
              aria-label={`Scene ${i + 1}`}
              className={i === selectedIndex ? 'selected' : undefined}
              style={{ flexGrow: scene?.durationFrames ?? 60 }}
              title={`Scene ${i + 1}`}
              onClick={() => select(draft.id)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        {missingVoice > 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            The live preview uses estimated timing for scenes without voice. Generate voice for exact timing and captions.
          </p>
        ) : null}
      </div>

      {selected ? (
        <aside className="card stack inspector" aria-label={`Scene ${selectedIndex + 1} settings`} style={{ ['--gap' as string]: '12px' }}>
          <h3 style={{ margin: 0 }}>Scene {selectedIndex + 1}</h3>
          {selected.error ? (
            <p className="alert error small" role="alert">
              {selected.error}
            </p>
          ) : null}
          <fieldset disabled={!editable} className="stack" style={{ ['--gap' as string]: '12px', border: 0, padding: 0, margin: 0 }}>
            <label className="field">
              Template
              <select
                className="input"
                value={selected.draft.template}
                onChange={(e) => {
                  const template = e.target.value as Scene['template'];
                  patchSelected({ template, visual: defaultVisualFor(template, selected.draft.narration) });
                }}
              >
                {TEMPLATE_IDS.map((t) => (
                  <option key={t} value={t}>
                    {TEMPLATE_META[t].label}
                  </option>
                ))}
              </select>
            </label>
            <div className="stack" style={{ ['--gap' as string]: '6px' }}>
              <label className="field">
                Narration
                <textarea className="input" rows={5} maxLength={600} value={selected.draft.narration} aria-describedby="narration-hint" onChange={(e) => patchSelected({ narration: e.target.value })} />
              </label>
              <span id="narration-hint" className="small muted">
                {selected.scene?.voiceAssetId ? 'Editing the narration regenerates the voice for this scene only.' : 'Voice will be generated for this scene only.'}
              </span>
            </div>
            <label className="field">
              Transition in
              <select className="input" value={selected.draft.transition} onChange={(e) => patchSelected({ transition: e.target.value as Scene['transition'] })}>
                {TRANSITIONS.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="stack" style={{ ['--gap' as string]: '8px', border: '1px solid var(--border-default)', borderRadius: 10, padding: 12 }}>
              <legend className="small" style={{ fontWeight: 600 }}>
                On-screen content
              </legend>
              <VisualEditor key={selected.draft.id + selected.draft.template} value={selected.draft.visual as never} onChange={(visual) => patchSelected({ visual })} />
            </fieldset>
          </fieldset>
          <div className="stack" style={{ ['--gap' as string]: '6px' }}>
            <label className="field">
              Redesign this scene with AI
              <input className="input" placeholder="e.g. show this as a timeline" maxLength={300} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
            </label>
            <button
              className="btn sm"
              disabled={!editable || busy || saveState !== 'saved'}
              onClick={() => {
                onRegenerateScene(selected.draft.id, instruction.trim());
                setInstruction('');
              }}
            >
              Redesign scene · {credits(view.quotes.sceneRegenerate)} credits
            </button>
            <span className="small muted">Keeps your narration and voice; only the visuals change.</span>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
