import { createHash } from 'node:crypto';
import { stableStringify } from './hash';

export function sha256(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hashObject(value: unknown): string {
  return sha256(stableStringify(value));
}
