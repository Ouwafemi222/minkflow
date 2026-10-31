import { describe, expect, it } from 'vitest';
import { isTrustedOrigin, originFromHeaders, publicOrigin, publicUrl } from './public-url';

const headers = (init: Record<string, string>) => ({ get: (name: string) => init[name] ?? null });

describe('public origin', () => {
  it('prefers the live Vercel host over a leftover localhost APP_BASE_URL', () => {
    const req = headers({ host: 'minkflow.vercel.app', 'x-forwarded-proto': 'https' });
    expect(publicOrigin(req, 'http://localhost:3000')).toBe('https://minkflow.vercel.app');
    expect(publicUrl('/auth/callback?next=%2Fstudio', req, 'http://localhost:3000').toString()).toBe('https://minkflow.vercel.app/auth/callback?next=%2Fstudio');
  });

  it('keeps preview deployments on their own host', () => {
    const req = headers({ 'x-forwarded-host': 'minkflow-abc-oluwafemis-projects.vercel.app', 'x-forwarded-proto': 'https' });
    expect(publicOrigin(req, 'http://localhost:3000')).toBe('https://minkflow-abc-oluwafemis-projects.vercel.app');
  });

  it('falls back to APP_BASE_URL when the Host header is missing or untrusted', () => {
    expect(publicOrigin(headers({}), 'https://minkflow.vercel.app')).toBe('https://minkflow.vercel.app');
    expect(publicOrigin(headers({ host: 'evil.example' }), 'https://minkflow.vercel.app')).toBe('https://minkflow.vercel.app');
  });

  it('allows an extra origin from ALLOWED_ORIGINS', () => {
    expect(isTrustedOrigin('https://app.example.com', 'http://localhost:3000', 'https://app.example.com')).toBe(true);
    expect(originFromHeaders(headers({ host: 'localhost:3000' }))?.origin).toBe('http://localhost:3000');
  });
});
