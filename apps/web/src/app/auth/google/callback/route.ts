import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/auth';
import { env } from '@/lib/env';
import { decodeGoogleLoginCookie, exchangeGoogleLoginCode, GOOGLE_LOGIN_COOKIE, googleLoginRedirectUri } from '@/lib/google-login';
import { publicOrigin } from '@/lib/public-url';

/** Finishes Google sign-in and creates the Supabase session from the ID token. */
export async function GET(req: NextRequest) {
  const e = env();
  const base = publicOrigin(req.headers, e.APP_BASE_URL, e.ALLOWED_ORIGINS);
  const fail = () => {
    const res = NextResponse.redirect(new URL('/login?error=google', base));
    res.cookies.delete(GOOGLE_LOGIN_COOKIE);
    return res;
  };

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const parsed = decodeGoogleLoginCookie(req.cookies.get(GOOGLE_LOGIN_COOKIE)?.value);
  if (!code || !state || !parsed || parsed.state !== state || !e.GOOGLE_OAUTH_CLIENT_ID || !e.GOOGLE_OAUTH_CLIENT_SECRET) {
    return fail();
  }

  try {
    const tokens = await exchangeGoogleLoginCode(
      { clientId: e.GOOGLE_OAUTH_CLIENT_ID, clientSecret: e.GOOGLE_OAUTH_CLIENT_SECRET, redirectUri: googleLoginRedirectUri(base) },
      code,
    );
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: tokens.idToken, nonce: parsed.nonce });
    if (error) return fail();
    const res = NextResponse.redirect(new URL(parsed.next, base));
    res.cookies.delete(GOOGLE_LOGIN_COOKIE);
    return res;
  } catch {
    return fail();
  }
}
