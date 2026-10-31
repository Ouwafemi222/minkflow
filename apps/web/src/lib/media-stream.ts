import { AppError } from '@minkflow/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { extname } from 'node:path';
import { storage } from '@/lib/services';

const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

export async function readStoredObject(key: string): Promise<Buffer> {
  try {
    return await storage().get(key);
  } catch {
    throw new AppError(
      'NOT_FOUND',
      storage().driver === 's3'
        ? 'This file is not in cloud storage. Render again after the worker uses the same bucket, or open Studio on the computer that rendered it.'
        : 'This file is not on this computer. Open Studio at http://localhost:3000 on the machine that rendered it, or connect R2 so the live site can play it.',
    );
  }
}

/** Serves a stored object from this process (local disk or a fetched S3 object) with Range support. */
export function streamStoredObject(
  req: NextRequest,
  body: Buffer,
  options: { mime?: string | null; filename?: string; inline?: boolean; key?: string },
): NextResponse {
  const mime = options.mime || TYPES[extname(options.key ?? '')] || 'application/octet-stream';
  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=60',
    'X-Content-Type-Options': 'nosniff',
  };
  if (options.filename) {
    const safe = options.filename.replace(/"/g, '');
    headers['Content-Disposition'] = `${options.inline ? 'inline' : 'attachment'}; filename="${safe}"`;
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
    if (start > end || start >= body.length) {
      return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${body.length}` } });
    }
    return new NextResponse(new Uint8Array(body.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new NextResponse(new Uint8Array(body), { headers: { ...headers, 'Content-Length': String(body.length) } });
}
