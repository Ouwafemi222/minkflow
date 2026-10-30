import { withUser } from '@minkflow/db';
import { isAppError } from '@minkflow/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ProjectStudio } from '@/components/studio/ProjectStudio';
import { requireSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { loadProjectView } from '@/lib/project-view';
import { db } from '@/lib/services';

export const metadata: Metadata = { title: 'Studio' };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  try {
    const view = await withUser(db(), session.userId, (tx) => loadProjectView(tx, id));
    return <ProjectStudio initial={JSON.parse(JSON.stringify(view))} aiMode={env().AI_PROVIDER_MODE} />;
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
}
