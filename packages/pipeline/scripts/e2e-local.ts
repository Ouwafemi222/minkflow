/**
 * Full local pipeline with the REAL Remotion renderer and ffprobe QC, mock AI/TTS providers, in-memory PGlite
 * and local storage: topic -> script -> approve -> storyboard -> narration -> preview -> final render.
 *   pnpm --filter @minkflow/pipeline e2e:local
 */
import { createMockLlm, createMockTts } from '@minkflow/ai';
import { DEFAULT_BRAND_KIT, quoteMicro, storyboardSeconds, type JobType } from '@minkflow/contracts';
import * as repo from '@minkflow/db';
import { commitDocument, loadLatestDocument, withUser } from '@minkflow/db';
import { createTestDb } from '@minkflow/db/pglite';
import { createLogger } from '@minkflow/shared';
import { createLocalStorage } from '@minkflow/storage';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRemotionRenderer, runJob, type PipelineDeps } from '../src/index';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)), '.data/e2e');
mkdirSync(root, { recursive: true });
const db = await createTestDb();
const deps: PipelineDeps = {
  db,
  storage: createLocalStorage({ root: resolve(root, 'storage'), baseUrl: 'http://localhost:3000', secret: 'e2e-local' }),
  llm: createMockLlm(),
  tts: createMockTts(),
  renderer: createRemotionRenderer({ concurrency: null }),
  logger: createLogger({ svc: 'e2e' }, 'info'),
  config: { workerId: 'e2e', leaseSeconds: 120, platformDailyCapUsd: 10, workspaceDailyCapUsd: 10, renderConcurrency: null, tempDir: root, narrationRetentionDays: 30, renderRetentionDays: 30, previewRetentionDays: 7 },
};

const userId = (await db.query<{ id: string }>(`insert into auth.users (email) values ('e2e@example.com') returning id`)).rows[0]!.id;
const { workspaceId, projectId } = await withUser(db, userId, async (tx) => {
  const ws = await repo.getMyWorkspace(tx);
  const p = await repo.createProject(tx, ws.id, 'How vaccines train your immune system');
  await commitDocument(tx, p.id, 0, {
    input: { mode: 'topic', topic: 'How vaccines train your immune system', audience: 'general', tone: 'friendly', targetSeconds: 60, language: 'en', aspectRatio: '16:9', voiceId: 'mock-ava' },
    script: null,
    storyboard: null,
    brand: DEFAULT_BRAND_KIT,
  }, 'user');
  return { workspaceId: ws.id, projectId: p.id };
});

async function run(type: JobType, seconds = 0): Promise<repo.JobRow> {
  const project = await repo.getProject(db, projectId);
  const { job } = await repo.createJob(db, { workspaceId, projectId, revisionId: project.current_revision_id, type, idempotencyKey: `${type}-${Date.now()}`, input: {}, credits: quoteMicro({ type, seconds, uncachedChars: 3000 }), maxActive: 3 });
  const claimed = (await repo.claimJob(db, job.id, 'e2e', 120))!;
  const t0 = Date.now();
  const outcome = await runJob(deps, claimed);
  const finished = await repo.getJob(db, job.id);
  console.log(`${type}: ${outcome} in ${((Date.now() - t0) / 1000).toFixed(1)}s`, finished.error_code ?? '', JSON.stringify(finished.result_json));
  if (outcome !== 'completed') process.exit(1);
  return finished;
}

await run('script');
await withUser(db, userId, async (tx) => {
  const { project, doc } = await loadLatestDocument(tx, projectId);
  await commitDocument(tx, projectId, project.version, { ...doc, script: { ...doc.script!, approvedAt: new Date().toISOString(), claimsAcknowledged: true } }, 'user');
});
await run('storyboard');
await run('media');
const seconds = storyboardSeconds((await loadLatestDocument(db, projectId)).doc.storyboard!.scenes);
await run('preview', seconds);
const final = await run('render', seconds);
const [artifact] = await repo.listJobArtifacts(db, final.id);
const report = { seconds, artifact: artifact?.storage_key, meta: artifact?.meta_json, balance: (await repo.getBalance(db, workspaceId)) / 1_000_000 };
writeFileSync(resolve(root, 'e2e-report.json'), JSON.stringify(report, null, 2));
console.log('E2E OK', report);
await db.close();
