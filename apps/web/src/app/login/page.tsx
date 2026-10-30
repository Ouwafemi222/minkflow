import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/SiteChrome';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  if (await getSession()) redirect('/studio');
  const params = await searchParams;
  const e = env();
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/studio';
  return (
    <main id="main" className="container" style={{ maxWidth: 440, paddingTop: 64 }}>
      <Logo />
      <div className="card stack" style={{ marginTop: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Sign in or create an account</h1>
        {params.error ? <p className="alert error">That sign-in link is invalid or expired. Request a new one.</p> : null}
        <LoginForm
          driver={e.AUTH_DRIVER}
          supabaseUrl={e.NEXT_PUBLIC_SUPABASE_URL}
          supabaseAnonKey={e.NEXT_PUBLIC_SUPABASE_ANON_KEY}
          redirectTo={new URL(`/auth/callback?next=${encodeURIComponent(next)}`, e.APP_BASE_URL).toString()}
          next={next}
        />
        <p className="small muted">
          By continuing you agree to the <a href="/legal/terms">Terms</a> and <a href="/legal/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
