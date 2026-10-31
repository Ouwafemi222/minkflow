import { withUser } from '@minkflow/db';
import { isAppError } from '@minkflow/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { VideoEditor } from '@/components/studio/VideoEditor';
import { requireSession } from '@/lib/auth';
import { loadProjectView } from '@/lib/project-view';
import { db } from '@/lib/services';

export const metadata: Metadata = { title: 'Edit video' };

export default async function ProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  try {
    const view = await withUser(db(), session.userId, (tx) => loadProjectView(tx, id));
    const render = view.jobs.find((j) => j.type === 'render' && j.status === 'completed');
    const preview = view.jobs.find((j) => j.type === 'preview' && j.status === 'completed');
    const job = render ?? preview;
    if (!job) redirect(`/studio/projects/${id}`);
    return <VideoEditor view={JSON.parse(JSON.stringify(view))} jobId={job.id} jobType={job.type} />;
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
}
