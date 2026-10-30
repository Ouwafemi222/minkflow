import 'server-only';
import { youtubeAvailable } from './account';
import { env } from './env';
import type { OAuthClient } from './youtube-oauth';

export const YT_STATE_COOKIE = 'mf_yt_oauth';
export const YT_STATE_PATH = '/api/youtube';

export function youtubeClient(): OAuthClient | null {
  if (!youtubeAvailable()) return null;
  const e = env();
  return {
    clientId: e.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: e.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: new URL('/api/youtube/callback', e.APP_BASE_URL).toString(),
  };
}

/** Where the account page shows the result of a connect/disconnect attempt. */
export const accountUrl = (result: string) => new URL(`/studio/account?youtube=${result}#youtube`, env().APP_BASE_URL);
