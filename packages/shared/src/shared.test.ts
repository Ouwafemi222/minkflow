import { describe, expect, it } from 'vitest';
import { AppError, backoffDelay, redact, stableStringify, synthesizeToneNarration, toErrorEnvelope, withRetry } from './index';
import { hashObject } from './node';

describe('stable hashing', () => {
  it('is independent of key order and ignores undefined', () => {
    expect(stableStringify({ b: 1, a: [1, { y: 2, x: 1 }], c: undefined })).toBe('{"a":[1,{"x":1,"y":2}],"b":1}');
    expect(hashObject({ a: 1, b: 2 })).toBe(hashObject({ b: 2, a: 1 }));
    expect(hashObject({ a: 1 })).not.toBe(hashObject({ a: 2 }));
  });
});

describe('tone narration', () => {
  it('produces a valid WAV with monotonic word timings within duration', () => {
    const { wav, durationMs, words } = synthesizeToneNarration('Hello world, this is Minkflow.');
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe('RIFF');
    expect(words).toHaveLength(5);
    for (let i = 1; i < words.length; i++) expect(words[i]!.startMs).toBeGreaterThanOrEqual(words[i - 1]!.endMs);
    expect(words.at(-1)!.endMs).toBeLessThan(durationMs);
  });

  it('is deterministic', () => {
    expect(hashObject(Array.from(synthesizeToneNarration('Same text').wav))).toBe(
      hashObject(Array.from(synthesizeToneNarration('Same text').wav)),
    );
  });
});

describe('errors', () => {
  it('maps unknown errors to INTERNAL without leaking messages', () => {
    const { status, body } = toErrorEnvelope(new Error('db password wrong'), 'req_1');
    expect(status).toBe(500);
    expect(body).toEqual({ code: 'INTERNAL', message: 'Something went wrong on our side.', requestId: 'req_1', retryable: true });
  });
  it('keeps AppError codes', () => {
    expect(toErrorEnvelope(new AppError('INSUFFICIENT_CREDITS'), 'r').status).toBe(402);
  });
});

describe('retry', () => {
  it('backs off exponentially within bounds', () => {
    expect(backoffDelay(1, { baseMs: 100, maxMs: 1000, jitter: () => 1 })).toBe(100);
    expect(backoffDelay(3, { baseMs: 100, maxMs: 1000, jitter: () => 1 })).toBe(400);
    expect(backoffDelay(10, { baseMs: 100, maxMs: 1000, jitter: () => 0 })).toBe(500);
  });
  it('stops on non-retryable errors and respects max attempts', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => { calls++; throw new Error('x'); }, { baseMs: 1, maxMs: 1, maxAttempts: 3, shouldRetry: () => true, sleep: async () => {} }),
    ).rejects.toThrow('x');
    expect(calls).toBe(3);
    calls = 0;
    await expect(
      withRetry(async () => { calls++; throw new Error('y'); }, { baseMs: 1, maxMs: 1, maxAttempts: 3, shouldRetry: () => false, sleep: async () => {} }),
    ).rejects.toThrow('y');
    expect(calls).toBe(1);
  });
});

describe('redact', () => {
  it('removes secrets from log fields', () => {
    expect(redact({ apiKey: 'sk', nested: { authorization: 'Bearer x', ok: 1 } })).toEqual({
      apiKey: '[REDACTED]',
      nested: { authorization: '[REDACTED]', ok: 1 },
    });
  });
});
