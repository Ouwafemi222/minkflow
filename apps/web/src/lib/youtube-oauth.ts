import { z } from 'zod';

/** Google OAuth + YouTube Data API v3 calls used to connect a channel (ADR-020; endpoint shapes are V-24). */
export const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'] as const;

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true';

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

type Fetch = typeof fetch;

const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().optional(),
  scope: z.string().default(''),
});

const ChannelsResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        snippet: z.object({
          title: z.string().min(1).max(200),
          thumbnails: z.record(z.string(), z.object({ url: z.url() })).optional(),
        }),
      }),
    )
    .default([]),
});

export interface Channel {
  id: string;
  title: string;
  thumbnailUrl: string | null;
}

export function buildAuthorizeUrl(client: OAuthClient, state: string): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString();
  return url.toString();
}

export async function exchangeCode(client: OAuthClient, code: string, fetchImpl: Fetch = fetch): Promise<{ accessToken: string; refreshToken: string; scopes: string[] }> {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: client.clientId, client_secret: client.clientSecret, redirect_uri: client.redirectUri, grant_type: 'authorization_code' }),
  });
  if (!res.ok) throw new Error(`token exchange failed: HTTP ${res.status}`);
  const body = TokenResponse.parse(await res.json());
  if (!body.refresh_token) throw new Error('token exchange returned no refresh token');
  return { accessToken: body.access_token, refreshToken: body.refresh_token, scopes: body.scope.split(' ').filter(Boolean) };
}

/** The signed-in Google account's own channel, or null if the account has no YouTube channel. */
export async function fetchMyChannel(accessToken: string, fetchImpl: Fetch = fetch): Promise<Channel | null> {
  const res = await fetchImpl(CHANNELS_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`channel lookup failed: HTTP ${res.status}`);
  const item = ChannelsResponse.parse(await res.json()).items[0];
  if (!item) return null;
  const thumbs = item.snippet.thumbnails ?? {};
  return { id: item.id, title: item.snippet.title, thumbnailUrl: (thumbs.medium ?? thumbs.default ?? Object.values(thumbs)[0])?.url ?? null };
}

/** Best effort: Google returns 400 for already-revoked tokens, which is fine. */
export async function revokeToken(token: string, fetchImpl: Fetch = fetch): Promise<boolean> {
  const res = await fetchImpl(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  });
  return res.ok;
}
