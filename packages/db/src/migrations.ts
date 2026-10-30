import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SUPABASE_DIR = fileURLToPath(new URL('../../../supabase', import.meta.url));

export interface MigrationFile {
  name: string;
  /** Timestamp prefix, the key the Supabase CLI uses in `supabase_migrations.schema_migrations`. */
  version: string;
  sql: string;
}

export function migrationFiles(): MigrationFile[] {
  const dir = join(SUPABASE_DIR, 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, version: name.split('_')[0]!, sql: readFileSync(join(dir, name), 'utf8') }));
}
