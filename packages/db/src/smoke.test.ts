import { describe, expect, it } from 'vitest';
import { withUser } from './client';
import { createTestDb } from './pglite';

describe('migrations on embedded Postgres', () => {
  it('apply cleanly and signup creates a workspace with trial credits', async () => {
    const db = await createTestDb();
    const { rows } = await db.query<{ id: string }>(`insert into auth.users (email) values ('a@example.com') returning id`);
    const userId = rows[0]!.id;
    const ws = await withUser(db, userId, (tx) => tx.query<{ id: string; balance: number }>(
      'select w.id, public.workspace_balance(w.id) as balance from public.workspaces w',
    ));
    expect(ws.rows).toHaveLength(1);
    expect(ws.rows[0]!.balance).toBe(60_000_000);
    await db.close();
  });
});
