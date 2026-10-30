import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/auth';
import { env } from '@/lib/env';

/** Supabase magic-link / OAuth return: exchanges the one-time code for a session cookie. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/studio';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/studio';
  const base = env().APP_BASE_URL;
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, base));
  }
  return NextResponse.redirect(new URL('/login?error=link', base));
}
