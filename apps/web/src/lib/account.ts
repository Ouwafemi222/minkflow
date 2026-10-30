import 'server-only';
import { getAsset, getMyProfile, getYoutubeConnection, type ProfileRow, type Queryable, type YoutubeConnectionRow } from '@minkflow/db';
import type { Session } from './auth';
import { env } from './env';
import { storage } from './services';

export interface AccountView {
  profile: ProfileRow;
  displayName: string;
  /** What the app shows: uploaded photo, provider photo (`auto`), or null for initials. */
  avatarUrl: string | null;
  providerAvatarUrl: string | null;
  youtube: YoutubeConnectionRow | null;
  youtubeAvailable: boolean;
}

export const youtubeAvailable = () => Boolean(env().GOOGLE_OAUTH_CLIENT_ID && env().GOOGLE_OAUTH_CLIENT_SECRET && env().TOKEN_ENCRYPTION_KEY);

/** Run inside withUser: everything is read through RLS. */
export async function loadAccount(tx: Queryable, session: Session): Promise<AccountView> {
  const profile = await getMyProfile(tx);
  const youtube = await getYoutubeConnection(tx);
  let avatarUrl: string | null = null;
  if (profile.avatar_mode === 'upload' && profile.avatar_asset_id) {
    const asset = await getAsset(tx, profile.avatar_asset_id).catch(() => null);
    if (asset) avatarUrl = await storage().signedGetUrl(asset.storage_key, { ttlSeconds: env().SIGNED_URL_TTL_SECONDS });
  } else if (profile.avatar_mode === 'auto') {
    avatarUrl = session.providerAvatarUrl ?? null;
  }
  return {
    profile,
    displayName: profile.display_name || session.providerName || session.email.split('@')[0] || 'You',
    avatarUrl,
    providerAvatarUrl: session.providerAvatarUrl ?? null,
    youtube,
    youtubeAvailable: youtubeAvailable(),
  };
}
