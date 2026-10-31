import { z } from 'zod';

/** OpenID scopes only — this is sign-in, not YouTube. */
export const GOOGLE_LOGIN_SCOPES = ['openid', 'email', 'profile'] as const;
export const GOOGLE_LOGIN_COOKIE = 'mf_google_login';
export const googleLoginRedirectUri = (base: string) => new URL('/auth/google/callback', base).toString();

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GoogleLoginClient {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const TokenResponse = z.object({
  id_token: z.string().min(1),
  access_token: z.string().min(1),
});

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/studio';
  return value;
}

export function encodeGoogleLoginCookie(state: string, nonce: string, next: string): string {
  return `${state}.${nonce}.${Buffer.from(safeNextPath(next)).toString('base64url')}`;
}

export function decodeGoogleLoginCookie(value: string | undefined): { state: string; nonce: string; next: string } | null {
  if (!value) return null;
  const dot1 = value.indexOf('.');
  const dot2 = value.indexOf('.', dot1 + 1);
  if (dot1 < 8 || dot2 < 0) return null;
  const state = value.slice(0, dot1);
  const nonce = value.slice(dot1 + 1, dot2);
  if (!state || !nonce) return null;
  try {
    return { state, nonce, next: safeNextPath(Buffer.from(value.slice(dot2 + 1), 'base64url').toString()) };
  } catch {
    return null;
  }
}

/** Google consent is bound to this redirect host (minkflow.vercel.app), not the Supabase project URL. */
export function buildGoogleLoginUrl(client: Pick<GoogleLoginClient, 'clientId' | 'redirectUri'>, state: string, nonce: string): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: 'code',
    scope: GOOGLE_LOGIN_SCOPES.join(' '),
    state,
    nonce,
    prompt: 'select_account',
    access_type: 'online',
  }).toString();
  return url.toString();
}

export async function exchangeGoogleLoginCode(
  client: GoogleLoginClient,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ idToken: string; accessToken: string }> {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: client.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: HTTP ${res.status}`);
  const body = TokenResponse.parse(await res.json());
  return { idToken: body.id_token, accessToken: body.access_token };
}
