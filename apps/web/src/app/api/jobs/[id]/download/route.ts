import { getJob, getProject, listJobArtifacts } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authed } from '@/lib/api';
import { env } from '@/lib/env';
import { readStoredObject, streamStoredObject } from '@/lib/media-stream';
import { storage } from '@/lib/services';

/** Streams a finished preview/render (local) or redirects to a short-lived signed URL (S3). */
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

  if (storage().driver === 's3' && ctx.req.nextUrl.searchParams.get('format') === 'json') {
    const url = await storage().signedGetUrl(output.storage_key, { ttlSeconds: env().SIGNED_URL_TTL_SECONDS, ...(inline ? {} : { downloadName: safeName }) });
    return { url, expiresInSeconds: env().SIGNED_URL_TTL_SECONDS };
  }

  if (storage().driver === 's3') {
    try {
      const url = await storage().signedGetUrl(output.storage_key, { ttlSeconds: env().SIGNED_URL_TTL_SECONDS, ...(inline ? {} : { downloadName: safeName }) });
      return NextResponse.redirect(url, 302);
    } catch {
      throw new AppError('INTERNAL', 'Cloud storage is not configured. Set S3_ENDPOINT and credentials, or use local Studio to play files rendered on this computer.');
    }
  }

  const body = await readStoredObject(output.storage_key);
  return streamStoredObject(ctx.req, body, { mime: output.mime || 'video/mp4', filename: safeName, inline, key: output.storage_key });
});
