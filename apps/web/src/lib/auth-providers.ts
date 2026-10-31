import 'server-only';
import { env } from './env';

export interface AuthProviders {
  google: boolean;
}

/**
 * Reads which sign-in providers are switched on in the Supabase dashboard (public `/auth/v1/settings`),
 * so the Google button only appears once Google is configured. Cached for five minutes.
 */
export async function authProviders(): Promise<AuthProviders> {
  const e = env();
  if (e.AUTH_DRIVER !== 'supabase') return { google: false };
  if (e.GOOGLE_OAUTH_CLIENT_ID && e.GOOGLE_OAUTH_CLIENT_SECRET) return { google: true };
  try {
    const res = await fetch(`${e.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      next: { revalidate: 300 },
    });
    if (!res.ok) return { google: false };
    const body = (await res.json()) as { external?: { google?: boolean } };
    return { google: body.external?.google === true };
  } catch {
    return { google: false };
  }
}
