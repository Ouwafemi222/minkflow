/**
 * Applies supabase/migrations to a real Supabase Postgres database, recording each one in
 * `supabase_migrations.schema_migrations` so the Supabase CLI sees the same history (V-22).
 *
 *   pnpm db:migrate            apply pending migrations
 *   pnpm db:migrate --dry-run  list pending migrations only
 *
 * Uses MIGRATION_DATABASE_URL if set (direct or session-pooler connection), else DATABASE_URL.
 * The local PGlite database migrates itself on start (`pnpm db:local`); this script is for Supabase.
 */
import { migrationFiles } from '../src/migrations';
import { connectFromEnv, describeTarget } from './supabase-env';

const dryRun = process.argv.includes('--dry-run');
const { db, url } = connectFromEnv('MIGRATION_DATABASE_URL');

try {
  console.log(`Target: ${describeTarget(url)}`);
  const { rows: authCheck } = await db.query<{ users: string | null }>(`select to_regclass('auth.users')::text as users`);
  if (!authCheck[0]?.users) {
    throw new Error('auth.users not found: this does not look like a Supabase database. Refusing to migrate.');
  }

  if (!dryRun) {
    await db.query(`create schema if not exists supabase_migrations`);
    await db.query(
      `create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`,
    );
  }
  const { rows: tracked } = await db.query<{ t: string | null }>(`select to_regclass('supabase_migrations.schema_migrations')::text as t`);
  const { rows } = tracked[0]?.t
    ? await db.query<{ version: string }>(`select version from supabase_migrations.schema_migrations`)
    : { rows: [] as Array<{ version: string }> };
  const applied = new Set(rows.map((r) => r.version));
  const pending = migrationFiles().filter((m) => !applied.has(m.version));

  if (pending.length === 0) {
    console.log('Up to date: no pending migrations.');
  } else if (dryRun) {
    console.log(`Pending (${pending.length}):\n${pending.map((m) => `  ${m.name}`).join('\n')}`);
  } else {
    for (const m of pending) {
      process.stdout.write(`Applying ${m.name} ... `);
      await db.transaction(async (tx) => {
        await tx.query(m.sql);
        await tx.query(`insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)`, [
          m.version,
          [m.sql],
          m.name.replace(/^\d+_/, '').replace(/\.sql$/, ''),
        ]);
      });
      console.log('ok');
    }
    console.log(`Applied ${pending.length} migration(s).`);
  }
} catch (error) {
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
