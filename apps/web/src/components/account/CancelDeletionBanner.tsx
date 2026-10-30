'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/client';

export function CancelDeletionBanner({ requestedAt }: { requestedAt: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      await api('/api/profile/deletion', { method: 'POST', body: { requested: false } });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="alert warning row" role="status" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      <span>
        Your account is scheduled for deletion (requested {new Date(requestedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}).
        {error ? ` ${error}` : ''}
      </span>
      <button type="button" className="btn sm" onClick={() => void cancel()} disabled={busy}>
        {busy ? 'Cancelling…' : 'Keep my account'}
      </button>
    </div>
  );
}
