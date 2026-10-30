import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withUser, type Db } from './client';
import { createTestDb } from './pglite';
import * as repo from './repos';

let db: Db;
let alice: { userId: string; workspaceId: string; projectId: string };
let bob: { userId: string; workspaceId: string; projectId: string };

async function makeUser(email: string) {
  const userId = (await db.query<{ id: string }>('insert into auth.users (email) values ($1) returning id', [email])).rows[0]!.id;
  return withUser(db, userId, async (tx) => {
    const ws = await repo.getMyWorkspace(tx);
    const project = await repo.createProject(tx, ws.id, `${email} project`);
    return { userId, workspaceId: ws.id, projectId: project.id };
  });
}

const ledgerSum = async (workspaceId: string) => repo.getBalance(db, workspaceId);

beforeAll(async () => {
  db = await createTestDb();
  alice = await makeUser('alice@example.com');
  bob = await makeUser('bob@example.com');
});
afterAll(async () => db.close());

describe('RLS cross-tenant isolation', () => {
  const tables = ['profiles', 'workspaces', 'projects', 'project_revisions', 'scenes', 'assets', 'jobs', 'job_artifacts', 'usage_events', 'credit_ledger', 'payments'];

  it('each user sees only their own rows in every user-readable table', async () => {
    await repo.createJob(db, { workspaceId: bob.workspaceId, projectId: bob.projectId, revisionId: null, type: 'noop', idempotencyKey: 'bob-1', input: {}, credits: 1_000_000, maxActive: 3 });
    await repo.insertAsset(db, { workspaceId: bob.workspaceId, projectId: bob.projectId, kind: 'upload', storageKey: `${bob.workspaceId}/x.png`, mime: 'image/png', size: 1, sha256: 'x' });
    await repo.recordUsage(db, { workspaceId: bob.workspaceId, jobId: null, provider: 'mock', model: null, operation: 'test', quantity: 1, unit: 'call', estimatedUsd: 0.01 });
    await repo.createPayment(db, { workspaceId: bob.workspaceId, reference: 'ref-bob', amountMinor: 900, currency: 'USD', credits: 900_000_000, packId: 'starter' });
    await withUser(db, alice.userId, async (tx) => {
      for (const table of tables) {
        const { rows } = await tx.query<{ ws: string | null; owner: string | null }>(`select * from public.${table}`);
        const json = JSON.stringify(rows);
        expect(json, `alice must not see bob's ${table}`).not.toContain(bob.workspaceId);
        expect(json, `alice must not see bob's ${table}`).not.toContain(bob.userId);
      }
    });
  });

  it('denies reading or modifying another tenant project by id', async () => {
    await withUser(db, alice.userId, async (tx) => {
      await expect(repo.getProject(tx, bob.projectId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(repo.renameProject(tx, bob.projectId, 'hacked')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  it('denies inserting a project into another workspace', async () => {
    await expect(withUser(db, alice.userId, (tx) => repo.createProject(tx, bob.workspaceId, 'intrusion'))).rejects.toThrow();
  });

  it('denies client writes to privileged columns and tables', async () => {
    await expect(withUser(db, alice.userId, (tx) => tx.query(`update public.projects set status = 'completed' where id = $1`, [alice.projectId]))).rejects.toThrow();
    await expect(withUser(db, alice.userId, (tx) => tx.query(`insert into public.credit_ledger (workspace_id, amount, kind, reference_type, reference_id, idempotency_key) values ($1, 999999999, 'grant', 'x', 'x', 'free-money')`, [alice.workspaceId]))).rejects.toThrow();
    await expect(withUser(db, alice.userId, (tx) => tx.query(`select public.grant_credits($1, 999, 'grant', 'x', 'x', 'free')`, [alice.workspaceId]))).rejects.toThrow();
    await expect(withUser(db, alice.userId, (tx) => tx.query(`select public.create_job($1, null, null, 'noop', 'k', '{}'::jsonb, 0, 3, 3)`, [alice.workspaceId]))).rejects.toThrow();
  });

  it('API roles hold exactly the intended privileges (guards against Supabase default grants)', async () => {
    const tableGrants = await db.query<{ grantee: string; table_name: string; privilege_type: string }>(
      `select grantee, table_name, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and grantee in ('anon', 'authenticated') order by 1, 2, 3`,
    );
    expect(tableGrants.rows.filter((g) => g.grantee === 'anon')).toEqual([]);
    const auth = tableGrants.rows.map((g) => `${g.table_name}:${g.privilege_type}`);
    const readable = ['assets', 'credit_ledger', 'job_artifacts', 'jobs', 'payments', 'profiles', 'project_revisions', 'projects', 'scenes', 'usage_events', 'workspaces'];
    expect(auth.filter((g) => !g.endsWith(':SELECT'))).toEqual([]);
    expect(auth.map((g) => g.split(':')[0]).sort()).toEqual(readable);

    const columnGrants = await db.query<{ table_name: string; column_name: string; privilege_type: string }>(
      `select table_name, column_name, privilege_type from information_schema.column_privileges
       where table_schema = 'public' and grantee = 'authenticated' and privilege_type <> 'SELECT' order by 1, 3, 2`,
    );
    expect(columnGrants.rows.map((c) => `${c.table_name}.${c.column_name}:${c.privilege_type}`)).toEqual([
      'profiles.display_name:UPDATE',
      'projects.title:INSERT',
      'projects.workspace_id:INSERT',
      'projects.deleted_at:UPDATE',
      'projects.title:UPDATE',
    ]);

    const fnGrants = await db.query<{ routine_name: string; grantee: string }>(
      `select routine_name, grantee from information_schema.role_routine_grants
       where routine_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC') order by 2, 1`,
    );
    expect(fnGrants.rows.map((r) => `${r.grantee}:${r.routine_name}`)).toEqual([
      'authenticated:cancel_job',
      'authenticated:commit_revision',
      'authenticated:my_workspace_ids',
      'authenticated:workspace_balance',
    ]);
  });

  it('denies committing a revision to another tenant project', async () => {
    await expect(withUser(db, alice.userId, (tx) => repo.commitRevision(tx, { projectId: bob.projectId, expectedVersion: 0, input: {}, script: null, storyboard: null, brand: {}, scenes: null }, 'user'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('denies canceling another tenant job', async () => {
    const { job } = await repo.createJob(db, { workspaceId: bob.workspaceId, projectId: bob.projectId, revisionId: null, type: 'noop', idempotencyKey: 'bob-cancel', input: {}, credits: 0, maxActive: 10 });
    await expect(withUser(db, alice.userId, (tx) => repo.cancelJob(tx, job.id))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('revisions', () => {
  it('commits with optimistic concurrency and rejects stale versions', async () => {
    const r1 = await withUser(db, alice.userId, (tx) => repo.commitRevision(tx, { projectId: alice.projectId, expectedVersion: 0, input: { a: 1 }, script: null, storyboard: null, brand: {}, scenes: null }, 'user'));
    expect(r1.version).toBe(1);
    await expect(withUser(db, alice.userId, (tx) => repo.commitRevision(tx, { projectId: alice.projectId, expectedVersion: 0, input: { a: 2 }, script: null, storyboard: null, brand: {}, scenes: null }, 'user'))).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    const project = await withUser(db, alice.userId, (tx) => repo.getProject(tx, alice.projectId));
    expect(project.current_revision_id).toBe(r1.id);
  });

  it('revisions are immutable', async () => {
    await expect(db.query(`update public.project_revisions set input_json = '{}'::jsonb`)).rejects.toThrow(/immutable/);
  });
});

describe('credits and jobs', () => {
  it('reserves on create, is idempotent per key, and settles actual usage', async () => {
    const before = await ledgerSum(alice.workspaceId);
    const input = { workspaceId: alice.workspaceId, projectId: alice.projectId, revisionId: null, type: 'render' as const, idempotencyKey: 'render-1', input: {}, credits: 10_000_000, maxActive: 3 };
    const first = await repo.createJob(db, input);
    const second = await repo.createJob(db, input);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.job.id).toBe(first.job.id);
    expect(await ledgerSum(alice.workspaceId)).toBe(before - 10_000_000);

    const claimed = await repo.claimJob(db, first.job.id, 'w1', 60);
    expect(claimed?.status).toBe('running');
    expect(await repo.claimJob(db, first.job.id, 'w2', 60)).toBeNull();
    expect(await repo.completeJob(db, first.job.id, 'w1', { ok: true }, 4_000_000)).toBe(true);
    expect(await repo.completeJob(db, first.job.id, 'w1', { ok: true }, 4_000_000)).toBe(false);
    expect(await ledgerSum(alice.workspaceId)).toBe(before - 4_000_000);
  });

  it('refuses jobs without enough credits and enforces concurrency limits', async () => {
    await expect(repo.createJob(db, { workspaceId: alice.workspaceId, projectId: null, revisionId: null, type: 'render', idempotencyKey: 'too-expensive', input: {}, credits: 10_000_000_000, maxActive: 3 })).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
    await repo.createJob(db, { workspaceId: alice.workspaceId, projectId: null, revisionId: null, type: 'noop', idempotencyKey: 'c1', input: {}, credits: 0, maxActive: 2 });
    await repo.createJob(db, { workspaceId: alice.workspaceId, projectId: null, revisionId: null, type: 'noop', idempotencyKey: 'c2', input: {}, credits: 0, maxActive: 2 });
    await expect(repo.createJob(db, { workspaceId: alice.workspaceId, projectId: null, revisionId: null, type: 'noop', idempotencyKey: 'c3', input: {}, credits: 0, maxActive: 2 })).rejects.toMatchObject({ code: 'CONCURRENCY_LIMIT' });
    for (const key of ['c1', 'c2']) {
      const job = (await db.query<{ id: string }>('select id from public.jobs where idempotency_key = $1', [key])).rows[0]!;
      await withUser(db, alice.userId, (tx) => repo.cancelJob(tx, job.id));
    }
  });

  it('retries without double charging, then refunds in full on final failure', async () => {
    const before = await ledgerSum(alice.workspaceId);
    const { job } = await repo.createJob(db, { workspaceId: alice.workspaceId, projectId: null, revisionId: null, type: 'media', idempotencyKey: 'media-fail', input: {}, credits: 5_000_000, maxActive: 3, maxAttempts: 2 });
    await repo.claimJob(db, job.id, 'w1', 60);
    expect(await repo.failJob(db, job.id, 'w1', 'PROVIDER_UNAVAILABLE', 'down', true, 0)).toBe('retry_pending');
    expect(await ledgerSum(alice.workspaceId)).toBe(before - 5_000_000);
    const again = await repo.claimNextJob(db, 'w2', 60, ['media']);
    expect(again?.id).toBe(job.id);
    expect(again?.attempt_count).toBe(2);
    expect(await repo.failJob(db, job.id, 'w2', 'PROVIDER_UNAVAILABLE', 'down', true, 0)).toBe('failed');
    expect(await ledgerSum(alice.workspaceId)).toBe(before);
    expect(await repo.failJob(db, job.id, 'w2', 'X', 'x', true, 0)).toBe('lost');
    expect(await ledgerSum(alice.workspaceId)).toBe(before);
  });

  it('cancel: queued jobs refund immediately; running jobs settle consumed credits only', async () => {
    const before = await ledgerSum(alice.workspaceId);
    const queued = await repo.createJob(db, { workspaceId: alice.workspaceId, projectId: null, revisionId: null, type: 'render', idempotencyKey: 'cancel-q', input: {}, credits: 3_000_000, maxActive: 3 });
    expect(await withUser(db, alice.userId, (tx) => repo.cancelJob(tx, queued.job.id))).toBe('canceled');
    expect(await ledgerSum(alice.workspaceId)).toBe(before);

    const running = await repo.createJob(db, { workspaceId: alice.workspaceId, projectId: null, revisionId: null, type: 'render', idempotencyKey: 'cancel-r', input: {}, credits: 3_000_000, maxActive: 3 });
    await repo.claimJob(db, running.job.id, 'w1', 60);
    expect(await withUser(db, alice.userId, (tx) => repo.cancelJob(tx, running.job.id))).toBe('cancel_requested');
    expect(await repo.heartbeatJob(db, running.job.id, 'w1', 60, 0.5, 'rendering')).toBe('cancel');
    expect(await repo.finishCanceledJob(db, running.job.id, 'w1', 1_000_000)).toBe(true);
    expect(await ledgerSum(alice.workspaceId)).toBe(before - 1_000_000);
  });

  it('sweeper recovers jobs whose worker died (expired lease)', async () => {
    const { job } = await repo.createJob(db, { workspaceId: alice.workspaceId, projectId: null, revisionId: null, type: 'noop', idempotencyKey: 'stuck', input: {}, credits: 0, maxActive: 3 });
    await repo.claimJob(db, job.id, 'dead-worker', 60);
    await db.query(`update public.jobs set locked_until = now() - interval '1 minute' where id = $1`, [job.id]);
    expect(await repo.sweepStuckJobs(db)).toBe(1);
    expect((await repo.getJob(db, job.id)).status).toBe('retry_pending');
    expect(await repo.heartbeatJob(db, job.id, 'dead-worker', 60, null, null)).toBe('lost');
    await withUser(db, alice.userId, (tx) => repo.cancelJob(tx, job.id));
  });

  it('ledger is append-only', async () => {
    await expect(db.query('update public.credit_ledger set amount = 1')).rejects.toThrow(/immutable/);
    await expect(db.query('delete from public.credit_ledger')).rejects.toThrow(/append-only/);
  });
});

describe('payments webhook fulfillment', () => {
  it('grants credits exactly once, rejects amount mismatch and unknown references', async () => {
    const before = await ledgerSum(alice.workspaceId);
    await repo.createPayment(db, { workspaceId: alice.workspaceId, reference: 'ref-1', amountMinor: 900, currency: 'USD', credits: 900_000_000, packId: 'starter' });
    const event = { eventId: 'evt-1', eventType: 'charge.success', payloadHash: 'h', reference: 'ref-1', externalId: 'ps-1', amountMinor: 900, currency: 'USD' };
    expect(await repo.fulfillPayment(db, event)).toBe('fulfilled');
    expect(await repo.fulfillPayment(db, event)).toBe('duplicate');
    expect(await repo.fulfillPayment(db, { ...event, eventId: 'evt-2' })).toBe('already_fulfilled');
    expect(await ledgerSum(alice.workspaceId)).toBe(before + 900_000_000);

    await repo.createPayment(db, { workspaceId: alice.workspaceId, reference: 'ref-2', amountMinor: 1900, currency: 'USD', credits: 2_400_000_000, packId: 'creator' });
    expect(await repo.fulfillPayment(db, { ...event, eventId: 'evt-3', reference: 'ref-2', amountMinor: 100 })).toBe('mismatch');
    expect(await repo.fulfillPayment(db, { ...event, eventId: 'evt-4', reference: 'nope' })).toBe('unknown_reference');
    expect(await ledgerSum(alice.workspaceId)).toBe(before + 900_000_000);
  });
});

describe('rate limiting', () => {
  it('allows up to the limit within a window', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await repo.checkRateLimit(db, 'test-key', 3, 60));
    expect(results).toEqual([true, true, true, false]);
  });
});
