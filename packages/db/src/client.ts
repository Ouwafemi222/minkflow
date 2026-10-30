import { AppError, type ErrorCode, ERROR_CODES } from '@minkflow/shared';
import pg from 'pg';

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface Db extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** int8/numeric come back as strings from node-postgres; keep JSON as JSON. */
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

export type DbSslMode = 'disable' | 'require' | 'verify';

export interface PgDbOptions {
  max?: number;
  /** `require` encrypts without certificate checks; `verify` checks against `caCert` (Supabase root CA PEM). */
  ssl?: DbSslMode;
  caCert?: string;
}

const SSL_URL_PARAMS = ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat'];

/**
 * node-postgres treats `sslmode=require` in a URL as full verification, which fails against Supabase's own CA,
 * so SSL is configured explicitly and any URL ssl params are dropped.
 */
export function pgConnectionConfig(connectionString: string, options: PgDbOptions = {}): pg.PoolConfig {
  const mode = options.ssl ?? 'disable';
  const url = new URL(connectionString);
  for (const param of SSL_URL_PARAMS) url.searchParams.delete(param);
  if (mode === 'verify' && !options.caCert) throw new Error('DATABASE_SSL=verify needs DATABASE_CA_CERT');
  const ssl = mode === 'disable' ? false : mode === 'require' ? { rejectUnauthorized: false } : { rejectUnauthorized: true, ca: options.caCert };
  return { connectionString: url.toString(), ssl };
}

export function createPgDb(connectionString: string, options: PgDbOptions = {}): Db {
  const pool = new pg.Pool({ ...pgConnectionConfig(connectionString, options), max: options.max ?? 5, idleTimeoutMillis: 30_000 });
  return {
    query: async (text, params) => {
      try {
        const result = await pool.query(text, params as unknown[]);
        return { rows: result.rows };
      } catch (error) {
        throw mapDbError(error);
      }
    },
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const tx: Queryable = {
          query: async (text, params) => {
            try {
              const r = await client.query(text, params as unknown[]);
              return { rows: r.rows };
            } catch (error) {
              throw mapDbError(error);
            }
          },
        };
        const result = await fn(tx);
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/**
 * Runs `fn` inside a transaction as the Supabase `authenticated` role with the user's JWT claims set,
 * so Row Level Security applies exactly as it would through the Supabase API.
 */
export function withUser<T>(db: Db, userId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query('set local role authenticated');
    await tx.query(
      `select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true), set_config('request.jwt.claim.role', 'authenticated', true)`,
      [JSON.stringify({ sub: userId, role: 'authenticated' }), userId],
    );
    return fn(tx);
  });
}

const KNOWN = new Set(Object.keys(ERROR_CODES));

/** Maps `raise exception 'CODE'` from SQL functions to AppError; leaves other errors opaque. */
export function mapDbError(error: unknown): unknown {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const code = message.trim().split(/\s/)[0] ?? '';
  if (KNOWN.has(code)) return new AppError(code as ErrorCode);
  const pgCode = (error as { code?: string }).code;
  if (pgCode === '42501') return new AppError('FORBIDDEN', 'Permission denied');
  return error;
}

export function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}
