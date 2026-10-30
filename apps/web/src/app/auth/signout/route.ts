import { NextResponse, type NextRequest } from 'next/server';
import { DEV_COOKIE, supabaseServer } from '@/lib/auth';
import { env } from '@/lib/env';

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(env().APP_BASE_URL).origin && origin !== req.nextUrl.origin) return new NextResponse('Forbidden', { status: 403 });
  const res = NextResponse.redirect(new URL('/', env().APP_BASE_URL), 303);
  if (env().AUTH_DRIVER === 'dev') res.cookies.delete(DEV_COOKIE);
  else await (await supabaseServer()).auth.signOut();
  return res;
}
