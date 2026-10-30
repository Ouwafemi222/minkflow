/**
 * Read-only checks that a Supabase project is connected correctly. Every database probe runs inside a
 * transaction that is rolled back. Exit code 1 if any check fails.
 *
 *   pnpm verify:supabase
 */
import { randomUUID } from 'node:crypto';
import type { Queryable } from '../src/client';
import { migrationFiles } from '../src/migrations';
import { connectFromEnv, describeTarget } from './supabase-env';

const results: Array<{ ok: boolean; name: string; detail: string }> = [];
const check = (ok: boolean, name: string, detail = '') => results.push({ ok, name, detail });

class Rollback extends Error {}

const { db, url } = connectFromEnv('DATABASE_URL');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

check(process.env.AUTH_DRIVER === 'supabase', 'AUTH_DRIVER=supabase', `currently "${process.env.AUTH_DRIVER ?? '(unset, defaults to supabase)'}"`);
check(/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl), 'NEXT_PUBLIC_SUPABASE_URL looks like https://<ref>.supabase.co', supabaseUrl || 'missing');
check(anonKey.length > 20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is set');
check(Boolean(process.env.ADMIN_EMAILS?.trim()), 'ADMIN_EMAILS is set', 'needed to reach /studio/admin');

try {
  const { rows } = await db.query<{ db_user: string; server: string }>(`select current_user as db_user, current_setting('server_version') as server`);
  check(true, 'Database connection', `${describeTarget(url)} as ${rows[0]!.db_user}, Postgres ${rows[0]!.server}`);

  const auth = await db.query<{ users: string | null }>(`select to_regclass('auth.users')::text as users`);
  check(Boolean(auth.rows[0]?.users), 'Supabase auth schema present');

  const applied = await db.query<{ version: string }>(
    `select version from supabase_migrations.schema_migrations`,
  ).catch(() => ({ rows: [] as Array<{ version: string }> }));
  const have = new Set(applied.rows.map((r) => r.version));
  const missing = migrationFiles().filter((m) => !have.has(m.version)).map((m) => m.name);
  check(missing.length === 0, 'All migrations applied', missing.length ? `missing: ${missing.join(', ')} (run pnpm db:migrate)` : '');

  const trigger = await db.query(`select 1 from pg_trigger where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass`);
  check(trigger.rows.length === 1, 'Signup trigger creates workspace + trial credits');

  const anonGrants = await db.query(
    `select table_name from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'`,
  );
  check(anonGrants.rows.length === 0, 'Anonymous API role has no table access', anonGrants.rows.length ? JSON.stringify(anonGrants.rows) : '');

  const ownFunctions = new Set(migrationFiles().flatMap((m) => [...m.sql.matchAll(/create (?:or replace )?function public\.(\w+)/gi)].map((x) => x[1]!.toLowerCase())));
  const anonFns = await db.query<{ routine_name: string }>(
    `select distinct routine_name from information_schema.role_routine_grants where routine_schema = 'public' and grantee in ('anon', 'PUBLIC')`,
  );
  const exposed = anonFns.rows.map((r) => r.routine_name).filter((n) => ownFunctions.has(n.toLowerCase()));
  check(exposed.length === 0, 'Anonymous API role cannot call Minkflow functions', exposed.join(', '));

  // V-15: the app connects as the database owner and switches to `authenticated` per request.
  const probeUser = randomUUID();
  await db
    .transaction(async (tx: Queryable) => {
      await tx.query('set local role authenticated');
      await tx.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [
        JSON.stringify({ sub: probeUser, role: 'authenticated' }),
        probeUser,
      ]);
      const who = await tx.query<{ role: string; uid: string | null }>(`select current_user as role, auth.uid()::text as uid`);
      check(who.rows[0]?.role === 'authenticated' && who.rows[0]?.uid === probeUser, 'Role switch + auth.uid() (V-15)', JSON.stringify(who.rows[0]));
      const visible = await tx.query(`select id from public.projects`);
      check(visible.rows.length === 0, 'RLS hides all projects from a user with no workspace');
      await tx.query('savepoint w');
      const write = await tx
        .query(`update public.projects set status = 'completed'`)
        .then(() => 'allowed')
        .catch((e: unknown) => (e as { message?: string }).message ?? 'denied');
      await tx.query('rollback to savepoint w');
      check(write !== 'allowed', 'Privileged column writes are denied', write);
      throw new Rollback();
    })
    .catch((e: unknown) => {
      if (!(e instanceof Rollback)) check(false, 'Role switch + auth.uid() (V-15)', e instanceof Error ? e.message : String(e));
    });
} catch (error) {
  check(false, 'Database connection', error instanceof Error ? error.message : String(error));
} finally {
  await db.close();
}

if (supabaseUrl && anonKey) {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: anonKey } });
    const body = (await res.json().catch(() => ({}))) as { external?: { email?: boolean }; disable_signup?: boolean; mailer_autoconfirm?: boolean };
    check(res.ok, 'Auth API reachable with anon key', `HTTP ${res.status}`);
    if (res.ok) {
      check(body.external?.email === true, 'Email sign-in provider enabled');
      check(body.disable_signup !== true, 'New sign-ups allowed');
    }
  } catch (error) {
    check(false, 'Auth API reachable with anon key', error instanceof Error ? error.message : String(error));
  }
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed
    ? `\n${failed} check(s) failed.`
    : `\nAll checks passed. Still confirm in the dashboard: Auth > URL Configuration (Site URL + redirect ${process.env.APP_BASE_URL ?? '<APP_BASE_URL>'}/auth/callback) and the email templates in docs/SUPABASE-SETUP.md.`,
);
process.exitCode = failed ? 1 : 0;
