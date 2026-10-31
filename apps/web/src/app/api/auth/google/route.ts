import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { buildGoogleLoginUrl, encodeGoogleLoginCookie, GOOGLE_LOGIN_COOKIE, googleLoginRedirectUri, safeNextPath } from '@/lib/google-login';
import { publicOrigin } from '@/lib/public-url';

/** Starts Google sign-in on this site's host so the consent screen says minkflow.vercel.app, not supabase.co. */
export async function GET(req: NextRequest) {
  const e = env();
  const base = publicOrigin(req.headers, e.APP_BASE_URL, e.ALLOWED_ORIGINS);
  if (!e.GOOGLE_OAUTH_CLIENT_ID || !e.GOOGLE_OAUTH_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/login?error=google', base));
  }
  const state = randomBytes(24).toString('base64url');
  const nonce = randomBytes(24).toString('base64url');
  const next = safeNextPath(req.nextUrl.searchParams.get('next'));
  const res = NextResponse.redirect(
    buildGoogleLoginUrl({ clientId: e.GOOGLE_OAUTH_CLIENT_ID, redirectUri: googleLoginRedirectUri(base) }, state, nonce),
  );
  res.cookies.set(GOOGLE_LOGIN_COOKIE, encodeGoogleLoginCookie(state, nonce, next), {
    httpOnly: true,
    sameSite: 'lax',
    secure: base.startsWith('https://'),
    path: '/',
    maxAge: 600,
  });
  return res;
}
