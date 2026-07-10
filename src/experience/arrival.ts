/**
 * Pure arrival-choreography schedule. No GSAP, no three.js — unit tested.
 * Stage order: env → subject → text → themes → line.
 */

export interface ArrivalStage {
  key: 'env' | 'subject' | 'text' | 'themes' | 'line';
  /** seconds after the scene swap when this stage starts revealing */
  start: number;
  /** reveal duration in seconds */
  duration: number;
}

export function arrivalSchedule(
  stagger: number,
  stageDur: number,
  reducedMotion: boolean
): ArrivalStage[] {
  if (reducedMotion) {
    // Two simple opacity stages: world first, then all reading elements.
    return [
      { key: 'env', start: 0, duration: 0.45 },
      { key: 'subject', start: 0, duration: 0.45 },
      { key: 'text', start: 0.35, duration: 0.45 },
      { key: 'themes', start: 0.35, duration: 0.45 },
      { key: 'line', start: 0.35, duration: 0.45 },
    ];
  }
  const s = Math.max(0, stagger);
  const d = Math.max(0.05, stageDur);
  return [
    { key: 'env', start: 0, duration: d },
    { key: 'subject', start: s, duration: d },
    { key: 'text', start: s * 2, duration: d },
    { key: 'themes', start: s * 3, duration: d * 0.8 },
    { key: 'line', start: s * 4, duration: d * 0.8 },
  ];
}

/** Total arrival time in seconds (last stage end). */
export function arrivalTotal(stages: ArrivalStage[]): number {
  return stages.reduce((m, st) => Math.max(m, st.start + st.duration), 0);
}
