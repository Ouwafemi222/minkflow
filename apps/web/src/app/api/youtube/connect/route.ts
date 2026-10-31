import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authed } from '@/lib/api';
import { env } from '@/lib/env';
import { publicOrigin } from '@/lib/public-url';
import { accountUrl, YT_STATE_COOKIE, YT_STATE_PATH, youtubeClient } from '@/lib/youtube';
import { buildAuthorizeUrl } from '@/lib/youtube-oauth';

/** Starts Google's consent screen for read access to the user's YouTube channel. */
export const GET = authed(
  async (ctx) => {
    const base = publicOrigin(ctx.req.headers, env().APP_BASE_URL, env().ALLOWED_ORIGINS);
    const client = youtubeClient(base);
    if (!client) return NextResponse.redirect(accountUrl('unavailable', base));
    const state = randomBytes(24).toString('base64url');
    const res = NextResponse.redirect(buildAuthorizeUrl(client, state));
    res.cookies.set(YT_STATE_COOKIE, `${ctx.session.userId}.${state}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: base.startsWith('https://'),
      path: YT_STATE_PATH,
      maxAge: 600,
    });
    return res;
  },
  { rateLimit: { key: 'youtube', perMinute: 10 } },
);
