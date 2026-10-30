import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertSafeKey, createLocalStorage, sniffImageMime, storageKeys, verifyLocalSignature } from './index';

describe('local storage', () => {
  const root = mkdtempSync(join(tmpdir(), 'mf-storage-'));
  const storage = createLocalStorage({ root, baseUrl: 'http://localhost:3000', secret: 's3cret' });

  it('round-trips objects and signs URLs that expire', async () => {
    const key = storageKeys.preview('w1', 'p1', 'r1', 'j1');
    await storage.put(key, new Uint8Array([1, 2, 3]), 'video/mp4');
    expect([...(await storage.get(key))]).toEqual([1, 2, 3]);
    expect(await storage.head(key)).toEqual({ size: 3 });
    const url = new URL(await storage.signedGetUrl(key, { ttlSeconds: 60 }));
    const expires = Number(url.searchParams.get('expires'));
    expect(verifyLocalSignature('s3cret', 'GET', key, expires, url.searchParams.get('sig')!)).toBe(true);
    expect(verifyLocalSignature('s3cret', 'GET', `${key}x`, expires, url.searchParams.get('sig')!)).toBe(false);
    expect(verifyLocalSignature('wrong', 'GET', key, expires, url.searchParams.get('sig')!)).toBe(false);
    expect(verifyLocalSignature('s3cret', 'GET', key, Math.floor(Date.now() / 1000) - 1, url.searchParams.get('sig')!)).toBe(false);
    await storage.delete(key);
    expect(await storage.head(key)).toBeNull();
  });

  it('rejects path traversal and unsafe keys', async () => {
    expect(() => assertSafeKey('../etc/passwd')).toThrow();
    expect(() => assertSafeKey('ws/a/../../b')).toThrow();
    expect(() => assertSafeKey('WS/Upper')).toThrow();
    await expect(storage.put('ws/../../x', new Uint8Array(), 'x')).rejects.toThrow();
  });
});

describe('MIME sniffing', () => {
  it('identifies images by magic bytes and rejects SVG/HTML', () => {
    expect(sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageMime(new TextEncoder().encode('<svg onload="alert(1)"></svg>'))).toBeNull();
    expect(sniffImageMime(new TextEncoder().encode('<html>'))).toBeNull();
  });
});
