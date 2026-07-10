/**
 * Pure time/scroll math. No three.js, no React — unit tested in time.test.ts.
 */

/** Clamp a continuous timeline position to [0, maxIndex]. */
export function clampTimePos(t: number, maxIndex: number): number {
  return Math.min(maxIndex, Math.max(0, t));
}

/** Index of the nearest anchor for a continuous position. */
export function nearestIndex(t: number, maxIndex: number): number {
  return Math.round(clampTimePos(t, maxIndex));
}

/** Step one anchor left/right, clamped at the ends. */
export function stepIndex(i: number, dir: -1 | 1, maxIndex: number): number {
  return Math.min(maxIndex, Math.max(0, Math.round(i) + dir));
}

/**
 * Frame-rate independent exponential approach of `current` toward `target`.
 * `rate` is 1/s; dt in seconds. Never overshoots.
 */
export function approach(
  current: number,
  target: number,
  rate: number,
  dt: number
): number {
  const k = 1 - Math.exp(-rate * Math.max(0, dt));
  return current + (target - current) * k;
}

/**
 * Apply a wheel delta to the target position.
 * Positive deltaY (scrolling down) travels BACKWARD in time (t decreases).
 */
export function applyWheel(
  target: number,
  deltaY: number,
  sensitivity: number,
  maxIndex: number
): number {
  return clampTimePos(target - deltaY * sensitivity, maxIndex);
}

/** Piecewise-linear interpolated year for a continuous position. */
export function yearAt(t: number, years: number[]): number {
  const maxIndex = years.length - 1;
  const c = clampTimePos(t, maxIndex);
  const i = Math.min(Math.floor(c), maxIndex - 1);
  const f = c - i;
  return years[i] + (years[i + 1] - years[i]) * f;
}

/** Display formatting: astronomical year -9999 renders as "c. 10,000 BCE". */
export function formatYear(y: number): string {
  const r = Math.round(y);
  if (r <= 0) {
    return `c. ${(1 - r).toLocaleString('en-US')} BCE`;
  }
  return String(r);
}
