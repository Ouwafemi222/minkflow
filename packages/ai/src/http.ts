import { AppError, withRetry } from '@minkflow/shared';

export interface HttpOptions {
  timeoutMs: number;
  maxAttempts?: number;
}

/** POST JSON with timeout, bounded retries on 429/5xx/network, and provider error mapping. */
export async function postJson<T>(url: string, headers: Record<string, string>, body: unknown, options: HttpOptions): Promise<{ data: T; requestId: string | null }> {
  return withRetry(
    async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch {
        throw new AppError('PROVIDER_UNAVAILABLE', 'Provider request failed or timed out');
      } finally {
        clearTimeout(timer);
      }
      const requestId = response.headers.get('x-request-id') ?? response.headers.get('request-id');
      if (response.status === 429) throw new AppError('PROVIDER_RATE_LIMITED');
      if (response.status >= 500) throw new AppError('PROVIDER_UNAVAILABLE', `Provider returned ${response.status}`);
      if (!response.ok) {
        const text = (await response.text()).slice(0, 300);
        throw new AppError('PROVIDER_UNAVAILABLE', `Provider rejected request (${response.status})`, { status: response.status, body: text });
      }
      return { data: (await response.json()) as T, requestId };
    },
    {
      maxAttempts: options.maxAttempts ?? 3,
      baseMs: 800,
      maxMs: 8000,
      shouldRetry: (e) => e instanceof AppError && (e.code === 'PROVIDER_RATE_LIMITED' || (e.code === 'PROVIDER_UNAVAILABLE' && !(e.details as { status?: number } | undefined)?.status)),
    },
  );
}
