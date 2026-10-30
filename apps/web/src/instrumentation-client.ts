import * as Sentry from '@sentry/nextjs';

/** Browser error monitoring. A no-op unless NEXT_PUBLIC_SENTRY_DSN is set. */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) Sentry.init({ dsn, tracesSampleRate: 0 });
