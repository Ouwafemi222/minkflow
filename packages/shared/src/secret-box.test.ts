import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './node';

const key = randomBytes(32).toString('base64');

describe('secret box', () => {
  it('round-trips and never repeats ciphertext for the same input', () => {
    const a = encryptSecret('1//refresh-token', key);
    const b = encryptSecret('1//refresh-token', key);
    expect(a).not.toBe(b);
    expect(a).not.toContain('refresh-token');
    expect(decryptSecret(a, key)).toBe('1//refresh-token');
  });

  it('rejects tampering, the wrong key and malformed keys', () => {
    const box = encryptSecret('secret', key);
    const parts = box.split('.');
    const flipped = [...parts.slice(0, 3), Buffer.from('xxxxxx').toString('base64url')].join('.');
    expect(() => decryptSecret(flipped, key)).toThrow();
    expect(() => decryptSecret(box, randomBytes(32).toString('base64'))).toThrow();
    expect(() => encryptSecret('x', 'too-short')).toThrow(/32 bytes/);
  });
});
