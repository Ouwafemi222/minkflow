import { createMockLlm, createMockTts, type LlmProvider } from '@minkflow/ai';
import { applySceneEdit, DEFAULT_BRAND_KIT, quoteMicro, type JobType, type ProjectDocument, type ProjectStatus } from '@minkflow/contracts';
import * as repo from '@minkflow/db';
import { commitDocument, loadLatestDocument, withUser, type Db } from '@minkflow/db';
import { createTestDb } from '@minkflow/db/pglite';
import { createLogger } from '@minkflow/shared';
import { createLocalStorage } from '@minkflow/storage';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runJob, runRetentionSweep, type PipelineDeps, type Renderer } from './index';

let db: Db;
let root: string;
let deps: PipelineDeps;
let user: { userId: string; workspaceId: string; projectId: string };
let renderGate: Promise<void> | null = null;

/** Fake renderer: writes a placeholder file and reports a passing QC. Real rendering is covered by render tests. */
const fakeRenderer: Renderer = {
  async render(manifest, { outputPath, onProgress, isCanceled }) {
    onProgress(0.5);
    if (renderGate) {
      await renderGate;
      if (isCanceled()) throw new Error('render canceled');
    }
    await writeFile(outputPath, Buffer.from(`fake-mp4 ${manifest.scenes.length}`));
  },
  async qc(_path, expect) {
    return { ok: true, failures: [], probe: { width: expect.width, height: expect.height, fps: expect.fps, durationSeconds: expect.durationSeconds, sizeBytes: 10 }, blankSegments: [], silentSegments: [], audio: null };
  },
  async probeDurationMs(path) {
    const buf = await import('node:fs/promises').then((fs) => fs.readFile(path));
    const byteRate = buf.readUInt32LE(28);
    return Math.round(((buf.byteLength - 44) / byteRate) * 1000);
  },
};

async function enqueue(type: JobType, input: Record<string, unknown> = {}, options: { credits?: number; pending?: ProjectStatus; revisionId?: string | null; maxAttempts?: number } = {}) {
  const project = await repo.getProject(db, user.projectId);
  if (options.pending) await repo.setProjectStatus(db, user.projectId, null, options.pending);
  const { job } = await repo.createJob(db, {
    workspaceId: user.workspaceId,
    projectId: user.projectId,
    revisionId: options.revisionId === undefined ? project.current_revision_id : options.revisionId,
    type,
    idempotencyKey: `${type}-${crypto.randomUUID()}`,
    input,
    credits: options.credits ?? quoteMicro({ type, uncachedChars: 5000, seconds: 40 }),
    maxActive: 5,
    maxAttempts: options.maxAttempts ?? 3,
  });
  return job;
}

async function claimAndRun(jobId: string, d: PipelineDeps = deps) {
  const claimed = await repo.claimJob(db, jobId, d.config.workerId, 30);
  if (!claimed) throw new Error('claim failed');
  return runJob(d, claimed);
}

const status = async () => (await repo.getProject(db, user.projectId)).status;
const latest = async () => (await loadLatestDocument(db, user.projectId)).doc;

beforeAll(async () => {
  db = await createTestDb();
  root = await mkdtemp(join(tmpdir(), 'minkflow-pipeline-'));
  deps = {
    db,
    storage: createLocalStorage({ root: join(root, 'storage'), baseUrl: 'http://localhost:3000', secret: 'test-secret' }),
    llm: createMockLlm(),
    tts: createMockTts(),
    renderer: fakeRenderer,
    logger: createLogger({}, 'error'),
    config: { workerId: 'test-worker', leaseSeconds: 30, platformDailyCapUsd: 100, workspaceDailyCapUsd: 10, renderConcurrency: 1, tempDir: root, narrationRetentionDays: 30, renderRetentionDays: 30, previewRetentionDays: 7 },
  };
  const userId = (await db.query<{ id: string }>(`insert into auth.users (email) values ('creator@example.com') returning id`)).rows[0]!.id;
  user = await withUser(db, userId, async (tx) => {
    const ws = await repo.getMyWorkspace(tx);
    const project = await repo.createProject(tx, ws.id, 'Compound interest');
    const doc: ProjectDocument = {
      input: { mode: 'topic', topic: 'Compound interest', audience: 'beginners', tone: 'friendly', targetSeconds: 60, language: 'en', aspectRatio: '16:9', voiceId: 'mock-ava' },
      script: null,
      storyboard: null,
      brand: DEFAULT_BRAND_KIT,
    };
    await commitDocument(tx, project.id, 0, doc, 'user');
    return { userId, workspaceId: ws.id, projectId: project.id };
  });
});
afterAll(async () => {
  await db.close();
  await rm(root, { recursive: true, force: true });
});

