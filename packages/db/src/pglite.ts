import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapDbError, type Db, type Queryable } from './client';
import { migrationFiles, SUPABASE_DIR } from './migrations';

export { migrationFiles };

function normalizeRow<T>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    if (typeof v === 'bigint') (row as Record<string, unknown>)[k] = Number(v);
  }
  return row;
}

function wrap(q: { query: PGlite['query'] }): Queryable {
  return {
    query: async <T>(text: string, params?: unknown[]) => {
      try {
        const result = await q.query<T>(text, params as unknown[]);
        return { rows: result.rows.map(normalizeRow) };
      } catch (error) {
        throw mapDbError(error);
      }
    },
  };
}

/** Embedded Postgres (WASM) for tests and Docker-free local development. */
export function pgliteDb(pglite: PGlite): Db {
  const base = wrap(pglite);
  return {
    query: base.query,
    transaction: (fn) => pglite.transaction((tx) => fn(wrap(tx as unknown as { query: PGlite['query'] }))),
    close: () => pglite.close(),
  };
}

/** Applies the Supabase auth emulation (local only) and all pending migrations. */
export async function applyAuthEmulation(pglite: PGlite): Promise<void> {
  await pglite.exec(readFileSync(join(SUPABASE_DIR, 'dev', 'auth-emulation.sql'), 'utf8'));
}

export async function migrateLocal(pglite: PGlite): Promise<string[]> {
  await applyAuthEmulation(pglite);
  await pglite.exec('create table if not exists public._local_migrations (name text primary key, applied_at timestamptz not null default now())');
  const applied = new Set((await pglite.query<{ name: string }>('select name from public._local_migrations')).rows.map((r) => r.name));
  const ran: string[] = [];
  for (const file of migrationFiles()) {
    if (applied.has(file.name)) continue;
    await pglite.transaction(async (tx) => {
      await tx.exec(file.sql);
      await tx.query('insert into public._local_migrations (name) values ($1)', [file.name]);
    });
    ran.push(file.name);
  }
  return ran;
}

export async function createTestDb(): Promise<Db> {
  const pglite = new PGlite();
  await migrateLocal(pglite);
  return pgliteDb(pglite);
}

export { PGlite };
