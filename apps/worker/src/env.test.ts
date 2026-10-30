import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const staging = {
  APP_ENV: 'staging',
  APP_BASE_URL: 'https://staging.example.test',
  DATABASE_URL: 'postgresql://postgres.ref:pw@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
  STORAGE_DRIVER: 's3',
  AI_PROVIDER_MODE: 'live',
};

describe('worker env', () => {
  it('requires an encrypted database connection outside local', () => {
    expect(() => loadEnv(staging)).toThrow(/DATABASE_SSL/);
    expect(loadEnv({ ...staging, DATABASE_SSL: 'require' }).DATABASE_SSL).toBe('require');
  });

  it('requires a CA certificate for verify mode', () => {
    expect(() => loadEnv({ ...staging, DATABASE_SSL: 'verify' })).toThrow(/DATABASE_CA_CERT/);
  });

  it('defaults to no SSL for the local database', () => {
    expect(loadEnv({ APP_BASE_URL: 'http://localhost:3000', DATABASE_URL: 'postgres://x@127.0.0.1/postgres', LOCAL_STORAGE_SECRET: 'x'.repeat(16) }).DATABASE_SSL).toBe('disable');
  });
});
