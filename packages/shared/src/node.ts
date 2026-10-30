import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { stableStringify } from './hash';

const SECRET_BOX_VERSION = 'v1';

function secretKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return key;
}

/** AES-256-GCM: `v1.<iv>.<tag>.<ciphertext>` (base64url). Used for OAuth refresh tokens at rest. */
export function encryptSecret(plaintext: string, keyBase64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(keyBase64), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [SECRET_BOX_VERSION, iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

export function decryptSecret(box: string, keyBase64: string): string {
  const [version, iv, tag, data] = box.split('.');
  if (version !== SECRET_BOX_VERSION || !iv || !tag || data === undefined) throw new Error('Unrecognized secret format');
  const decipher = createDecipheriv('aes-256-gcm', secretKey(keyBase64), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

export function sha256(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hashObject(value: unknown): string {
  return sha256(stableStringify(value));
}
