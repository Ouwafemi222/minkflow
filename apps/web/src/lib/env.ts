import 'server-only';
import { z } from 'zod';

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
    if (env.AUTH_DRIVER === 'supabase' && (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) ctx.addIssue({ code: 'custom', path: ['NEXT_PUBLIC_SUPABASE_URL'], message: 'required for supabase auth' });
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

/** Parsed lazily so `next build` does not require runtime secrets. */
export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid web environment: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  cached = parsed.data;
  return cached;
}

export const isAdminEmail = (email: string | null | undefined) =>
  Boolean(email) && env().ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email!.toLowerCase());
