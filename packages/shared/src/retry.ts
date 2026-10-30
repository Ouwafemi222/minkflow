export interface BackoffOptions {
  baseMs: number;
  maxMs: number;
  /** 0..1 deterministic jitter source, injectable for tests. */
  jitter?: () => number;
}

export function backoffDelay(attempt: number, { baseMs, maxMs, jitter = Math.random }: BackoffOptions): number {
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(exponential / 2 + (exponential / 2) * jitter());
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: BackoffOptions & {
    maxAttempts: number;
    shouldRetry: (error: unknown) => boolean;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<T> {
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === options.maxAttempts || !options.shouldRetry(error)) throw error;
      await sleep(backoffDelay(attempt, options));
    }
  }
  throw lastError;
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
