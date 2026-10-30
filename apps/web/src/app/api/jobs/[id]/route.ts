import { getJob } from '@minkflow/db';
import { z } from 'zod';
import { authed } from '@/lib/api';
import { toJobDto } from '@/lib/jobs';

export const GET = authed<{ id: string }>(async (ctx, { id }) => {
  const job = await ctx.asUser((tx) => getJob(tx, z.uuid().parse(id)));
  return { job: toJobDto(job) };
});
