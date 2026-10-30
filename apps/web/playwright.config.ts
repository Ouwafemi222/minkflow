import { defineConfig, devices } from '@playwright/test';

/**
 * Browser e2e + screenshot tests against an isolated local stack: in-memory PGlite, worker with mock AI/TTS and
 * local storage, and a production build of the web app. Values below are throwaway test settings, not secrets.
 *   pnpm --filter @minkflow/web test:e2e            (first run: pnpm --filter @minkflow/web exec playwright install chromium)
 */
const WEB_PORT = 3100;
const DB_PORT = 54339;
const WORKER_PORT = 8091;
const BASE_URL = `http://localhost:${WEB_PORT}`;

const stackEnv: Record<string, string> = {
  APP_ENV: 'local',
  APP_BASE_URL: BASE_URL,
  ALLOWED_ORIGINS: BASE_URL,
  ADMIN_EMAILS: 'admin@e2e.test',
  AUTH_DRIVER: 'dev',
  DEV_AUTH_SECRET: 'e2e-only-dev-auth-secret-0123456789',
  DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`,
  DATABASE_SSL: 'disable',
  GOOGLE_OAUTH_CLIENT_ID: '',
  GOOGLE_OAUTH_CLIENT_SECRET: '',
  QUEUE_DRIVER: 'postgres',
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_ROOT: '.data/e2e-storage',
  LOCAL_STORAGE_SECRET: 'e2e-only-storage-secret-0123456789',
  AI_PROVIDER_MODE: 'mock',
  PAYMENTS_ENABLED: 'false',
  WORKER_PORT: String(WORKER_PORT),
  RETENTION_SWEEP_ENABLED: 'false',
  LOG_LEVEL: 'warn',
};

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.ts$/,
  timeout: 120_000,
  expect: { timeout: 30_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}',
  use: { ...devices['Desktop Chrome'], baseURL: BASE_URL, trace: 'retain-on-failure', viewport: { width: 1440, height: 900 } },
  webServer: [
    {
      command: 'pnpm --filter @minkflow/db db:local',
      port: DB_PORT,
      env: { ...stackEnv, LOCAL_DB_DIR: 'memory', LOCAL_DB_PORT: String(DB_PORT) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @minkflow/worker start',
      url: `http://127.0.0.1:${WORKER_PORT}/healthz`,
      env: stackEnv,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm exec next build && pnpm exec next start --port ${WEB_PORT}`,
      url: `${BASE_URL}/api/health`,
      env: stackEnv,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
