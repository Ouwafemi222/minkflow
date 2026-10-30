import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/auth';
import { env } from '@/lib/env';

const LINK_TYPES = new Set<EmailOtpType>(['email', 'magiclink', 'signup', 'invite', 'email_change']);

/**
 * Supabase email-link return. Accepts both the PKCE `?code=` redirect (default email templates; must be opened in
 * the browser that requested it) and `?token_hash=&type=` (templates in docs/SUPABASE-SETUP.md; works on any device).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const next = params.get('next') ?? '/studio';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/studio';
  const base = env().APP_BASE_URL;
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;

  if (code || (tokenHash && type && LINK_TYPES.has(type))) {
    const supabase = await supabaseServer();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });
    if (!error) return NextResponse.redirect(new URL(safeNext, base));
  }
  return NextResponse.redirect(new URL('/login?error=link', base));
}
