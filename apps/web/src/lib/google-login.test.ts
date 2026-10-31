import { describe, expect, it, vi } from 'vitest';
import { buildGoogleLoginUrl, decodeGoogleLoginCookie, encodeGoogleLoginCookie, exchangeGoogleLoginCode, safeNextPath } from './google-login';

const client = { clientId: 'cid.apps.googleusercontent.com', clientSecret: 'secret', redirectUri: 'https://minkflow.vercel.app/auth/google/callback' };

describe('google login oauth', () => {
  it('keeps the consent redirect on the public site, not supabase.co', () => {
    const url = new URL(buildGoogleLoginUrl(client, 'state-abc', 'nonce-xyz'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('redirect_uri')).toBe('https://minkflow.vercel.app/auth/google/callback');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-abc');
    expect(url.searchParams.get('nonce')).toBe('nonce-xyz');
  });

  it('round-trips the state cookie and rejects open redirects', () => {
    const raw = encodeGoogleLoginCookie('state-abc', 'nonce-xyz', '/studio/projects/1');
    expect(decodeGoogleLoginCookie(raw)).toEqual({ state: 'state-abc', nonce: 'nonce-xyz', next: '/studio/projects/1' });
    expect(safeNextPath('https://evil.example')).toBe('/studio');
    expect(safeNextPath('//evil.example')).toBe('/studio');
    expect(decodeGoogleLoginCookie('bad')).toBeNull();
  });

  it('exchanges the code for an id token', async () => {
    const fetchOk = vi.fn(async () => new Response(JSON.stringify({ id_token: 'idt', access_token: 'at' }), { status: 200 }));
    await expect(exchangeGoogleLoginCode(client, 'code', fetchOk)).resolves.toEqual({ idToken: 'idt', accessToken: 'at' });
    await expect(exchangeGoogleLoginCode(client, 'code', async () => new Response('nope', { status: 400 }))).rejects.toThrow(/HTTP 400/);
  });
});
