import { audit, getMyWorkspace, upsertYoutubeConnection, withUser } from '@minkflow/db';
import { encryptSecret } from '@minkflow/shared/node';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { log } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { db } from '@/lib/services';
import { accountUrl, YT_STATE_COOKIE, YT_STATE_PATH, youtubeClient } from '@/lib/youtube';
import { exchangeCode, fetchMyChannel, revokeToken } from '@/lib/youtube-oauth';

function sameValue(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Google redirects here after the consent screen. Always answers with a redirect back to the account page. */
export async function GET(req: NextRequest) {
  const finish = (result: string) => {
    const res = NextResponse.redirect(accountUrl(result));
    res.cookies.set(YT_STATE_COOKIE, '', { path: YT_STATE_PATH, maxAge: 0 });
    return res;
  };

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login?next=/studio/account', env().APP_BASE_URL));
  const client = youtubeClient();
  if (!client) return finish('unavailable');

  const params = req.nextUrl.searchParams;
  const expected = `${session.userId}.${params.get('state') ?? ''}`;
  const cookie = req.cookies.get(YT_STATE_COOKIE)?.value ?? '';
  if (!cookie || !sameValue(cookie, expected)) return finish('expired');
  if (params.get('error')) return finish(params.get('error') === 'access_denied' ? 'denied' : 'error');
  const code = params.get('code');
  if (!code) return finish('error');

  let refreshToken: string | null = null;
  try {
    const tokens = await exchangeCode(client, code);
    refreshToken = tokens.refreshToken;
    const channel = await fetchMyChannel(tokens.accessToken);
    if (!channel) {
      await revokeToken(refreshToken);
      return finish('no_channel');
    }
    const workspace = await withUser(db(), session.userId, getMyWorkspace);
    await upsertYoutubeConnection(db(), {
      workspaceId: workspace.id,
      userId: session.userId,
      channelId: channel.id,
      channelTitle: channel.title,
      channelThumbnailUrl: channel.thumbnailUrl,
      scopes: tokens.scopes,
      refreshTokenCiphertext: encryptSecret(refreshToken, env().TOKEN_ENCRYPTION_KEY),
    });
    await audit(db(), { actorId: session.userId, workspaceId: workspace.id, action: 'youtube.connected', targetId: channel.id });
    return finish('connected');
  } catch (error) {
    log.error('youtube connect failed', { userId: session.userId, error: error instanceof Error ? error.message : String(error) });
    if (refreshToken) await revokeToken(refreshToken).catch(() => false);
    return finish('error');
  }
}
