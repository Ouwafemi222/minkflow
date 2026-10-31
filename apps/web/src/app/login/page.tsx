import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/SiteChrome';
import { getSession } from '@/lib/auth';
import { authProviders } from '@/lib/auth-providers';
import { env, envIssues } from '@/lib/env';
import { publicUrl } from '@/lib/public-url';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; mode?: string }> }) {
  const issues = envIssues();
  if (issues) {
    return (
      <main id="main" className="container" style={{ maxWidth: 520, paddingTop: 64 }}>
        <Logo />
        <div className="card stack" style={{ marginTop: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>This site is not fully configured yet</h1>
          <p className="muted" style={{ margin: 0 }}>
            The login page needs the database and Supabase settings in Vercel. Missing or invalid:
          </p>
          <pre className="alert error small" style={{ whiteSpace: 'pre-wrap' }}>
            {issues}
          </pre>
          <p className="small muted" style={{ margin: 0 }}>
            Add them under Vercel → Project → Settings → Environment Variables (Production), then redeploy.
          </p>
        </div>
      </main>
    );
  }
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
          callbackUrl={publicUrl('/auth/callback', await headers(), e.APP_BASE_URL, e.ALLOWED_ORIGINS).toString()}
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
