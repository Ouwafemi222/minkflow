import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { db } from '@/lib/services';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  try {
    await db().query('select 1');
    return NextResponse.json({ ok: true, env: env().APP_ENV, db: 'ok', latencyMs: Date.now() - started });
  } catch {
    return NextResponse.json({ ok: false, db: 'unavailable' }, { status: 503 });
  }
}
