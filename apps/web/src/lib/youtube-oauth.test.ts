import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizeUrl, exchangeCode, fetchMyChannel, revokeToken } from './youtube-oauth';

const client = { clientId: 'cid.apps.googleusercontent.com', clientSecret: 'secret', redirectUri: 'http://localhost:3000/api/youtube/callback' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('youtube oauth', () => {
  it('asks for offline, read-only access bound to the state value', () => {
    const url = new URL(buildAuthorizeUrl(client, 'state-123'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: client.clientId,
      redirect_uri: client.redirectUri,
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state: 'state-123',
    });
  });

  it('exchanges the code and requires a refresh token', async () => {
    const fetchOk = vi.fn(async () => json({ access_token: 'at', refresh_token: 'rt', expires_in: 3599, scope: 'https://www.googleapis.com/auth/youtube.readonly' }));
    await expect(exchangeCode(client, 'code', fetchOk)).resolves.toEqual({ accessToken: 'at', refreshToken: 'rt', scopes: ['https://www.googleapis.com/auth/youtube.readonly'] });
    const body = (fetchOk.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_secret')).toBe('secret');
    await expect(exchangeCode(client, 'code', async () => json({ access_token: 'at' }))).rejects.toThrow(/no refresh token/);
    await expect(exchangeCode(client, 'code', async () => json({ error: 'invalid_grant' }, 400))).rejects.toThrow(/HTTP 400/);
  });

  it('reads the channel, prefers the medium thumbnail, and handles accounts without a channel', async () => {
    const withChannel = async () =>
      json({ items: [{ id: 'UCabc', snippet: { title: 'My Channel', thumbnails: { default: { url: 'https://yt3.example/d.jpg' }, medium: { url: 'https://yt3.example/m.jpg' } } } }] });
    await expect(fetchMyChannel('at', withChannel)).resolves.toEqual({ id: 'UCabc', title: 'My Channel', thumbnailUrl: 'https://yt3.example/m.jpg' });
    await expect(fetchMyChannel('at', async () => json({ items: [] }))).resolves.toBeNull();
    await expect(fetchMyChannel('at', async () => json({}))).resolves.toBeNull();
  });

  it('reports revocation results without throwing', async () => {
    await expect(revokeToken('rt', async () => new Response('', { status: 200 }))).resolves.toBe(true);
    await expect(revokeToken('rt', async () => new Response('', { status: 400 }))).resolves.toBe(false);
  });
});
