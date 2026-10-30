'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/client';

export function GrantCreditsForm() {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState('Beta tester');
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="stack"
      style={{ ['--gap' as string]: '10px', maxWidth: 480 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setMessage(null);
        try {
          const res = await api<{ granted: boolean }>('/api/admin/grant', { method: 'POST', body: { email, credits: amount, reason, requestKey }, idempotencyKey: requestKey });
          setMessage({ ok: true, text: res.granted ? `Granted ${amount} credits to ${email}.` : 'Already granted (duplicate request).' });
          setRequestKey(crypto.randomUUID());
        } catch (error) {
          setMessage({ ok: false, text: errorMessage(error) });
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="field">
        User email
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        Credits
        <input className="input" type="number" min={1} max={10000} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </label>
      <label className="field">
        Reason (audited)
        <input className="input" required minLength={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Granting…' : 'Grant credits'}
      </button>
      {message ? (
        <p className={`alert ${message.ok ? 'success' : 'error'}`} role="status">
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
