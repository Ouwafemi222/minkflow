'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

interface Props {
  driver: 'dev' | 'supabase';
  supabaseUrl: string;
  supabaseAnonKey: string;
  redirectTo: string;
  next: string;
}

const RESEND_SECONDS = 60;

export function LoginForm({ driver, supabaseUrl, supabaseAnonKey, redirectTo, next }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'verifying'>('idle');
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const supabase = () => createBrowserClient(supabaseUrl, supabaseAnonKey);

  function enterStudio() {
    router.push(next);
    router.refresh();
  }

  async function sendEmail(event?: FormEvent) {
    event?.preventDefault();
    setState('sending');
    setMessage('');
    if (driver === 'dev') {
      const res = await fetch('/api/auth/dev-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (res.ok) return enterStudio();
      setState('idle');
      setMessage('Could not sign in. Check the email address.');
      return;
    }
    const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) {
      setState(cooldown > 0 || state === 'sent' ? 'sent' : 'idle');
      setMessage(error.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : 'We could not send the email. Please try again.');
      return;
    }
    setCooldown(RESEND_SECONDS);
    setState('sent');
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setState('verifying');
    setMessage('');
    const { error } = await supabase().auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (!error) return enterStudio();
    setState('sent');
    setMessage('That code is invalid or expired. Check the latest email or send a new one.');
  }

  if (state === 'sent' || state === 'verifying') {
    return (
      <form onSubmit={verifyCode} className="stack" noValidate>
        <p className="alert success" role="status">
          We sent a sign-in email to <strong>{email}</strong>. Click the link in it, or enter the code below. It expires in one hour.
        </p>
        <label className="field">
          Sign-in code
          <input
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            aria-describedby={message ? 'login-error' : undefined}
          />
        </label>
        {message ? (
          <p id="login-error" className="error-text" role="alert">
            {message}
          </p>
        ) : null}
        <button className="btn primary" type="submit" disabled={state === 'verifying' || code.length < 6}>
          {state === 'verifying' ? 'Checking…' : 'Continue'}
        </button>
        <div className="row small" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn ghost small" onClick={() => void sendEmail()} disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
          </button>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              setState('idle');
              setCode('');
              setMessage('');
            }}
          >
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendEmail} className="stack" noValidate>
      {driver === 'dev' ? (
        <p className="alert warning small">
          Local development mode: Supabase is not connected, so any email signs in instantly and nothing is sent.
        </p>
      ) : null}
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
        {state === 'sending' ? 'Sending…' : driver === 'dev' ? 'Sign in' : 'Continue with email'}
      </button>
      {driver === 'supabase' ? <p className="small muted">No password needed. New here? This creates your account with 60 free trial credits.</p> : null}
    </form>
  );
}
