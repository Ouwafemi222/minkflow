'use client';

export interface ApiErrorBody {
  code: string;
  message: string;
  requestId: string;
  retryable: boolean;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

/** JSON fetch with the API error envelope; mutations get a fresh Idempotency-Key unless one is supplied. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['Idempotency-Key'] = init.idempotencyKey ?? crypto.randomUUID();
  const res = await fetch(path, { method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as { error?: ApiErrorBody } | null;
  if (!res.ok) {
    throw new ApiError(res.status, json?.error ?? { code: 'INTERNAL', message: 'Something went wrong. Please try again.', requestId: 'n/a', retryable: true });
  }
  return json as T;
}

export const errorMessage = (error: unknown) => (error instanceof ApiError ? error.body.message : 'Something went wrong. Please try again.');
