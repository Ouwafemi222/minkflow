import { getJob, getProject, listJobArtifacts } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authed } from '@/lib/api';
import { env } from '@/lib/env';
import { storage } from '@/lib/services';

/** Short-lived signed URL for a finished preview/render (never a public bucket URL). */
export const GET = authed<{ id: string }>(async (ctx, { id }) => {
  const jobId = z.uuid().parse(id);
  const { job, artifacts, title } = await ctx.asUser(async (tx) => {
    const j = await getJob(tx, jobId);
    const a = await listJobArtifacts(tx, jobId);
    const p = j.project_id ? await getProject(tx, j.project_id).catch(() => null) : null;
    return { job: j, artifacts: a, title: p?.title ?? 'video' };
  });
  const output = artifacts.find((a) => a.role === 'output');
  if (job.status !== 'completed' || !output) throw new AppError('NOT_FOUND', 'No video is available for this job');
  if (output.expires_at && new Date(output.expires_at) < new Date()) throw new AppError('NOT_FOUND', 'This video has expired. Render it again.');
  const safeName = `${title.replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'video'}${job.type === 'preview' ? '-preview' : ''}.mp4`;
  const inline = ctx.req.nextUrl.searchParams.get('inline') === '1';
  const url = await storage().signedGetUrl(output.storage_key, { ttlSeconds: env().SIGNED_URL_TTL_SECONDS, ...(inline ? {} : { downloadName: safeName }) });
  if (ctx.req.nextUrl.searchParams.get('format') === 'json') return { url, expiresInSeconds: env().SIGNED_URL_TTL_SECONDS };
  return NextResponse.redirect(url, 302);
});
