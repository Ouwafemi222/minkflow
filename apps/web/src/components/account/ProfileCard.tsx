'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/Avatar';
import { api, errorMessage } from '@/lib/client';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

interface Props {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  avatarMode: 'auto' | 'upload' | 'none';
  providerAvatarUrl: string | null;
  providers: string[];
}

const PROVIDER_LABELS: Record<string, string> = { email: 'Email', google: 'Google' };

export function ProfileCard({ displayName, email, avatarUrl, avatarMode, providerAvatarUrl, providers }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(displayName);
  const [busy, setBusy] = useState<null | 'name' | 'photo'>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function act(kind: 'name' | 'photo', fn: () => Promise<void>, done: string) {
    setBusy(kind);
    setStatus(null);
    try {
      await fn();
      setStatus({ kind: 'ok', text: done });
      router.refresh();
    } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error && !('body' in error) ? error.message : errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  function saveName(event: FormEvent) {
    event.preventDefault();
    void act('name', () => api('/api/profile', { method: 'PATCH', body: { displayName: name.trim() } }).then(() => undefined), 'Name saved.');
  }

  function upload(file: File) {
    void act(
      'photo',
      async () => {
        if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_BYTES) throw new Error('Choose a PNG, JPEG or WebP image up to 2 MB.');
        const target = await api<{ key: string; url: string; headers: Record<string, string> }>('/api/assets/upload-url', { method: 'POST', body: { contentType: file.type, size: file.size } });
        const put = await fetch(target.url, { method: 'PUT', headers: target.headers, body: file });
        if (!put.ok) throw new Error('Upload failed. Please try again.');
        await api('/api/profile/avatar', { method: 'POST', body: { key: target.key } });
        if (fileRef.current) fileRef.current.value = '';
      },
      'Photo updated.',
    );
  }

  const setMode = (mode: 'auto' | 'none', done: string) => act('photo', () => api('/api/profile', { method: 'PATCH', body: { avatarMode: mode } }).then(() => undefined), done);

  return (
    <section className="card stack" aria-labelledby="profile-heading" style={{ ['--gap' as string]: '18px' }}>
      <h2 id="profile-heading" style={{ margin: 0, fontSize: 18 }}>
        Profile
      </h2>
      <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Avatar src={avatarUrl} name={displayName} size={72} />
        <div className="stack" style={{ ['--gap' as string]: '8px' }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn sm" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
              {busy === 'photo' ? 'Saving…' : 'Upload photo'}
            </button>
            {providerAvatarUrl && avatarMode !== 'auto' ? (
              <button type="button" className="btn sm ghost" onClick={() => void setMode('auto', 'Using your Google photo.')} disabled={busy !== null}>
                Use Google photo
              </button>
            ) : null}
            {avatarUrl ? (
              <button type="button" className="btn sm ghost" onClick={() => void setMode('none', 'Photo removed.')} disabled={busy !== null}>
                Remove photo
              </button>
            ) : null}
          </div>
          <span className="hint">
            {avatarMode === 'auto' && providerAvatarUrl ? 'Showing your Google profile photo. ' : ''}PNG, JPEG or WebP, up to 2 MB.
          </span>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_TYPES.join(',')}
            hidden
            aria-label="Upload profile photo"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
        </div>
      </div>

      <form onSubmit={saveName} className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: '1 1 260px' }}>
          Display name
          <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <button className="btn primary" type="submit" disabled={busy !== null || !name.trim() || name.trim() === displayName}>
          {busy === 'name' ? 'Saving…' : 'Save'}
        </button>
      </form>

      <dl className="stack small" style={{ ['--gap' as string]: '6px', margin: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <dt className="muted" style={{ minWidth: 110 }}>
            Email
          </dt>
          <dd style={{ margin: 0 }}>{email}</dd>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <dt className="muted" style={{ minWidth: 110 }}>
            Sign-in methods
          </dt>
          <dd style={{ margin: 0 }}>{providers.length ? providers.map((p) => PROVIDER_LABELS[p] ?? p).join(', ') : 'Email'}</dd>
        </div>
      </dl>

      {status ? (
        <p className={status.kind === 'ok' ? 'alert success small' : 'error-text'} role={status.kind === 'ok' ? 'status' : 'alert'} style={{ margin: 0 }}>
          {status.text}
        </p>
      ) : null}
    </section>
  );
}
