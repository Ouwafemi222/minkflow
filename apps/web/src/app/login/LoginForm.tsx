'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { AuthError, EmailOtpType } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

export type AuthMode = 'signin' | 'signup';

interface Props {
  driver: 'dev' | 'supabase';
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Absolute `/auth/callback` URL without query. */
  callbackUrl: string;
  next: string;
  googleEnabled: boolean;
  /** When set, Google consent stays on this site (minkflow.vercel.app) instead of supabase.co. */
  googleStartUrl?: string | null;
  initialMode: AuthMode;
}

type View = AuthMode | 'forgot' | 'code';
type Sent = { kind: 'confirm' | 'reset' | 'code'; email: string };

const MIN_PASSWORD = 8;
const RESEND_SECONDS = 60;

const SENT_COPY: Record<Sent['kind'], string> = {
  confirm: 'We sent a confirmation email to',
  reset: 'We sent a password reset email to',
  code: 'We sent a sign-in email to',
};

function describeError(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'Wrong email or password.';
    case 'email_not_confirmed':
      return 'Please confirm your email first. Check your inbox, or resend the confirmation below.';
    case 'weak_password':
      return error.message || `Choose a stronger password (at least ${MIN_PASSWORD} characters).`;
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Sign in instead.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'signup_disabled':
      return 'New sign-ups are currently closed.';
    default:
      return error.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : 'Something went wrong. Please try again.';
  }
}

export function LoginForm(props: Props) {
  return props.driver === 'dev' ? <DevLoginForm next={props.next} /> : <SupabaseLoginForm {...props} />;
}

function DevLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/auth/dev-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (res.ok) {
      router.push(next);
      router.refresh();
      return;
    }
    setBusy(false);
    setMessage('Could not sign in. Check the email address.');
  }

  return (
    <form onSubmit={submit} className="stack" noValidate>
      <p className="alert warning small">Local development mode: Supabase is not connected, so any email signs in instantly and nothing is sent.</p>
      <label className="field">
        Email
        <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {message ? (
        <p className="error-text" role="alert">
          {message}
        </p>
      ) : null}
      <button className="btn primary" type="submit" disabled={busy || !email.includes('@')}>
        Sign in
      </button>
    </form>
  );
}

