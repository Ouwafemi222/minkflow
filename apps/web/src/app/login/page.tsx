import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/SiteChrome';
import { getSession } from '@/lib/auth';
import { authProviders } from '@/lib/auth-providers';
import { env } from '@/lib/env';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; mode?: string }> }) {
  if (await getSession()) redirect('/studio');
  const params = await searchParams;
  const e = env();
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/studio';
  const providers = await authProviders();
  return (
    <main id="main" className="container" style={{ maxWidth: 440, paddingTop: 64 }}>
      <Logo />
      <div className="card stack" style={{ marginTop: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>{params.mode === 'signup' ? 'Create your account' : 'Welcome to Minkflow'}</h1>
        {params.error ? <p className="alert error">That sign-in didn&apos;t complete. The link may have expired or already been used. Please try again.</p> : null}
        <LoginForm
          driver={e.AUTH_DRIVER}
          supabaseUrl={e.NEXT_PUBLIC_SUPABASE_URL}
          supabaseAnonKey={e.NEXT_PUBLIC_SUPABASE_ANON_KEY}
          callbackUrl={new URL('/auth/callback', e.APP_BASE_URL).toString()}
          next={next}
          googleEnabled={providers.google}
          initialMode={params.mode === 'signup' ? 'signup' : 'signin'}
        />
        <p className="small muted" style={{ margin: 0 }}>
          By continuing you agree to the <a href="/legal/terms">Terms</a> and <a href="/legal/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
