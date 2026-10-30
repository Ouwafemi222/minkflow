/**
 * Docker-free local Postgres (ADR-015): persistent PGlite exposed over the Postgres wire protocol so the web
 * app and the worker can share it via DATABASE_URL. LOCAL DEVELOPMENT ONLY — not for staging or production.
 *
 *   pnpm --filter @minkflow/db db:local            # listens on 127.0.0.1:54329
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres
 */
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAuthEmulation, migrateLocal, PGlite } from '../src/pglite';

const root = fileURLToPath(new URL('../../../', import.meta.url));
// LOCAL_DB_DIR=memory gives a throwaway database (used by the Playwright e2e suite).
const inMemory = process.env.LOCAL_DB_DIR === 'memory';
const dataDir = inMemory ? 'memory://' : resolve(root, process.env.LOCAL_DB_DIR ?? '.data/pglite');
const port = Number(process.env.LOCAL_DB_PORT ?? 54329);

if (!inMemory) mkdirSync(dataDir, { recursive: true });
const db = new PGlite(dataDir);
// LOCAL_DB_MIGRATE=emulation-only leaves the schema empty so `pnpm db:migrate` can be rehearsed as on Supabase.
if (process.env.LOCAL_DB_MIGRATE === 'emulation-only') {
  await applyAuthEmulation(db);
  console.log('Auth emulation only; run pnpm db:migrate against this database');
} else {
  const ran = await migrateLocal(db);
  console.log(ran.length ? `Applied migrations: ${ran.join(', ')}` : 'Migrations up to date');
}

const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 20 });
await server.start();
console.log(`Local Postgres (PGlite) listening on ${server.getServerConn()} — data in ${dataDir}`);

const shutdown = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