function SupabaseLoginForm({ supabaseUrl, supabaseAnonKey, callbackUrl, next, googleEnabled, googleStartUrl, initialMode }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const supabase = () => createBrowserClient(supabaseUrl, supabaseAnonKey);
  const returnTo = (path: string) => `${callbackUrl}?next=${encodeURIComponent(path)}`;

  function go(path: string) {
    router.push(path);
    router.refresh();
  }

  function switchView(nextView: View) {
    setView(nextView);
    setMessage('');
    setNeedsConfirm(false);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  function markSent(kind: Sent['kind']) {
    setSent({ kind, email });
    setCode('');
    setCooldown(RESEND_SECONDS);
  }

  const signIn = () =>
    run(async () => {
      const { error } = await supabase().auth.signInWithPassword({ email, password });
      if (!error) return go(next);
      setNeedsConfirm(error.code === 'email_not_confirmed');
      setMessage(describeError(error));
    });

  const signUp = () =>
    run(async () => {
      if (password.length < MIN_PASSWORD) {
        setMessage(`Use at least ${MIN_PASSWORD} characters for your password.`);
        return;
      }
      const { data, error } = await supabase().auth.signUp({ email, password, options: { emailRedirectTo: returnTo(next) } });
      if (error) return setMessage(describeError(error));
      if (data.session) return go(next);
      markSent('confirm');
    });

  const sendReset = () =>
    run(async () => {
      const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: returnTo('/auth/reset-password') });
      if (error) return setMessage(describeError(error));
      markSent('reset');
    });

  const sendCode = () =>
    run(async () => {
      const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: returnTo(next) } });
      if (error) return setMessage(describeError(error));
      markSent('code');
    });

  const resendConfirmation = () =>
    run(async () => {
      const { error } = await supabase().auth.resend({ type: 'signup', email, options: { emailRedirectTo: returnTo(next) } });
      if (error) return setMessage(describeError(error));
      setNeedsConfirm(false);
      markSent('confirm');
    });

  const google = () =>
    run(async () => {
      const { error } = await supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnTo(next) } });
      if (error) setMessage('Google sign-in is not available right now. Use email instead.');
    });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (view === 'signin') void signIn();
    else if (view === 'signup') void signUp();
    else if (view === 'forgot') void sendReset();
    else void sendCode();
  }

  if (sent) {
    const resend = sent.kind === 'confirm' ? resendConfirmation : sent.kind === 'reset' ? sendReset : sendCode;
    const otpType: EmailOtpType = sent.kind === 'reset' ? 'recovery' : 'email';
    const verify = (event: FormEvent) => {
      event.preventDefault();
      void run(async () => {
        const { error } = await supabase().auth.verifyOtp({ email: sent.email, token: code.trim(), type: otpType });
        if (!error) return go(sent.kind === 'reset' ? '/auth/reset-password' : next);
        setMessage('That code is invalid or expired. Check the latest email or send a new one.');
      });
    };
    return (
      <form onSubmit={verify} className="stack" noValidate>
        <p className="alert success" role="status">
          {SENT_COPY[sent.kind]} <strong>{sent.email}</strong>. Click the link in it, or enter the code below. It expires in one hour.
        </p>
        <label className="field">
          Code from the email
          <input
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        {message ? (
          <p className="error-text" role="alert">
            {message}
          </p>
        ) : null}
        <button className="btn primary" type="submit" disabled={busy || code.length < 6}>
          {busy ? 'Checking…' : 'Continue'}
        </button>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="link-btn" onClick={() => void resend()} disabled={busy || cooldown > 0}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setSent(null);
              setMessage('');
              switchView('signin');
            }}
          >
            Back to sign in
          </button>
        </div>
      </form>
    );
  }

  const isPasswordView = view === 'signin' || view === 'signup';
  const submitLabel = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link', code: 'Email me a code' }[view];

  return (
    <div className="stack">
      {isPasswordView ? (
        <div className="auth-tabs" role="tablist" aria-label="Sign in or create an account">
          <button type="button" role="tab" aria-selected={view === 'signin'} onClick={() => switchView('signin')}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={view === 'signup'} onClick={() => switchView('signup')}>
            Create account
          </button>
        </div>
      ) : (
        <p style={{ margin: 0 }}>
          {view === 'forgot'
            ? "Enter your account email and we'll send you a link to choose a new password."
            : "Enter your email and we'll send you a one-time sign-in code. No password needed."}
        </p>
      )}

      {isPasswordView && googleEnabled ? (
        <>
          {googleStartUrl ? (
            <a className="btn" href={googleStartUrl}>
              <GoogleMark /> Continue with Google
            </a>
          ) : (
            <button type="button" className="btn" onClick={() => void google()} disabled={busy}>
              <GoogleMark /> Continue with Google
            </button>
          )}
          <div className="auth-divider">or</div>
        </>
      ) : null}

      <form onSubmit={submit} className="stack" noValidate>
        <label className="field">
          Email
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {isPasswordView ? (
          <label className="field">
            Password
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                type={showPassword ? 'text' : 'password'}
                autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={view === 'signup' ? MIN_PASSWORD : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={view === 'signup' ? 'password-hint' : undefined}
              />
              <button type="button" className="btn sm ghost" onClick={() => setShowPassword((s) => !s)} aria-pressed={showPassword}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
        ) : null}
        {view === 'signup' ? (
          <p id="password-hint" className="small muted" style={{ margin: 0 }}>
            At least {MIN_PASSWORD} characters. New accounts get 60 free trial credits.
          </p>
        ) : null}
        {message ? (
          <p className="error-text" role="alert">
            {message}
          </p>
        ) : null}
        {needsConfirm ? (
          <button type="button" className="link-btn" onClick={() => void resendConfirmation()} disabled={busy}>
            Resend confirmation email
          </button>
        ) : null}
        <button className="btn primary" type="submit" disabled={busy || !email.includes('@') || (isPasswordView && !password)}>
          {busy ? 'Please wait…' : submitLabel}
        </button>
      </form>

      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        {view === 'signin' ? (
          <button type="button" className="link-btn" onClick={() => switchView('forgot')}>
            Forgot password?
          </button>
        ) : null}
        {isPasswordView ? (
          <button type="button" className="link-btn" onClick={() => switchView('code')}>
            Email me a sign-in code instead
          </button>
        ) : (
          <button type="button" className="link-btn" onClick={() => switchView('signin')}>
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
