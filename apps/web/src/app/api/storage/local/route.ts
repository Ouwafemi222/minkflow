import { verifyLocalSignature } from '@minkflow/storage';
import { NextResponse, type NextRequest } from 'next/server';
import { extname } from 'node:path';
import { env } from '@/lib/env';
import { storage } from '@/lib/services';

/**
 * LOCAL DEVELOPMENT ONLY: serves/accepts files for STORAGE_DRIVER=local using HMAC-signed, expiring URLs that
 * mirror R2 presigned URLs. Disabled (404) for any other storage driver.
 */
const TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

function check(req: NextRequest, method: 'GET' | 'PUT') {
  if (env().STORAGE_DRIVER !== 'local') return null;
  const p = req.nextUrl.searchParams;
  const key = p.get('key') ?? '';
  const expires = Number(p.get('expires'));
  const extra = method === 'GET' ? (p.get('name') ? `name=${p.get('name')}` : '') : `ct=${p.get('ct') ?? ''}&max=${p.get('max') ?? ''}`;
  if (!verifyLocalSignature(env().LOCAL_STORAGE_SECRET, method, key, expires, p.get('sig') ?? '', extra)) return null;
  return { key, name: p.get('name'), ct: p.get('ct'), max: Number(p.get('max') ?? 0) };
}

export async function GET(req: NextRequest) {
  const ok = check(req, 'GET');
  if (!ok) return new NextResponse('Forbidden', { status: 403 });
  let body: Buffer;
  try {
    body = await storage().get(ok.key);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
  const headers: Record<string, string> = {
    'Content-Type': TYPES[extname(ok.key)] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=300',
  };
  if (ok.name) headers['Content-Disposition'] = `attachment; filename="${ok.name.replace(/"/g, '')}"`;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
    if (start > end || start >= body.length) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${body.length}` } });
    return new NextResponse(new Uint8Array(body.subarray(start, end + 1)), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Content-Length': String(end - start + 1) } });
  }
  return new NextResponse(new Uint8Array(body), { headers: { ...headers, 'Content-Length': String(body.length) } });
}

export async function PUT(req: NextRequest) {
  const ok = check(req, 'PUT');
  if (!ok) return new NextResponse('Forbidden', { status: 403 });
  if (req.headers.get('content-type') !== ok.ct) return new NextResponse('Wrong content type', { status: 400 });
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > ok.max) return new NextResponse('Too large', { status: 413 });
  await storage().put(ok.key, body, ok.ct!);
  return new NextResponse(null, { status: 200 });
}
