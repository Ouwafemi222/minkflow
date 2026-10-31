import { tmpdir } from 'node:os';
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const WorkerEnvSchema = z
  .object({
    APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
    APP_BASE_URL: z.url(),
    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: z.enum(['disable', 'require', 'verify']).default('disable'),
    DATABASE_CA_CERT: z.string().optional(),
    QUEUE_DRIVER: z.enum(['postgres', 'bullmq']).default('postgres'),
    REDIS_URL: z.string().optional(),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    LOCAL_STORAGE_ROOT: z.string().default('.data/storage'),
    LOCAL_STORAGE_SECRET: z.string().default(''),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().default('minkflow-private'),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    AI_PROVIDER_MODE: z.enum(['mock', 'voice', 'live']).default('mock'),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL_SCRIPT: z.string().optional(),
    OPENAI_MODEL_STORYBOARD: z.string().optional(),
    OPENAI_MODEL_MODERATION: z.string().optional(),
    OPENAI_INPUT_USD_PER_1M: z.string().optional(),
    OPENAI_OUTPUT_USD_PER_1M: z.string().optional(),
    ELEVENLABS_API_KEY: z.string().optional(),
    ELEVENLABS_MODEL_ID: z.string().optional(),
    ELEVENLABS_VOICE_IDS: z.string().optional(),
    ELEVENLABS_USD_PER_1K_CHARS: z.string().optional(),
    RENDER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
    AI_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
    REMOTION_CHROME_CONCURRENCY: z.coerce.number().int().min(1).max(16).optional(),
    PLATFORM_DAILY_SPEND_CAP_USD: z.coerce.number().positive().default(25),
    WORKSPACE_DAILY_SPEND_CAP_USD: z.coerce.number().positive().default(3),
    JOB_LEASE_SECONDS: z.coerce.number().int().min(15).max(600).default(60),
    WORKER_TEMP_DIR: z.string().default(tmpdir()),
    WORKER_PORT: z.coerce.number().int().default(8081),
    WORKER_ID: z.string().optional(),
    RETENTION_SWEEP_ENABLED: bool.default(true),
    SENTRY_DSN: z.string().optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.QUEUE_DRIVER === 'bullmq' && !env.REDIS_URL) ctx.addIssue({ code: 'custom', path: ['REDIS_URL'], message: 'required when QUEUE_DRIVER=bullmq' });
    if (env.STORAGE_DRIVER === 'local' && env.LOCAL_STORAGE_SECRET.length < 16) ctx.addIssue({ code: 'custom', path: ['LOCAL_STORAGE_SECRET'], message: 'set a random secret (16+ chars) for local storage' });
    if (env.APP_ENV !== 'local' && env.STORAGE_DRIVER === 'local') ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'local storage is for local development only' });
    if (env.STORAGE_DRIVER === 's3' && (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) {
      ctx.addIssue({ code: 'custom', path: ['S3_ENDPOINT'], message: 'S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when STORAGE_DRIVER=s3' });
    }
    if (env.APP_ENV !== 'local' && env.DATABASE_SSL === 'disable') ctx.addIssue({ code: 'custom', path: ['DATABASE_SSL'], message: 'use require or verify outside local' });
    if (env.DATABASE_SSL === 'verify' && !env.DATABASE_CA_CERT) ctx.addIssue({ code: 'custom', path: ['DATABASE_CA_CERT'], message: 'required when DATABASE_SSL=verify' });
    if (env.APP_ENV !== 'local' && env.AI_PROVIDER_MODE !== 'live') ctx.addIssue({ code: 'custom', path: ['AI_PROVIDER_MODE'], message: 'mock providers are not allowed outside local' });
  });
export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = WorkerEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid worker environment:\n${issues}`);
  }
  return parsed.data;
}
