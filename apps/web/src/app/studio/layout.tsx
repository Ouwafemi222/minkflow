import { formatCredits } from '@minkflow/contracts';
import { getBalance, getMyWorkspace, withUser } from '@minkflow/db';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/Avatar';
import { Logo } from '@/components/SiteChrome';
import { StudioNav } from '@/components/StudioNav';
import { CancelDeletionBanner } from '@/components/account/CancelDeletionBanner';
import { loadAccount } from '@/lib/account';
import { requireSession } from '@/lib/auth';
import { isAdminEmail } from '@/lib/env';
import { db } from '@/lib/services';

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const { balance, account } = await withUser(db(), session.userId, async (tx) => ({
    balance: await getBalance(tx, (await getMyWorkspace(tx)).id),
    account: await loadAccount(tx, session),
  }));
  const youtube = account.youtube ? { channelTitle: account.youtube.channel_title, thumbnailUrl: account.youtube.channel_thumbnail_url } : null;
  return (
    <div className="studio" data-studio-theme="dark" style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}>
      <aside className="studio-nav" aria-label="Studio">
        <div className="studio-nav-brand" style={{ padding: '4px 6px 16px' }}>
          <Logo href="/studio" />
        </div>
        <StudioNav isAdmin={isAdminEmail(session.email)} youtube={youtube} />
        <div style={{ marginTop: 'auto' }} className="stack small studio-nav-footer">
          <div className="card" style={{ padding: 12 }}>
            <div className="muted">Credits</div>
            <strong style={{ fontSize: 20 }}>{formatCredits(balance)}</strong>
          </div>
          <Link href="/studio/account" className="account-link" title="Your account">
            <Avatar src={account.avatarUrl} name={account.displayName} size={32} />
            <span className="account-text">
              <span style={{ fontWeight: 600 }}>{account.displayName}</span>
              <span className="muted">{session.email}</span>
            </span>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="btn ghost sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="studio-main">
        {account.profile.deletion_requested_at ? <CancelDeletionBanner requestedAt={new Date(account.profile.deletion_requested_at).toISOString()} /> : null}
        {children}
      </main>
    </div>
  );
}
