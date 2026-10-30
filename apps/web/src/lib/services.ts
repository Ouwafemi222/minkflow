import 'server-only';
import { createPgDb, type Db } from '@minkflow/db';
import { createPublisher, type JobPublisher } from '@minkflow/queue';
import { createStorageFromEnv, type ObjectStorage } from '@minkflow/storage';
import { isAbsolute, resolve } from 'node:path';
import { env } from './env';

// Singletons survive hot reloads in development.
const g = globalThis as unknown as { __mf?: { db?: Db; storage?: ObjectStorage; publisher?: JobPublisher } };
g.__mf ??= {};
const cache = g.__mf;

export function db(): Db {
  cache.db ??= createPgDb(env().DATABASE_URL, { max: 5 });
  return cache.db;
}

export function storage(): ObjectStorage {
  if (!cache.storage) {
    const e = env();
    const root = isAbsolute(e.LOCAL_STORAGE_ROOT) ? e.LOCAL_STORAGE_ROOT : resolve(/*turbopackIgnore: true*/ process.cwd(), '../..', e.LOCAL_STORAGE_ROOT);
    cache.storage = createStorageFromEnv({ ...e, LOCAL_STORAGE_ROOT: root });
  }
  return cache.storage;
}

export function publisher(): JobPublisher {
  cache.publisher ??= createPublisher(env().QUEUE_DRIVER, env().REDIS_URL);
  return cache.publisher;
}
