import {
  BrandKitSchema,
  ProjectInputSchema,
  sceneRows,
  ScriptStateSchema,
  StoryboardStateSchema,
  type ProjectDocument,
} from '@minkflow/contracts';
import { AppError, isAppError } from '@minkflow/shared';
import type { Db, Queryable } from './client';
import { commitRevision, getProject, getRevision } from './repos';
import type { ProjectRow, RevisionRow } from './types';

export function parseDocument(revision: RevisionRow): ProjectDocument {
  return {
    input: ProjectInputSchema.parse(revision.input_json),
    script: revision.script_json ? ScriptStateSchema.parse(revision.script_json) : null,
    storyboard: revision.storyboard_json ? StoryboardStateSchema.parse(revision.storyboard_json) : null,
    brand: BrandKitSchema.parse(revision.brand_json),
  };
}

export async function loadRevisionDocument(q: Queryable, revisionId: string): Promise<{ revision: RevisionRow; doc: ProjectDocument }> {
  const revision = await getRevision(q, revisionId);
  return { revision, doc: parseDocument(revision) };
}

export async function loadLatestDocument(q: Queryable, projectId: string): Promise<{ project: ProjectRow; revision: RevisionRow; doc: ProjectDocument }> {
  const project = await getProject(q, projectId);
  if (!project.current_revision_id) throw new AppError('INVALID_STATE', 'Project has no content yet');
  const { revision, doc } = await loadRevisionDocument(q, project.current_revision_id);
  return { project, revision, doc };
}

/** Commits a full document as a new immutable revision, guarded by the expected project version. */
export async function commitDocument(q: Queryable, projectId: string, expectedVersion: number, doc: ProjectDocument, as: 'user' | 'service'): Promise<RevisionRow> {
  return commitRevision(
    q,
    {
      projectId,
      expectedVersion,
      input: ProjectInputSchema.parse(doc.input),
      script: doc.script ? ScriptStateSchema.parse(doc.script) : null,
      storyboard: doc.storyboard ? StoryboardStateSchema.parse(doc.storyboard) : null,
      brand: BrandKitSchema.parse(doc.brand),
      scenes: doc.storyboard ? sceneRows(doc.storyboard.scenes) : null,
    },
    as,
  );
}

/**
 * Worker-side merge: re-reads the latest revision and applies `mutate`, retrying on REVISION_CONFLICT so a
 * concurrent user autosave is never overwritten. Return null from `mutate` to skip committing.
 */
export async function applyToLatestRevision(
  db: Db,
  projectId: string,
  mutate: (doc: ProjectDocument, project: ProjectRow) => ProjectDocument | null,
  attempts = 5,
): Promise<RevisionRow | null> {
  for (let attempt = 1; ; attempt++) {
    const { project, doc } = await loadLatestDocument(db, projectId);
    const next = mutate(structuredClone(doc), project);
    if (!next) return null;
    try {
      return await commitDocument(db, projectId, project.version, next, 'service');
    } catch (error) {
      if (!(isAppError(error) && error.code === 'REVISION_CONFLICT') || attempt >= attempts) throw error;
    }
  }
}
