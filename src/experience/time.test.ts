import { describe, expect, it } from 'vitest';
import {
  applyWheel,
  approach,
  clampTimePos,
  formatYear,
  nearestIndex,
  stepIndex,
  yearAt,
} from './time';

const MAX = 4;

describe('clampTimePos', () => {
  it('clamps below 0 and above max', () => {
    expect(clampTimePos(-1, MAX)).toBe(0);
    expect(clampTimePos(5.2, MAX)).toBe(4);
    expect(clampTimePos(2.3, MAX)).toBe(2.3);
  });
});

describe('nearestIndex', () => {
  it('resolves boundaries correctly', () => {
    expect(nearestIndex(2.49, MAX)).toBe(2);
    expect(nearestIndex(2.51, MAX)).toBe(3);
    expect(nearestIndex(-3, MAX)).toBe(0);
    expect(nearestIndex(9, MAX)).toBe(4);
  });
});

describe('applyWheel', () => {
  it('scrolling down travels backward in time', () => {
    expect(applyWheel(4, 100, 0.002, MAX)).toBeCloseTo(3.8);
  });
  it('scrolling up travels forward, capped at 2026 (index 4)', () => {
    expect(applyWheel(4, -500, 0.002, MAX)).toBe(4);
    expect(applyWheel(3.5, -100, 0.002, MAX)).toBeCloseTo(3.7);
  });
  it('cannot travel before the first anchor', () => {
    expect(applyWheel(0.1, 500, 0.002, MAX)).toBe(0);
  });
});

describe('stepIndex', () => {
  it('steps one anchor and clamps at ends', () => {
    expect(stepIndex(2, 1, MAX)).toBe(3);
    expect(stepIndex(2, -1, MAX)).toBe(1);
    expect(stepIndex(4, 1, MAX)).toBe(4);
    expect(stepIndex(0, -1, MAX)).toBe(0);
  });
});

describe('approach', () => {
  it('converges toward the target without overshooting', () => {
    let v = 0;
    for (let i = 0; i < 200; i++) v = approach(v, 3, 4, 1 / 60);
    expect(v).toBeGreaterThan(2.99);
    expect(v).toBeLessThanOrEqual(3);
  });
  it('is stable when already at the target', () => {
    expect(approach(2, 2, 5, 1 / 60)).toBe(2);
  });
  it('snap simulation converges to the nearest anchor', () => {
    let target = 2.7;
    for (let i = 0; i < 300; i++) {
      target = approach(target, Math.round(target), 4, 1 / 60);
    }
    expect(Math.abs(target - 3)).toBeLessThan(0.001);
  });
});

describe('yearAt / formatYear', () => {
  const years = [-9999, 1450, 1769, 1969, 2026];
  it('returns anchor years at integer positions', () => {
    expect(yearAt(0, years)).toBe(-9999);
    expect(yearAt(3, years)).toBe(1969);
    expect(yearAt(4, years)).toBe(2026);
  });
  it('interpolates piecewise between anchors', () => {
    expect(yearAt(3.5, years)).toBeCloseTo((1969 + 2026) / 2);
    expect(yearAt(0.5, years)).toBeCloseTo((-9999 + 1450) / 2);
  });
  it('formats BCE years', () => {
    expect(formatYear(-9999)).toBe('c. 10,000 BCE');
    expect(formatYear(1969)).toBe('1969');
  });
});