describe('job pipeline (mock providers, PGlite)', () => {
  it('script -> approve -> storyboard', async () => {
    const before = await repo.getBalance(db, user.workspaceId);
    const job = await enqueue('script', {}, { pending: 'script_pending' });
    expect(await claimAndRun(job.id)).toBe('completed');
    expect(await status()).toBe('script_ready');
    expect(await repo.getBalance(db, user.workspaceId)).toBe(before - quoteMicro({ type: 'script' }));

    const story = await enqueue('storyboard', {}, { pending: 'storyboard_pending' });
    expect(await claimAndRun(story.id)).toBe('failed');
    expect(await status()).toBe('failed');

    await withUser(db, user.userId, async (tx) => {
      const { project, doc } = await loadLatestDocument(tx, user.projectId);
      await commitDocument(tx, user.projectId, project.version, { ...doc, script: { ...doc.script!, approvedAt: new Date().toISOString(), claimsAcknowledged: true } }, 'user');
    });
    const story2 = await enqueue('storyboard', {}, { pending: 'storyboard_pending' });
    expect(await claimAndRun(story2.id)).toBe('completed');
    expect(await status()).toBe('storyboard_ready');
    expect((await latest()).storyboard!.scenes.length).toBeGreaterThanOrEqual(3);
  });

  it('media synthesizes narration once and reuses the cache', async () => {
    const before = await repo.getBalance(db, user.workspaceId);
    const job = await enqueue('media', {}, { pending: 'media_pending' });
    expect(await claimAndRun(job.id)).toBe('completed');
    expect(await status()).toBe('media_ready');
    const scenes = (await latest()).storyboard!.scenes;
    expect(scenes.every((s) => s.voiceAssetId && s.captions.length > 0)).toBe(true);
    const charged = before - (await repo.getBalance(db, user.workspaceId));
    expect(charged).toBeGreaterThan(0);

    const again = await enqueue('media', {}, { pending: 'media_pending' });
    expect(await claimAndRun(again.id)).toBe('completed');
    const r = (await repo.getJob(db, again.id)).result_json as { synthesized: number; cached: number };
    expect(r.synthesized).toBe(0);
    expect(r.cached).toBe(scenes.length);
  });

  it('editing one narration invalidates only that scene', async () => {
    await withUser(db, user.userId, async (tx) => {
      const { project, doc } = await loadLatestDocument(tx, user.projectId);
      const scenes = doc.storyboard!.scenes;
      scenes[1] = applySceneEdit(scenes[1]!, { narration: 'A brand new line of narration for this scene.' });
      expect(scenes[1]!.voiceAssetId).toBeUndefined();
      await commitDocument(tx, user.projectId, project.version, doc, 'user');
    });
    const job = await enqueue('media', {}, { pending: 'media_pending' });
    expect(await claimAndRun(job.id)).toBe('completed');
    const r = (await repo.getJob(db, job.id)).result_json as { synthesized: number };
    expect(r.synthesized).toBe(1);
  });

  it('renders, publishes after QC, and watermarks free workspaces', async () => {
    const job = await enqueue('render', {}, { pending: 'render_queued' });
    expect(await claimAndRun(job.id)).toBe('completed');
    expect(await status()).toBe('completed');
    const artifacts = await repo.listJobArtifacts(db, job.id);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.kind).toBe('render');
    expect(artifacts[0]!.meta_json.watermark).toBe(true);
    expect((await deps.storage.head(artifacts[0]!.storage_key))?.size).toBeGreaterThan(0);
  });

  it('cancels a running render and refunds the reservation', async () => {
    const before = await repo.getBalance(db, user.workspaceId);
    const job = await enqueue('render', {}, { pending: 'render_queued' });
    let release!: () => void;
    renderGate = new Promise((r) => (release = r));
    const running = claimAndRun(job.id);
    await new Promise((r) => setTimeout(r, 300));
    expect(await repo.cancelJob(db, job.id)).toBe('cancel_requested');
    release();
    expect(await running).toBe('canceled');
    renderGate = null;
    expect(await repo.getBalance(db, user.workspaceId)).toBe(before);
    expect(await status()).toBe('canceled');
  });

  it('retries retryable failures, then fails and refunds', async () => {
    const before = await repo.getBalance(db, user.workspaceId);
    const broken: LlmProvider = { ...createMockLlm({ failFirstAttempts: 1000 }) };
    const job = await enqueue('script', {}, { pending: 'script_pending', maxAttempts: 2 });
    expect(await claimAndRun(job.id, { ...deps, llm: broken })).toBe('retry_pending');
    expect(await status()).toBe('retry_pending');
    await db.query('update public.jobs set run_after = now() where id = $1', [job.id]);
    expect(await claimAndRun(job.id, { ...deps, llm: broken })).toBe('failed');
    expect(await status()).toBe('failed');
    expect((await repo.getJob(db, job.id)).error_code).toBe('AI_OUTPUT_INVALID');
    expect(await repo.getBalance(db, user.workspaceId)).toBe(before);
  });

  it('pauses provider calls when the spend cap is reached', async () => {
    const job = await enqueue('script', {}, { pending: 'script_pending', maxAttempts: 1 });
    const capped = { ...deps, config: { ...deps.config, workspaceDailyCapUsd: 0 } };
    expect(await claimAndRun(job.id, capped)).toBe('failed');
    expect((await repo.getJob(db, job.id)).error_code).toBe('SPEND_CAP_REACHED');
  });

  it('retention sweep deletes expired files and marks assets', async () => {
    const key = `ws/${user.workspaceId}/uploads/expired.png`;
    await deps.storage.put(key, new Uint8Array([1, 2, 3]), 'image/png');
    const asset = await repo.insertAsset(db, { workspaceId: user.workspaceId, projectId: user.projectId, kind: 'upload', storageKey: key, mime: 'image/png', size: 3, sha256: 'x', expiresAt: new Date(Date.now() - 1000) });
    const result = await runRetentionSweep(deps);
    expect(result.assets).toBeGreaterThanOrEqual(1);
    expect(existsSync(join(root, 'storage', key))).toBe(false);
    await expect(repo.getAsset(db, asset.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
