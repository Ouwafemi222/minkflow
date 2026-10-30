'use client';

import { AUDIENCES, DURATION_PRESETS_SECONDS, ProjectInputSchema, THEME_PRESETS, TONES } from '@minkflow/contracts';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/client';

interface Voice {
  id: string;
  name: string;
  description: string;
}

const THEME_LABELS: Record<keyof typeof THEME_PRESETS, string> = { minkflow_dark: 'Midnight (dark)', paper_light: 'Paper (light)', warm_studio: 'Warm studio' };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function NewProjectForm({ voices }: { voices: Voice[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<'topic' | 'script'>('topic');
  const [topic, setTopic] = useState('');
  const [script, setScript] = useState('');
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>('general');
  const [tone, setTone] = useState<(typeof TONES)[number]>('friendly');
  const [targetSeconds, setTargetSeconds] = useState<number>(60);
  const [voiceId, setVoiceId] = useState(voices[0]?.id ?? '');
  const [themePreset, setThemePreset] = useState<keyof typeof THEME_PRESETS>('minkflow_dark');
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    const input = { mode, topic: mode === 'topic' ? topic : undefined, script: mode === 'script' ? script : undefined, audience, tone, targetSeconds, language: 'en', aspectRatio: '16:9', voiceId };
    const parsed = ProjectInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const title = (mode === 'topic' ? topic : script.split('\n')[0] ?? 'Untitled').trim().slice(0, 80) || 'Untitled video';
      const { project } = await api<{ project: { id: string } }>('/api/projects', { method: 'POST', body: { title, input: parsed.data, themePreset, captionsEnabled } });
      await api(`/api/projects/${project.id}/script`, { method: 'POST', idempotencyKey: `initial-${project.id}` });
      router.push(`/studio/projects/${project.id}`);
    } catch (error) {
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit} noValidate style={{ ['--gap' as string]: '16px' }}>
      <fieldset className="row" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Start from</legend>
        <button type="button" className={`btn ${mode === 'topic' ? 'primary' : ''}`} aria-pressed={mode === 'topic'} onClick={() => setMode('topic')}>
          Start from a topic
        </button>
        <button type="button" className={`btn ${mode === 'script' ? 'primary' : ''}`} aria-pressed={mode === 'script'} onClick={() => setMode('script')}>
          Paste my script
        </button>
      </fieldset>

      {mode === 'topic' ? (
        <label className="field">
          What should the video explain?
          <input className="input" value={topic} maxLength={300} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. How compound interest works" aria-invalid={Boolean(errors.topic)} aria-describedby="topic-err" />
          <span id="topic-err" className="error-text">{errors.topic}</span>
        </label>
      ) : (
        <label className="field">
          Your script
          <span className="hint">We’ll split it into sections and flag claims to double-check. Up to 9,000 characters.</span>
          <textarea className="input" rows={10} value={script} maxLength={9000} onChange={(e) => setScript(e.target.value)} aria-invalid={Boolean(errors.script)} aria-describedby="script-err" />
          <span id="script-err" className="error-text">{errors.script}</span>
        </label>
      )}

      <div className="grid" style={{ ['--min' as string]: '200px' }}>
        <label className="field">
          Audience
          <select className="input" value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
            {AUDIENCES.map((a) => <option key={a} value={a}>{cap(a)}</option>)}
          </select>
        </label>
        <label className="field">
          Tone
          <select className="input" value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
            {TONES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
          </select>
        </label>
        <label className="field">
          Length
          <select className="input" value={targetSeconds} onChange={(e) => setTargetSeconds(Number(e.target.value))}>
            {DURATION_PRESETS_SECONDS.map((s) => <option key={s} value={s}>{s / 60} minute{s > 60 ? 's' : ''}</option>)}
          </select>
        </label>
        <label className="field">
          Voice
          <select className="input" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} aria-invalid={Boolean(errors.voiceId)}>
            {voices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          {voices.length === 0 ? <span className="error-text">No voices are configured.</span> : null}
        </label>
        <label className="field">
          Look
          <select className="input" value={themePreset} onChange={(e) => setThemePreset(e.target.value as typeof themePreset)}>
            {Object.keys(THEME_PRESETS).map((k) => <option key={k} value={k}>{THEME_LABELS[k as keyof typeof THEME_PRESETS]}</option>)}
          </select>
        </label>
        <label className="row" style={{ alignSelf: 'end', minHeight: 40 }}>
          <input type="checkbox" checked={captionsEnabled} onChange={(e) => setCaptionsEnabled(e.target.checked)} />
          Burn in captions
        </label>
      </div>

      {formError ? <p className="alert error" role="alert">{formError}</p> : null}
      <div className="row">
        <button className="btn primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Write my script'}
        </button>
        <span className="small muted">You can edit everything before anything is voiced or rendered.</span>
      </div>
    </form>
  );
}
