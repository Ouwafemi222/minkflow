import { createProvidersFromEnv } from '@minkflow/ai';
import { createPgDb } from '@minkflow/db';
import { createRemotionRenderer, runJob, runJobMaintenance, runRetentionSweep, type PipelineDeps } from '@minkflow/pipeline';
import { AI_JOB_TYPES, RENDER_JOB_TYPES, subscribe, type SignalSubscriber } from '@minkflow/queue';
import { createLogger } from '@minkflow/shared';
import { createStorageFromEnv } from '@minkflow/storage';
import * as Sentry from '@sentry/node';
import { createServer } from 'node:http';
import { hostname } from 'node:os';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env';
import { claimFromDb, Lane } from './lanes';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const envFile = resolve(repoRoot, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = loadEnv();
const workerId = env.WORKER_ID ?? `${hostname()}:${process.pid}`;
const logger = createLogger({ svc: 'worker', workerId, env: env.APP_ENV }, env.LOG_LEVEL);
if (env.SENTRY_DSN) Sentry.init({ dsn: env.SENTRY_DSN, environment: env.APP_ENV, tracesSampleRate: 0 });

const db = createPgDb(env.DATABASE_URL, {
  max: env.AI_CONCURRENCY + env.RENDER_CONCURRENCY + 3,
  ssl: env.DATABASE_SSL,
  caCert: env.DATABASE_CA_CERT,
});
const { llm, tts } = createProvidersFromEnv(env);
const deps: PipelineDeps = {
  db,
  storage: createStorageFromEnv({ ...env, LOCAL_STORAGE_ROOT: resolve(repoRoot, env.LOCAL_STORAGE_ROOT), APP_BASE_URL: env.APP_BASE_URL }),
  llm,
  tts,
  renderer: createRemotionRenderer({ concurrency: env.REMOTION_CHROME_CONCURRENCY ?? null }),
  logger,
  config: {
    workerId,
    leaseSeconds: env.JOB_LEASE_SECONDS,
    platformDailyCapUsd: env.PLATFORM_DAILY_SPEND_CAP_USD,
    workspaceDailyCapUsd: env.WORKSPACE_DAILY_SPEND_CAP_USD,
    renderConcurrency: env.RENDER_CONCURRENCY,
    tempDir: env.WORKER_TEMP_DIR,
    narrationRetentionDays: 30,
    renderRetentionDays: 30,
    previewRetentionDays: 7,
  },
};

const run = async (job: Parameters<typeof runJob>[1]) => {
  try {
    return await runJob(deps, job);
  } catch (error) {
    Sentry.captureException(error, { tags: { jobId: job.id, jobType: job.type } });
    throw error;
  }
};
const claim = claimFromDb(db, workerId, env.JOB_LEASE_SECONDS);
const lanes = {
  ai: new Lane('ai', [...AI_JOB_TYPES], env.AI_CONCURRENCY, { claim, run, logger }),
  render: new Lane('render', [...RENDER_JOB_TYPES], env.RENDER_CONCURRENCY, { claim, run, logger }),
};

const timers: NodeJS.Timeout[] = [];
const subscribers: SignalSubscriber[] = [];
const pollMs = env.QUEUE_DRIVER === 'postgres' ? 1000 : 10_000;
timers.push(setInterval(() => void lanes.ai.fill(), pollMs), setInterval(() => void lanes.render.fill(), pollMs));
if (env.QUEUE_DRIVER === 'bullmq') {
  subscribers.push(
    subscribe(env.REDIS_URL!, 'ai', env.AI_CONCURRENCY, async () => lanes.ai.fill()),
    subscribe(env.REDIS_URL!, 'render', env.RENDER_CONCURRENCY, async () => lanes.render.fill()),
  );
}

const safely = (name: string, fn: () => Promise<unknown>) => () =>
  void fn().catch((error: unknown) => {
    logger.error(`${name} failed`, { error: String(error) });
    Sentry.captureException(error);
  });
timers.push(setInterval(safely('job maintenance', () => runJobMaintenance(deps)), 30_000));
if (env.RETENTION_SWEEP_ENABLED) {
  timers.push(setInterval(safely('retention sweep', () => runRetentionSweep(deps)), 60 * 60_000));
  setTimeout(safely('retention sweep', () => runRetentionSweep(deps)), 15_000).unref();
}

const startedAt = Date.now();
const health = createServer(async (req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({ ok: true, workerId, driver: env.QUEUE_DRIVER, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), active: { ai: lanes.ai.activeCount, render: lanes.render.activeCount } }),
    );
    return;
  }
  if (req.url === '/readyz') {
    try {
      await db.query('select 1');
      res.writeHead(200).end('ready');
    } catch {
      res.writeHead(503).end('database unavailable');
    }
    return;
  }
  res.writeHead(404).end();
});
health.listen(env.WORKER_PORT, () => logger.info('worker started', { port: env.WORKER_PORT, driver: env.QUEUE_DRIVER, ai: env.AI_PROVIDER_MODE, storage: env.STORAGE_DRIVER }));

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutting down', { signal });
  timers.forEach(clearInterval);
  await Promise.all(subscribers.map((s) => s.close()));
  const [aiDone, renderDone] = await Promise.all([lanes.ai.drain(25_000), lanes.render.drain(25_000)]);
  if (!aiDone || !renderDone) logger.warn('exiting with jobs still running; their leases will expire and they will be retried');
  health.close();
  await db.close();
  await Sentry.flush(2000);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
