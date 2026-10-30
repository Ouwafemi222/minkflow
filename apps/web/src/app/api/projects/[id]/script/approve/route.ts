import { commitDocument, loadLatestDocument } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';

/** Approval requires explicitly acknowledging AI-flagged factual claims (ADR-010). */
export const POST = authed<{ id: string }>(async (ctx, { id }) => {
  const projectId = z.uuid().parse(id);
  const body = await readJson(ctx.req, z.object({ expectedVersion: z.number().int(), claimsAcknowledged: z.literal(true) }));
  return ctx.asUser(async (tx) => {
    const { project, doc } = await loadLatestDocument(tx, projectId);
    if (project.version !== body.expectedVersion) throw new AppError('REVISION_CONFLICT');
    if (!doc.script || !['script_ready', 'storyboard_ready', 'failed', 'canceled'].includes(project.status)) throw new AppError('INVALID_STATE', 'There is no script to approve');
    const revision = await commitDocument(tx, projectId, project.version, { ...doc, script: { ...doc.script, approvedAt: new Date().toISOString(), claimsAcknowledged: true } }, 'user');
    return { version: revision.version };
  });
});
