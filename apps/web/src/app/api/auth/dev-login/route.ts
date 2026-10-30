import { checkRateLimit } from '@minkflow/db';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, readJson } from '@/lib/api';
import { createDevSessionValue, DEV_COOKIE } from '@/lib/auth';
import { env } from '@/lib/env';
import { db } from '@/lib/services';
import { AppError } from '@minkflow/shared';

/** LOCAL ONLY (APP_ENV=local, AUTH_DRIVER=dev): email-only sign-in against the local auth.users emulation. */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    if (env().AUTH_DRIVER !== 'dev' || env().APP_ENV !== 'local') throw new AppError('NOT_FOUND');
    const { email } = await readJson(req, z.object({ email: z.email().max(200) }));
    if (!(await checkRateLimit(db(), `dev-login:${email}`, 20, 60))) throw new AppError('RATE_LIMITED');
    const normalized = email.trim().toLowerCase();
    await db().query('insert into auth.users (email) values ($1) on conflict (email) do nothing', [normalized]);
    const { rows } = await db().query<{ id: string }>('select id from auth.users where email = $1', [normalized]);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(DEV_COOKIE, createDevSessionValue(rows[0]!.id, normalized), { httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: 7 * 24 * 3600 });
    return res;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
