import 'server-only';
import { checkRateLimit, getMyWorkspace, withUser, type Queryable, type WorkspaceRow } from '@minkflow/db';
import { AppError, createLogger, toErrorEnvelope } from '@minkflow/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession, type Session } from './auth';
import { env } from './env';
import { db } from './services';

export const log = createLogger({ svc: 'web' });

export interface ApiContext {
  req: NextRequest;
  session: Session;
  requestId: string;
  /** Runs `fn` as the signed-in user with RLS applied. */
  asUser: <T>(fn: (tx: Queryable) => Promise<T>) => Promise<T>;
  workspace: () => Promise<WorkspaceRow>;
}

interface Options {
  /** Requests per minute per user for this route group. */
  rateLimit?: { key: string; perMinute: number };
  public?: false;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Blocks cross-site form/fetch submissions on cookie-authenticated mutations. */
function assertSameOrigin(req: NextRequest): void {
  if (!MUTATING.has(req.method)) return;
  const origin = req.headers.get('origin');
  if (!origin) return;
  const allowed = new Set([new URL(env().APP_BASE_URL).origin, ...env().ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean), req.nextUrl.origin]);
  if (!allowed.has(origin)) throw new AppError('FORBIDDEN', 'Cross-origin request blocked');
}

export function errorResponse(error: unknown, requestId: string): NextResponse {
  if (error instanceof z.ZodError) {
    const appError = new AppError('VALIDATION_FAILED', undefined, error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
    const { status, body } = toErrorEnvelope(appError, requestId);
    return NextResponse.json({ error: body }, { status, headers: { 'x-request-id': requestId } });
  }
  if (!(error instanceof AppError)) log.error('unhandled API error', { requestId, error: error instanceof Error ? error.stack : String(error) });
  const { status, body } = toErrorEnvelope(error, requestId);
  return NextResponse.json({ error: body }, { status, headers: { 'x-request-id': requestId } });
}

export function authed<P = Record<string, never>>(handler: (ctx: ApiContext, params: P) => Promise<unknown>, options: Options = {}) {
  return async (req: NextRequest, route: { params: Promise<P> }) => {
    const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
    try {
      assertSameOrigin(req);
      const session = await getSession();
      if (!session) throw new AppError('UNAUTHENTICATED');
      if (options.rateLimit) {
        const ok = await checkRateLimit(db(), `${options.rateLimit.key}:${session.userId}`, options.rateLimit.perMinute, 60);
        if (!ok) throw new AppError('RATE_LIMITED');
      }
      let ws: WorkspaceRow | null = null;
      const ctx: ApiContext = {
        req,
        session,
        requestId,
        asUser: (fn) => withUser(db(), session.userId, fn),
        workspace: async () => (ws ??= await withUser(db(), session.userId, getMyWorkspace)),
      };
      const result = await handler(ctx, await route.params);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { 'x-request-id': requestId } });
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}

export async function readJson<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  const text = await req.text();
  if (text.length > 200_000) throw new AppError('VALIDATION_FAILED', 'Request body too large');
  let raw: unknown = {};
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new AppError('VALIDATION_FAILED', 'Invalid JSON');
  }
  return schema.parse(raw);
}

export function idempotencyKey(req: NextRequest): string {
  const key = req.headers.get('idempotency-key');
  if (!key || !/^[A-Za-z0-9_.:-]{8,100}$/.test(key)) throw new AppError('IDEMPOTENCY_KEY_REQUIRED');
  return key;
}
