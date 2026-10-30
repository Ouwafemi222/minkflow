'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar, YoutubeMark } from '@/components/Avatar';
import { api, errorMessage } from '@/lib/client';

interface Props {
  available: boolean;
  channel: { id: string; title: string; thumbnailUrl: string | null; connectedAt: string } | null;
  result: string | null;
}

const RESULTS: Record<string, { kind: 'success' | 'error' | 'warning'; text: string }> = {
  connected: { kind: 'success', text: 'Your YouTube channel is connected.' },
  denied: { kind: 'warning', text: 'You cancelled the Google permission screen, so nothing was connected.' },
  no_channel: { kind: 'warning', text: 'That Google account has no YouTube channel. Create one on YouTube, or pick a different account.' },
  expired: { kind: 'error', text: 'That connection attempt expired. Please try again.' },
  error: { kind: 'error', text: 'Could not connect YouTube. Please try again.' },
  unavailable: { kind: 'warning', text: 'YouTube connections are not switched on for this site yet.' },
};

export function YoutubeCard({ available, channel, result }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const notice = result ? RESULTS[result] : undefined;

  async function disconnect() {
    if (!window.confirm('Disconnect this YouTube channel from Minkflow? You can reconnect it any time.')) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/youtube/disconnect', { method: 'POST' });
      router.replace('/studio/account#youtube');
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="youtube" className="card stack" aria-labelledby="youtube-heading" style={{ ['--gap' as string]: '14px', scrollMarginTop: 24 }}>
      <h2 id="youtube-heading" className="row" style={{ margin: 0, fontSize: 18, gap: 10, alignItems: 'center' }}>
        <YoutubeMark size={24} /> YouTube
      </h2>
      {notice ? (
        <p className={`alert ${notice.kind} small`} role="status" style={{ margin: 0 }}>
          {notice.text}
        </p>
      ) : null}

      {channel ? (
        <>
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <Avatar src={channel.thumbnailUrl} name={channel.title} size={48} />
            <div className="stack" style={{ ['--gap' as string]: '2px', minWidth: 0 }}>
              <strong>{channel.title}</strong>
              <a className="small" href={`https://www.youtube.com/channel/${encodeURIComponent(channel.id)}`} target="_blank" rel="noopener noreferrer">
                View channel
              </a>
              <span className="small muted">Connected {new Date(channel.connectedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
            </div>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Minkflow can read your channel name and picture. Publishing videos straight to YouTube is coming next; it will ask
            Google for upload permission first.
          </p>
          <div>
            <button type="button" className="btn sm danger" onClick={() => void disconnect()} disabled={busy}>
              {busy ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            Connect your channel so Minkflow knows where your videos are going. You&apos;ll sign in with Google and approve
            read-only access to your channel name and picture. You can disconnect at any time.
          </p>
          {available ? (
            <div>
              {/* Full navigation (not client routing): the server redirects to Google. */}
              <a className="btn primary" href="/api/youtube/connect">
                <YoutubeMark size={20} /> Connect your YouTube
              </a>
            </div>
          ) : (
            <p className="alert warning small" style={{ margin: 0 }}>
              YouTube connections are not switched on for this site yet. The site owner needs to add Google OAuth credentials.
            </p>
          )}
        </>
      )}
      {error ? (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
