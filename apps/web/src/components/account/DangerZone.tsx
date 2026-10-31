'use client';

import { DELETION_REASONS, type DeletionReasonId } from '@minkflow/contracts';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/client';

/** Records a deletion request and signs the user out; an operator completes it within 30 days. */
export function DangerZone({ email }: { email: string }) {
  const [reason, setReason] = useState<DeletionReasonId | ''>('');
  const [note, setNote] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit =
    Boolean(reason) &&
    (reason !== 'other' || note.trim().length > 0) &&
    confirmText.trim().toLowerCase() === email.toLowerCase();

  async function requestDeletion() {
    if (!reason || !canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/profile/deletion', { method: 'POST', body: { requested: true, reason, note: reason === 'other' ? note.trim() : undefined } });
      await fetch('/auth/signout', { method: 'POST' });
      window.location.assign('/?account=deletion-requested');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <section className="card stack" aria-labelledby="danger-heading" style={{ ['--gap' as string]: '12px', borderColor: 'var(--state-error)' }}>
      <h2 id="danger-heading" style={{ margin: 0, fontSize: 18 }}>
        Delete account
      </h2>
      <p className="small" style={{ margin: 0 }}>
        This permanently deletes your projects, videos, uploads and remaining credits within 30 days, and disconnects
        YouTube. Payment records we are legally required to keep are retained. Until then you can sign back in and cancel.
      </p>
      <label className="field">
        Why do you want to delete your account?
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value as DeletionReasonId | '')} required>
          <option value="" disabled>
            Choose a reason
          </option>
          {DELETION_REASONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {reason === 'other' ? (
        <label className="field">
          Please tell us a bit more
          <input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </label>
      ) : null}
      <label className="field">
        <span>
          Type <strong>{email}</strong> to confirm
        </span>
        <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
      </label>
      {error ? (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div>
        <button type="button" className="btn danger" onClick={() => void requestDeletion()} disabled={busy || !canSubmit}>
          {busy ? 'Requesting…' : 'Delete my account'}
        </button>
      </div>
    </section>
  );
}
