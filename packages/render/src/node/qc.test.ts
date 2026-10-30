import { describe, expect, it } from 'vitest';
import { audioLevels, findBlankRuns, parseIntervals } from './qc';

describe('QC analyzers', () => {
  it('parses silencedetect intervals', () => {
    const stderr = '[silencedetect @ 0x1] silence_start: 1.5\n[silencedetect @ 0x1] silence_end: 5.25 | silence_duration: 3.75\n';
    expect(parseIntervals(stderr, 'silence_start', 'silence_end')).toEqual([{ start: 1.5, end: 5.25 }]);
  });

  it('finds runs of uniform frames longer than the threshold only', () => {
    const size = 4;
    const content = [0, 255, 0, 255];
    const flat = [11, 11, 11, 11];
    const frames = [content, flat, flat, flat, flat, content, flat, content].flat();
    const runs = findBlankRuns(new Uint8Array(frames), size, 4, 0.75);
    expect(runs).toEqual([{ start: 0.25, end: 1.25 }]);
  });

  it('flags a trailing blank run', () => {
    const runs = findBlankRuns(new Uint8Array([0, 255, 5, 5, 5, 5, 5, 5, 5, 5]), 2, 4, 0.75);
    expect(runs).toEqual([{ start: 0.25, end: 1.25 }]);
  });

  it('measures audio levels and clipping', () => {
    expect(audioLevels(new Int16Array([0, 0, 0])).rmsDbfs).toBe(-120);
    const loud = audioLevels(new Int16Array([32767, -32768, 32767]));
    expect(loud.clippedSamples).toBe(3);
    expect(loud.peakDbfs).toBeCloseTo(0, 0);
  });
});
