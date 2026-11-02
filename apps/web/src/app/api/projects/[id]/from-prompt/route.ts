import { isScriptApproved, quoteMicro, scriptFromPrompt } from '@minkflow/contracts';
import { commitDocument, loadLatestDocument, setProjectStatus } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed, idempotencyKey } from '@/lib/api';
import { enqueueProjectJob } from '@/lib/jobs';

/** Skip LLM script writing: keep the creator's prompt, mark it approved, and start the storyboard. */
export const POST = authed<{ id: string }>(
  async (ctx, { id }) => {
    const projectId = z.uuid().parse(id);
    await ctx.asUser(async (tx) => {
      const { project, doc } = await loadLatestDocument(tx, projectId);
      if (doc.storyboard) throw new AppError('INVALID_STATE', 'This project already has a storyboard.');
      if (doc.script && isScriptApproved(doc.script)) return;
      if (doc.script) throw new AppError('INVALID_STATE', 'This project already has a script. Approve it, then build the storyboard.');
      if (project.status !== 'draft') throw new AppError('INVALID_STATE', `This step is not available while the project is ${project.status.replace(/_/g, ' ')}.`);
      const source = (doc.input.mode === 'topic' ? doc.input.topic : doc.input.script) ?? '';
      const script = { ...scriptFromPrompt(source, project.title), approvedAt: new Date().toISOString(), claimsAcknowledged: true as const };
      await commitDocument(tx, projectId, project.version, { ...doc, script }, 'user');
      const ok = await setProjectStatus(tx, projectId, ['draft'], 'script_ready');
      if (!ok) throw new AppError('INVALID_STATE', 'Could not skip script writing for this project.');
    });
    return enqueueProjectJob(ctx, {
      projectId,
      type: 'storyboard',
      credits: quoteMicro({ type: 'storyboard' }),
      idempotencyKey: idempotencyKey(ctx.req),
    });
  },
  { rateLimit: { key: 'generate', perMinute: 10 } },
);
