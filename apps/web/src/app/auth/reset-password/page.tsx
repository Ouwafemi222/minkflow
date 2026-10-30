import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Logo } from '@/components/SiteChrome';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = { title: 'Choose a new password' };

/** Reached from the password-reset email via /auth/callback, which signs the user in first. */
export default async function ResetPasswordPage() {
  await connection();
  const e = env();
  if (e.AUTH_DRIVER !== 'supabase') redirect('/studio');
  const session = await getSession();
  if (!session) redirect('/login?error=link');
  return (
    <main id="main" className="container" style={{ maxWidth: 440, paddingTop: 64 }}>
      <Logo />
      <div className="card stack" style={{ marginTop: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Choose a new password</h1>
        <p className="muted" style={{ margin: 0 }}>
          For {session.email}
        </p>
        <ResetPasswordForm supabaseUrl={e.NEXT_PUBLIC_SUPABASE_URL} supabaseAnonKey={e.NEXT_PUBLIC_SUPABASE_ANON_KEY} />
      </div>
    </main>
  );
}
