import { existsSync } from 'node:fs';
import { createPgDb, type Db, type DbSslMode } from '../src/client';

const ROOT_ENV = new URL('../../../.env.local', import.meta.url);

/** Loads the root `.env.local` (existing process env wins) and connects with the configured SSL mode. */
export function connectFromEnv(urlVar: string): { db: Db; url: URL } {
  if (existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV);
  const raw = process.env[urlVar] || process.env.DATABASE_URL;
  if (!raw) throw new Error(`Set ${urlVar} or DATABASE_URL (see docs/SUPABASE-SETUP.md)`);
  const url = new URL(raw);
  const ssl = (process.env.DATABASE_SSL ?? (isLocalHost(url.hostname) ? 'disable' : 'require')) as DbSslMode;
  return { db: createPgDb(raw, { max: 1, ssl, caCert: process.env.DATABASE_CA_CERT }), url };
}

export const isLocalHost = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '::1';

/** Host and user only; never prints the password. */
export const describeTarget = (url: URL) => `${decodeURIComponent(url.username)}@${url.hostname}:${url.port || 5432}${url.pathname}`;
