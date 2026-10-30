import { PRICING } from '@minkflow/contracts';
import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { availableVoices } from '@/lib/voices';
import { NewProjectForm } from './NewProjectForm';

export const metadata: Metadata = { title: 'New video' };

export default async function NewProjectPage() {
  await requireSession();
  return (
    <div className="stack" style={{ maxWidth: 760, ['--gap' as string]: '16px' }}>
      <h1 style={{ margin: 0 }}>New video</h1>
      <p className="muted" style={{ margin: 0 }}>
        We’ll draft a script for you to review first. Writing the script costs {PRICING.scriptCredits} credits.
      </p>
      {env().AI_PROVIDER_MODE !== 'live' ? (
        <p className="alert warning small">Offline mock mode: scripts are templated and voices are placeholder tones, not real AI output.</p>
      ) : null}
      <NewProjectForm voices={availableVoices()} />
    </div>
  );
}
