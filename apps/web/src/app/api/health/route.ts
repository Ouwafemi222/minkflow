import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { db } from '@/lib/services';

export const dynamic = 'force-dynamic';

/** Reports setting names and error codes only, never values, so a broken deployment can be diagnosed from outside. */
export async function GET() {
  const started = Date.now();
  let appEnv: string;
  try {
    appEnv = env().APP_ENV;
  } catch (error) {
    return NextResponse.json({ ok: false, config: (error as Error).message.replace(/^Invalid web environment: /, '') }, { status: 503 });
  }
  try {
    await db().query('select 1');
    return NextResponse.json({ ok: true, env: appEnv, db: 'ok', latencyMs: Date.now() - started });
  } catch (error) {
    const e = error as { code?: unknown };
    return NextResponse.json({ ok: false, env: appEnv, db: 'unavailable', code: typeof e.code === 'string' ? e.code : 'unknown' }, { status: 503 });
  }
}
