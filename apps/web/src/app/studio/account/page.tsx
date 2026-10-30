import { withUser } from '@minkflow/db';
import type { Metadata } from 'next';
import { DangerZone } from '@/components/account/DangerZone';
import { ProfileCard } from '@/components/account/ProfileCard';
import { YoutubeCard } from '@/components/account/YoutubeCard';
import { loadAccount } from '@/lib/account';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/services';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ youtube?: string }> }) {
  const session = await requireSession();
  const { youtube: result } = await searchParams;
  const account = await withUser(db(), session.userId, (tx) => loadAccount(tx, session));
  const yt = account.youtube;

  return (
    <div className="stack" style={{ ['--gap' as string]: '24px', maxWidth: 720 }}>
      <header className="stack" style={{ ['--gap' as string]: '4px' }}>
        <h1 style={{ margin: 0 }}>Account</h1>
        <p className="muted" style={{ margin: 0 }}>
          Your profile, connected channels and account settings.
        </p>
      </header>
      <ProfileCard
        displayName={account.displayName}
        email={session.email}
        avatarUrl={account.avatarUrl}
        avatarMode={account.profile.avatar_mode}
        providerAvatarUrl={account.providerAvatarUrl}
        providers={session.providers ?? []}
      />
      <YoutubeCard
        available={account.youtubeAvailable}
        channel={yt ? { id: yt.channel_id, title: yt.channel_title, thumbnailUrl: yt.channel_thumbnail_url, connectedAt: new Date(yt.connected_at).toISOString() } : null}
        result={result ?? null}
      />
      <DangerZone email={session.email} />
    </div>
  );
}
