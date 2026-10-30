import type { JobRow } from '@minkflow/db';
import { createLogger } from '@minkflow/shared';
import { describe, expect, it } from 'vitest';
import { Lane } from './lanes';

describe('Lane', () => {
  it('never runs more than `max` jobs at once and keeps claiming until the queue is empty', async () => {
    let queued = 7;
    let running = 0;
    let peak = 0;
    let done = 0;
    const lane = new Lane('render', ['render'], 2, {
      logger: createLogger({}, 'error'),
      claim: async () => (queued-- > 0 ? ({ id: String(queued) } as JobRow) : null),
      run: async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 10));
        running--;
        done++;
        return 'completed';
      },
    });
    await lane.fill();
    await new Promise((r) => setTimeout(r, 200));
    expect(done).toBe(7);
    expect(peak).toBe(2);
  });

  it('drain stops claiming and reports whether running jobs finished in time', async () => {
    const lane = new Lane('ai', ['script'], 1, {
      logger: createLogger({}, 'error'),
      claim: async () => ({ id: 'x' }) as JobRow,
      run: () => new Promise((r) => setTimeout(() => r('completed'), 500)),
    });
    await lane.fill();
    expect(await lane.drain(50)).toBe(false);
  });
});
