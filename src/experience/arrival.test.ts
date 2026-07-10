import { describe, expect, it } from 'vitest';
import { arrivalSchedule, arrivalTotal } from './arrival';

describe('arrivalSchedule', () => {
  it('staggers the five stages in order', () => {
    const stages = arrivalSchedule(0.5, 1.0, false);
    expect(stages.map((s) => s.key)).toEqual([
      'env',
      'subject',
      'text',
      'themes',
      'line',
    ]);
    const starts = stages.map((s) => s.start);
    expect(starts).toEqual([0, 0.5, 1.0, 1.5, 2.0]);
    // strictly non-decreasing
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]).toBeGreaterThanOrEqual(starts[i - 1]);
    }
  });

  it('completes within a few seconds at defaults', () => {
    const stages = arrivalSchedule(0.5, 1.0, false);
    expect(arrivalTotal(stages)).toBeLessThanOrEqual(4);
  });

  it('clamps degenerate tuning values', () => {
    const stages = arrivalSchedule(-1, 0, false);
    stages.forEach((s) => {
      expect(s.start).toBeGreaterThanOrEqual(0);
      expect(s.duration).toBeGreaterThan(0);
    });
  });

  it('reduced motion collapses to two quick opacity stages', () => {
    const stages = arrivalSchedule(0.5, 1.0, true);
    const starts = new Set(stages.map((s) => s.start));
    expect(starts.size).toBeLessThanOrEqual(2);
    expect(arrivalTotal(stages)).toBeLessThan(1.2);
    // world reveals first or simultaneously, never after the text
    const env = stages.find((s) => s.key === 'env')!;
    const text = stages.find((s) => s.key === 'text')!;
    expect(env.start).toBeLessThanOrEqual(text.start);
  });
});
