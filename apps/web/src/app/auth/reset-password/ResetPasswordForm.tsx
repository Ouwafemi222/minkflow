'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const MIN_PASSWORD = 8;

export function ResetPasswordForm({ supabaseUrl, supabaseAnonKey }: { supabaseUrl: string; supabaseAnonKey: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) return setMessage(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setMessage('The two passwords do not match.');
    setBusy(true);
    setMessage('');
    const { error } = await createBrowserClient(supabaseUrl, supabaseAnonKey).auth.updateUser({ password });
    setBusy(false);
    if (!error) {
      router.push('/studio');
      router.refresh();
      return;
    }
    setMessage(
      error.code === 'same_password'
        ? 'Choose a password different from your current one.'
        : error.code === 'weak_password'
          ? error.message || 'Choose a stronger password.'
          : 'Could not update your password. Request a new reset email and try again.',
    );
  }

  return (
    <form onSubmit={submit} className="stack" noValidate>
      <label className="field">
        New password
        <input className="input" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label className="field">
        Confirm new password
        <input className="input" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      {message ? (
        <p className="error-text" role="alert">
          {message}
        </p>
      ) : null}
      <button className="btn primary" type="submit" disabled={busy || !password || !confirm}>
        {busy ? 'Saving…' : 'Save password and continue'}
      </button>
    </form>
  );
}
