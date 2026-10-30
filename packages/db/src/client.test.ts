import { describe, expect, it } from 'vitest';
import { pgConnectionConfig } from './client';

const URL_WITH_SSL = 'postgresql://postgres.ref:p%40ss@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&application_name=web';

describe('pgConnectionConfig', () => {
  it('drops URL ssl params so they cannot override the explicit mode', () => {
    const config = pgConnectionConfig(URL_WITH_SSL, { ssl: 'require' });
    expect(config.connectionString).not.toContain('sslmode');
    expect(config.connectionString).toContain('application_name=web');
    expect(config.connectionString).toContain('p%40ss');
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('defaults to no ssl for local databases', () => {
    expect(pgConnectionConfig('postgres://postgres:postgres@127.0.0.1:54329/postgres').ssl).toBe(false);
  });

  it('verifies against the provided CA and refuses verify without one', () => {
    expect(pgConnectionConfig(URL_WITH_SSL, { ssl: 'verify', caCert: 'PEM' }).ssl).toEqual({ rejectUnauthorized: true, ca: 'PEM' });
    expect(() => pgConnectionConfig(URL_WITH_SSL, { ssl: 'verify' })).toThrow(/DATABASE_CA_CERT/);
  });
});
