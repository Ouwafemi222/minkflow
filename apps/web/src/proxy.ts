import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session cookie on navigation and sends signed-out visitors away from the studio.
 * Authorization is still enforced server-side on every API route and by Postgres RLS; this is only UX.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const isStudio = request.nextUrl.pathname.startsWith('/studio');

  if (process.env.AUTH_DRIVER === 'dev') {
    if (isStudio && !request.cookies.get('mf_dev_session')) return NextResponse.redirect(new URL('/login', request.url));
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  const { data } = await supabase.auth.getUser();
  if (isStudio && !data.user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));
  return response;
}

export const config = {
  matcher: ['/studio/:path*', '/login'],
};
