import 'server-only';
import { z } from 'zod';

const emptyToUndef = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * Next.js / Vercel only copies env vars that appear as `process.env.NAME` in the server bundle.
 * Parsing `process.env` as a whole object drops DATABASE_URL and the rest at runtime.
 */
function readEnv() {
  return {
    APP_ENV: emptyToUndef(process.env.APP_ENV),
    APP_BASE_URL: emptyToUndef(process.env.APP_BASE_URL),
    ALLOWED_ORIGINS: emptyToUndef(process.env.ALLOWED_ORIGINS),
    ADMIN_EMAILS: emptyToUndef(process.env.ADMIN_EMAILS),
    AUTH_DRIVER: emptyToUndef(process.env.AUTH_DRIVER),
    DEV_AUTH_SECRET: emptyToUndef(process.env.DEV_AUTH_SECRET),
    NEXT_PUBLIC_SUPABASE_URL: emptyToUndef(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? emptyToUndef(process.env.SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: emptyToUndef(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? emptyToUndef(process.env.SUPABASE_ANON_KEY),
    DATABASE_URL: emptyToUndef(process.env.DATABASE_URL) ?? emptyToUndef(process.env.POSTGRES_URL),
    DATABASE_SSL: emptyToUndef(process.env.DATABASE_SSL),
    DATABASE_CA_CERT: emptyToUndef(process.env.DATABASE_CA_CERT),
    QUEUE_DRIVER: emptyToUndef(process.env.QUEUE_DRIVER),
    REDIS_URL: emptyToUndef(process.env.REDIS_URL),
    STORAGE_DRIVER: emptyToUndef(process.env.STORAGE_DRIVER),
    LOCAL_STORAGE_ROOT: emptyToUndef(process.env.LOCAL_STORAGE_ROOT),
    LOCAL_STORAGE_SECRET: emptyToUndef(process.env.LOCAL_STORAGE_SECRET),
    S3_ENDPOINT: emptyToUndef(process.env.S3_ENDPOINT),
    S3_REGION: emptyToUndef(process.env.S3_REGION),
    S3_BUCKET: emptyToUndef(process.env.S3_BUCKET),
    S3_ACCESS_KEY_ID: emptyToUndef(process.env.S3_ACCESS_KEY_ID),
    S3_SECRET_ACCESS_KEY: emptyToUndef(process.env.S3_SECRET_ACCESS_KEY),
    SIGNED_URL_TTL_SECONDS: emptyToUndef(process.env.SIGNED_URL_TTL_SECONDS),
    AI_PROVIDER_MODE: emptyToUndef(process.env.AI_PROVIDER_MODE),
    ELEVENLABS_VOICE_IDS: emptyToUndef(process.env.ELEVENLABS_VOICE_IDS),
    MAX_ACTIVE_JOBS_PER_WORKSPACE: emptyToUndef(process.env.MAX_ACTIVE_JOBS_PER_WORKSPACE),
    GOOGLE_OAUTH_CLIENT_ID: emptyToUndef(process.env.GOOGLE_OAUTH_CLIENT_ID),
    GOOGLE_OAUTH_CLIENT_SECRET: emptyToUndef(process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    TOKEN_ENCRYPTION_KEY: emptyToUndef(process.env.TOKEN_ENCRYPTION_KEY),
    PAYMENTS_ENABLED: emptyToUndef(process.env.PAYMENTS_ENABLED),
    PAYSTACK_SECRET_KEY: emptyToUndef(process.env.PAYSTACK_SECRET_KEY),
    PAYSTACK_CURRENCY: emptyToUndef(process.env.PAYSTACK_CURRENCY),
  };
}

const ServerEnvSchema = z
  .object({
    APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
    APP_BASE_URL: z.url().default('http://localhost:3000'),
    ALLOWED_ORIGINS: z.string().default(''),
    ADMIN_EMAILS: z.string().default(''),
    AUTH_DRIVER: z.enum(['dev', 'supabase']).default('supabase'),
    DEV_AUTH_SECRET: z.string().default(''),
    NEXT_PUBLIC_SUPABASE_URL: z.string().default(''),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(''),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_SSL: z.enum(['disable', 'require', 'verify']).default('disable'),
    DATABASE_CA_CERT: z.string().optional(),
    QUEUE_DRIVER: z.enum(['postgres', 'bullmq']).default('postgres'),
    REDIS_URL: z.string().optional(),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    LOCAL_STORAGE_ROOT: z.string().default('.data/storage'),
    LOCAL_STORAGE_SECRET: z.string().default(''),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().default('minkflow-dev'),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    AI_PROVIDER_MODE: z.enum(['mock', 'voice', 'live']).default('mock'),
    ELEVENLABS_VOICE_IDS: z.string().optional(),
    MAX_ACTIVE_JOBS_PER_WORKSPACE: z.coerce.number().int().min(1).max(20).default(3),
    GOOGLE_OAUTH_CLIENT_ID: z.string().default(''),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(''),
    TOKEN_ENCRYPTION_KEY: z.string().default(''),
    PAYMENTS_ENABLED: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    PAYSTACK_SECRET_KEY: z.string().optional(),
    PAYSTACK_CURRENCY: z.literal('USD').default('USD'),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_DRIVER === 'dev' && env.APP_ENV !== 'local') ctx.addIssue({ code: 'custom', path: ['AUTH_DRIVER'], message: 'dev auth is only allowed when APP_ENV=local' });
    if (env.AUTH_DRIVER === 'dev' && env.DEV_AUTH_SECRET.length < 16) ctx.addIssue({ code: 'custom', path: ['DEV_AUTH_SECRET'], message: 'set a random 16+ char secret' });
    if (env.AUTH_DRIVER === 'supabase' && !env.NEXT_PUBLIC_SUPABASE_URL) ctx.addIssue({ code: 'custom', path: ['NEXT_PUBLIC_SUPABASE_URL'], message: 'missing or empty — copy the value from .env.local, then Redeploy' });
    if (env.AUTH_DRIVER === 'supabase' && !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ctx.addIssue({ code: 'custom', path: ['NEXT_PUBLIC_SUPABASE_ANON_KEY'], message: 'missing or empty — copy the anon key from .env.local (starts with eyJ), then Redeploy' });
    if (env.APP_ENV !== 'local' && env.DATABASE_SSL === 'disable') ctx.addIssue({ code: 'custom', path: ['DATABASE_SSL'], message: 'use require or verify outside local' });
    if (env.DATABASE_SSL === 'verify' && !env.DATABASE_CA_CERT) ctx.addIssue({ code: 'custom', path: ['DATABASE_CA_CERT'], message: 'required when DATABASE_SSL=verify' });
    if (env.STORAGE_DRIVER === 'local' && env.APP_ENV !== 'local') ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'local storage is for local development only' });
    if (env.STORAGE_DRIVER === 'local' && env.LOCAL_STORAGE_SECRET.length < 16) ctx.addIssue({ code: 'custom', path: ['LOCAL_STORAGE_SECRET'], message: 'set a random 16+ char secret' });
    if (Boolean(env.GOOGLE_OAUTH_CLIENT_ID) !== Boolean(env.GOOGLE_OAUTH_CLIENT_SECRET)) ctx.addIssue({ code: 'custom', path: ['GOOGLE_OAUTH_CLIENT_SECRET'], message: 'set both GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET, or neither' });
    if (env.GOOGLE_OAUTH_CLIENT_ID && Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64').length !== 32) ctx.addIssue({ code: 'custom', path: ['TOKEN_ENCRYPTION_KEY'], message: 'required for YouTube: 32 random bytes, base64 (pnpm gen:secret)' });
    if (env.PAYMENTS_ENABLED && !env.PAYSTACK_SECRET_KEY) ctx.addIssue({ code: 'custom', path: ['PAYSTACK_SECRET_KEY'], message: 'required when PAYMENTS_ENABLED=true' });
  });
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | null = null;

/** Names only; true means the value is non-empty. Never includes secrets. */
export function envFlags() {
  const e = readEnv();
  return {
    DATABASE_URL: Boolean(e.DATABASE_URL),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(e.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(e.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    AUTH_DRIVER: e.AUTH_DRIVER ?? 'default',
    APP_ENV: e.APP_ENV ?? 'default',
    STORAGE_DRIVER: e.STORAGE_DRIVER ?? 'default',
  };
}

export function envIssues(): string | null {
  const parsed = ServerEnvSchema.safeParse(readEnv());
  if (parsed.success) return null;
  return parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

/** Parsed lazily so `next build` does not require runtime secrets. */
export function env(): ServerEnv {
  if (cached) return cached;
  const issues = envIssues();
  if (issues) throw new Error(`Invalid web environment: ${issues}`);
  cached = ServerEnvSchema.parse(readEnv());
  return cached;
}

export const isAdminEmail = (email: string | null | undefined) =>
  Boolean(email) && env().ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email!.toLowerCase());
