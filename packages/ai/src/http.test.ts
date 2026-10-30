import { AppError } from '@minkflow/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { postJson } from './http';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: string) {
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('postJson', () => {
  it('does not retry when the provider account is out of credit', async () => {
    const fetchMock = stubFetch(429, JSON.stringify({ error: { code: 'credit_balance_exhausted', type: 'insufficient_quota' } }));
    const error = await postJson('https://example.test', {}, {}, { timeoutMs: 1000 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('PROVIDER_UNAVAILABLE');
    expect((error as AppError).details).toMatchObject({ status: 429, reason: 'provider_quota_exhausted' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a plain rate limit', async () => {
    const fetchMock = stubFetch(429, JSON.stringify({ error: { code: 'rate_limit_exceeded' } }));
    const error = await postJson('https://example.test', {}, {}, { timeoutMs: 1000, maxAttempts: 2 }).catch((e: unknown) => e);
    expect((error as AppError).code).toBe('PROVIDER_RATE_LIMITED');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
