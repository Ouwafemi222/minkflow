import { NextResponse, type NextRequest } from 'next/server';
import { DEV_COOKIE, supabaseServer } from '@/lib/auth';
import { env } from '@/lib/env';
import { publicOrigin } from '@/lib/public-url';

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const site = publicOrigin(req.headers, env().APP_BASE_URL, env().ALLOWED_ORIGINS);
  if (origin && origin !== site && origin !== req.nextUrl.origin) return new NextResponse('Forbidden', { status: 403 });
  const res = NextResponse.redirect(new URL('/', site), 303);
  if (env().AUTH_DRIVER === 'dev') res.cookies.delete(DEV_COOKIE);
  else await (await supabaseServer()).auth.signOut();
  return res;
}
