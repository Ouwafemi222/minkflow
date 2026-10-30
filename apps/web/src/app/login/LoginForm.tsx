'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

interface Props {
  driver: 'dev' | 'supabase';
  supabaseUrl: string;
  supabaseAnonKey: string;
  redirectTo: string;
}

export function LoginForm({ driver, supabaseUrl, supabaseAnonKey, redirectTo }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState('sending');
    setMessage('');
    if (driver === 'dev') {
      const res = await fetch('/api/auth/dev-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (res.ok) {
        router.push('/studio');
        router.refresh();
        return;
      }
      setState('error');
      setMessage('Could not sign in. Check the email address.');
      return;
    }
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) {
      setState('error');
      setMessage(error.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : 'We could not send the link. Please try again.');
      return;
    }
    setState('sent');
  }

  if (state === 'sent') {
    return (
      <p className="alert success" role="status">
        Check your inbox for a sign-in link. It expires in one hour.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="stack" noValidate>
      {driver === 'dev' ? <p className="alert warning small">Local development sign-in: no password or email is sent.</p> : null}
      <label className="field">
        Email
        <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={message ? 'login-error' : undefined} />
      </label>
      {message ? (
        <p id="login-error" className="error-text" role="alert">
          {message}
        </p>
      ) : null}
      <button className="btn primary" type="submit" disabled={state === 'sending' || !email.includes('@')}>
        {state === 'sending' ? 'Sending…' : driver === 'dev' ? 'Sign in' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}
