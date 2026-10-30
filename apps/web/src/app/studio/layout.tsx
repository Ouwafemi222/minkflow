import { formatCredits } from '@minkflow/contracts';
import { getBalance, getMyWorkspace, withUser } from '@minkflow/db';
import type { ReactNode } from 'react';
import { Logo } from '@/components/SiteChrome';
import { StudioNav } from '@/components/StudioNav';
import { requireSession } from '@/lib/auth';
import { isAdminEmail } from '@/lib/env';
import { db } from '@/lib/services';

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const balance = await withUser(db(), session.userId, async (tx) => getBalance(tx, (await getMyWorkspace(tx)).id));
  return (
    <div className="studio" data-studio-theme="dark" style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}>
      <aside className="studio-nav" aria-label="Studio">
        <div className="studio-nav-brand" style={{ padding: '4px 6px 16px' }}>
          <Logo href="/studio" />
        </div>
        <StudioNav isAdmin={isAdminEmail(session.email)} />
        <div style={{ marginTop: 'auto' }} className="stack small studio-nav-footer">
          <div className="card" style={{ padding: 12 }}>
            <div className="muted">Credits</div>
            <strong style={{ fontSize: 20 }}>{formatCredits(balance)}</strong>
          </div>
          <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={session.email}>
            {session.email}
          </div>
          <form action="/auth/signout" method="post">
            <button className="btn ghost sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="studio-main">
        {children}
      </main>
    </div>
  );
}
