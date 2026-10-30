import type { Instrumentation } from 'next';

/** Server-side error monitoring. A no-op unless SENTRY_DSN is set. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.APP_ENV ?? 'local', tracesSampleRate: 0 });
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
};
