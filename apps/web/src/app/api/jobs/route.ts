import { listWorkspaceJobs } from '@minkflow/db';
import { authed } from '@/lib/api';
import { toJobDto } from '@/lib/jobs';

export const GET = authed(async (ctx) => {
  const jobs = await ctx.asUser((tx) => listWorkspaceJobs(tx, 50));
  return { jobs: jobs.map((j) => ({ ...toJobDto(j), projectTitle: j.project_title })) };
});
