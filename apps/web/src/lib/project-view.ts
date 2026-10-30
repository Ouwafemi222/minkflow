import 'server-only';
import { formatCredits, isScriptApproved, PRICING, quoteMicro, storyboardSeconds, type ProjectDocument } from '@minkflow/contracts';
import { getBalance, hasSuccessfulPayment, listProjectJobs, loadLatestDocument, type Queryable } from '@minkflow/db';
import { toJobDto, type JobDto } from './jobs';

export interface ProjectView {
  project: { id: string; title: string; status: string; version: number; updatedAt: string };
  doc: ProjectDocument;
  jobs: JobDto[];
  balance: number;
  watermark: boolean;
  quotes: { script: number; storyboard: number; sceneRegenerate: number; media: number; preview: number; render: number };
  scriptApproved: boolean;
  seconds: number;
}

/** Everything the studio needs for one project, loaded as the user (RLS enforced). */
export async function loadProjectView(tx: Queryable, projectId: string): Promise<ProjectView> {
  const { project, doc } = await loadLatestDocument(tx, projectId);
  // One transaction client: queries must run sequentially.
  const jobs = await listProjectJobs(tx, projectId, 15);
  const balance = await getBalance(tx, project.workspace_id);
  const paid = await hasSuccessfulPayment(tx, project.workspace_id);
  const scenes = doc.storyboard?.scenes ?? [];
  const uncachedChars = scenes.filter((s) => !s.voiceAssetId).reduce((n, s) => n + s.narration.length, 0);
  const seconds = storyboardSeconds(scenes);
  return {
    project: { id: project.id, title: project.title, status: project.status, version: project.version, updatedAt: new Date(project.updated_at).toISOString() },
    doc,
    jobs: jobs.map(toJobDto),
    balance,
    watermark: !paid,
    quotes: {
      script: quoteMicro({ type: 'script' }),
      storyboard: quoteMicro({ type: 'storyboard' }),
      sceneRegenerate: quoteMicro({ type: 'scene_regenerate' }),
      media: quoteMicro({ type: 'media', uncachedChars }),
      preview: quoteMicro({ type: 'preview', seconds }),
      render: quoteMicro({ type: 'render', seconds }),
    },
    scriptApproved: isScriptApproved(doc.script),
    seconds,
  };
}

export { formatCredits, PRICING };
