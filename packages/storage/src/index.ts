import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';

export interface ObjectStorage {
  readonly driver: 'local' | 's3';
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  head(key: string): Promise<{ size: number } | null>;
  delete(key: string): Promise<void>;
  signedGetUrl(key: string, options?: { ttlSeconds?: number; downloadName?: string }): Promise<string>;
  signedPutUrl(key: string, contentType: string, options?: { ttlSeconds?: number; maxBytes?: number }): Promise<string>;
}

const KEY_RE = /^[a-z0-9][a-z0-9/_.-]{2,400}$/;

export function assertSafeKey(key: string): void {
  if (!KEY_RE.test(key) || key.includes('..') || key.includes('//')) throw new Error(`Unsafe storage key: ${key}`);
}

/** Immutable artifact paths: ws/<workspace>/p/<project>/r/<revision>/j/<job>/<name>. */
export const storageKeys = {
  /** Narration is cached per workspace (reused across projects), keyed by a hash of voice + model + text. */
  narration: (ws: string, cacheHash: string, ext: 'mp3' | 'wav') => `ws/${ws}/narration/${cacheHash}.${ext}`,
  render: (ws: string, project: string, revision: string, job: string) => `ws/${ws}/p/${project}/r/${revision}/j/${job}/final.mp4`,
  preview: (ws: string, project: string, revision: string, job: string) => `ws/${ws}/p/${project}/r/${revision}/j/${job}/preview.mp4`,
  upload: (ws: string, id: string, ext: string) => `ws/${ws}/uploads/${id}.${ext}`,
};

// ---------- Local driver (development) ----------
export interface LocalStorageOptions {
  root: string;
  baseUrl: string;
  secret: string;
}

export function signLocal(secret: string, method: 'GET' | 'PUT', key: string, expires: number, extra = ''): string {
  return createHmac('sha256', secret).update(`${method}\n${key}\n${expires}\n${extra}`).digest('base64url');
}

export function verifyLocalSignature(secret: string, method: 'GET' | 'PUT', key: string, expires: number, signature: string, extra = ''): boolean {
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;
  const expected = Buffer.from(signLocal(secret, method, key, expires, extra));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function createLocalStorage({ root, baseUrl, secret }: LocalStorageOptions): ObjectStorage {
  const base = normalize(root);
  const pathFor = (key: string) => {
    assertSafeKey(key);
    const full = normalize(join(base, key));
    if (!full.startsWith(base + sep)) throw new Error('Path traversal');
    return full;
  };
  const url = (method: 'GET' | 'PUT', key: string, ttl: number, extra: Record<string, string>) => {
    const expires = Math.floor(Date.now() / 1000) + ttl;
    const extraStr = Object.entries(extra).map(([k, v]) => `${k}=${v}`).join('&');
    const params = new URLSearchParams({ key, expires: String(expires), sig: signLocal(secret, method, key, expires, extraStr), ...extra });
    return `${baseUrl.replace(/\/$/, '')}/api/storage/local?${params.toString()}`;
  };
  return {
    driver: 'local',
    async put(key, body) {
      const file = pathFor(key);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    get: (key) => readFile(pathFor(key)),
    async head(key) {
      try {
        return { size: (await stat(pathFor(key))).size };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(pathFor(key), { force: true });
    },
    signedGetUrl: async (key, options) =>
      url('GET', key, options?.ttlSeconds ?? 900, options?.downloadName ? { name: options.downloadName } : {}),
    signedPutUrl: async (key, contentType, options) =>
      url('PUT', key, options?.ttlSeconds ?? 900, { ct: contentType, max: String(options?.maxBytes ?? 10_000_000) }),
  };
}

// ---------- S3 / Cloudflare R2 driver ----------
export interface S3StorageOptions {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function createS3Storage(o: S3StorageOptions): ObjectStorage {
  const client = new S3Client({
    endpoint: o.endpoint,
    region: o.region,
    credentials: { accessKeyId: o.accessKeyId, secretAccessKey: o.secretAccessKey },
    forcePathStyle: true,
  });
  return {
    driver: 's3',
    async put(key, body, contentType) {
      assertSafeKey(key);
      await client.send(new PutObjectCommand({ Bucket: o.bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async get(key) {
      assertSafeKey(key);
      const result = await client.send(new GetObjectCommand({ Bucket: o.bucket, Key: key }));
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) throw new Error(`Empty object ${key}`);
      return Buffer.from(bytes);
    },
    async head(key) {
      assertSafeKey(key);
      try {
        const result = await client.send(new HeadObjectCommand({ Bucket: o.bucket, Key: key }));
        return { size: result.ContentLength ?? 0 };
      } catch {
        return null;
      }
    },
    async delete(key) {
      assertSafeKey(key);
      await client.send(new DeleteObjectCommand({ Bucket: o.bucket, Key: key }));
    },
    async signedGetUrl(key, options) {
      assertSafeKey(key);
      const command = new GetObjectCommand({
        Bucket: o.bucket,
        Key: key,
        ...(options?.downloadName ? { ResponseContentDisposition: `attachment; filename="${options.downloadName.replace(/[^\w.-]/g, '_')}"` } : {}),
      });
      return getSignedUrl(client, command, { expiresIn: options?.ttlSeconds ?? 900 });
    },
    async signedPutUrl(key, contentType, options) {
      assertSafeKey(key);
      return getSignedUrl(client, new PutObjectCommand({ Bucket: o.bucket, Key: key, ContentType: contentType }), { expiresIn: options?.ttlSeconds ?? 900 });
    },
  };
}

export interface StorageEnv {
  STORAGE_DRIVER: 'local' | 's3';
  LOCAL_STORAGE_ROOT: string;
  LOCAL_STORAGE_SECRET: string;
  APP_BASE_URL: string;
  S3_ENDPOINT?: string | undefined;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY_ID?: string | undefined;
  S3_SECRET_ACCESS_KEY?: string | undefined;
}

export function createStorageFromEnv(env: StorageEnv): ObjectStorage {
  if (env.STORAGE_DRIVER === 's3') {
    if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) throw new Error('S3 storage requires S3_ENDPOINT and credentials');
    return createS3Storage({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, bucket: env.S3_BUCKET, accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY });
  }
  return createLocalStorage({ root: env.LOCAL_STORAGE_ROOT, baseUrl: env.APP_BASE_URL, secret: env.LOCAL_STORAGE_SECRET });
}

/** Detects real file type from magic bytes; never trust client-declared MIME. */
export function sniffImageMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}
