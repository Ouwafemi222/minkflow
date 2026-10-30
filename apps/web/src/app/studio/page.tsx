import { listProjects, withUser } from '@minkflow/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/services';

export const metadata: Metadata = { title: 'Projects' };

const ONBOARDING = [
  'Pick a topic (or paste your script), audience, tone and length.',
  'Review the script. Confirm any flagged factual claims before approving.',
  'Edit the storyboard: reorder scenes, change templates and on-screen text.',
  'Generate the voiceover, watch a quick draft preview, then render the final MP4.',
];

export default async function StudioHome() {
  const session = await requireSession();
  const projects = await withUser(db(), session.userId, (tx) => listProjects(tx));
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <div className="spread">
        <h1 style={{ margin: 0 }}>Your videos</h1>
        <Link href="/studio/new" className="btn primary">
          New video
        </Link>
      </div>
      {projects.length === 0 ? (
        <section className="card stack" aria-labelledby="getting-started">
          <h2 id="getting-started" style={{ margin: 0 }}>
            Make your first explainer in four steps
          </h2>
          <ol className="stack muted" style={{ margin: 0 }}>
            {ONBOARDING.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <div>
            <Link href="/studio/new" className="btn primary">
              Start a video
            </Link>
          </div>
        </section>
      ) : (
        <ul className="grid" style={{ listStyle: 'none', padding: 0 }}>
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/studio/projects/${p.id}`} className="card stack" style={{ textDecoration: 'none', color: 'inherit', ['--gap' as string]: '8px' }}>
                <strong>{p.title}</strong>
                <StatusBadge status={p.status} />
                <span className="small muted">Updated {new Date(p.updated_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
