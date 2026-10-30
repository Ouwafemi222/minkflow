import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from './env';

export interface Session {
  userId: string;
  email: string;
}

export const DEV_COOKIE = 'mf_dev_session';
const DEV_TTL_SECONDS = 7 * 24 * 3600;

function sign(payload: string): string {
  return createHmac('sha256', env().DEV_AUTH_SECRET).update(payload).digest('base64url');
}

/** LOCAL ONLY (AUTH_DRIVER=dev): an HMAC-signed cookie stands in for Supabase Auth. */
export function createDevSessionValue(userId: string, email: string): string {
  const payload = `${userId}|${Buffer.from(email).toString('base64url')}|${Math.floor(Date.now() / 1000) + DEV_TTL_SECONDS}`;
  return `${payload}|${sign(payload)}`;
}

export function readDevSessionValue(value: string | undefined): Session | null {
  if (!value) return null;
  const parts = value.split('|');
  if (parts.length !== 4) return null;
  const [userId, emailB64, exp, sig] = parts as [string, string, string, string];
  const expected = Buffer.from(sign(`${userId}|${emailB64}|${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  return { userId, email: Buffer.from(emailB64, 'base64url').toString() };
}

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env().NEXT_PUBLIC_SUPABASE_URL, env().NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component; the proxy refreshes the session cookies instead.
        }
      },
    },
  });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  if (env().AUTH_DRIVER === 'dev') return readDevSessionValue(store.get(DEV_COOKIE)?.value);
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? '' };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}
