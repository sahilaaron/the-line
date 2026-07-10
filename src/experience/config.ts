import { COLOR } from './tokens';

/**
 * Central tuning configuration. Every visually meaningful constant lives here
 * and can be overridden live from the ?debug=1 panel (see overlay/DebugPanel).
 * Do not scatter magic numbers in scene components.
 */

export const TUNING_DEFAULTS = {
  /** timePos units per wheel deltaY pixel */
  scrollSensitivity: 0.0016,
  /** exponential rate at which the target eases to the nearest anchor */
  snapStrength: 4.0,
  /** idle ms before snapping engages */
  snapDelayMs: 220,
  /** Line height in Line View, % of viewport from top */
  lineVh: 75,
  /** Line height in Year-on-Line scene */
  yolLineVh: 91.7,
  earthScale: 1.45,
  /** Earth centre height, % of viewport from top */
  earthVh: 34,
  /** theme sphere orbit radius, world units (before earthScale) */
  orbitRadius: 1.55,
  /** descent/return duration, seconds */
  descentDuration: 3.4,
  /** scene fog density */
  fogDensity: 0.022,
  /** cloud layer opacity multiplier during transition */
  cloudDensity: 1.0,
  /** camera distance from the Line plane */
  cameraDistance: 11,
  /** base particle count before quality multiplier */
  particleBase: 1400,
  /** world units between anchors along the Line */
  anchorSpacing: 5.4,
  fov: 50,

  // --- cycle 2: descent staging + arrival choreography ---
  /** when destination signals start, as a fraction of the descent (0..1) */
  signalsLead: 0.38,
  /** seconds between arrival reveal stages (env→subject→text→themes→line) */
  arrivalStagger: 0.5,
  /** duration of each arrival reveal stage, seconds */
  arrivalStageDur: 1.0,
  /** scale multiplier on the dominant YoL subject (Moon etc.) */
  subjectScale: 1.0,
};

export type Tuning = typeof TUNING_DEFAULTS;
export type TuningKey = keyof Tuning;

export type QualityTier = 'high' | 'medium' | 'low';

export const QUALITY: Record<
  QualityTier,
  { particleMul: number; dprCap: number }
> = {
  high: { particleMul: 1, dprCap: 2 },
  medium: { particleMul: 0.6, dprCap: 1.5 },
  low: { particleMul: 0.3, dprCap: 1 },
};

/** Scene palette (Line View / YoL backgrounds and accents) — from tokens. */
export const PALETTE = {
  lineBg: COLOR.depthSpace,
  yolBg: COLOR.depthAtmosphere,
  gold: COLOR.gold,
  coolLine: COLOR.coolLine,
  atmosphere: COLOR.atmosphere,
};

/** Half-height of the visible world at the Line plane (z=0). */
export function viewHalfHeight(cameraDistance: number, fovDeg: number): number {
  return Math.tan((fovDeg * Math.PI) / 360) * cameraDistance;
}

/** World-space Y positions for the current tuning (Line View layout). */
export function vhLayout(t: Tuning): {
  lineY: number;
  earthY: number;
  yolLineY: number;
  halfH: number;
} {
  return {
    lineY: vhToWorldY(t.lineVh, t.cameraDistance, t.fov),
    earthY: vhToWorldY(t.earthVh, t.cameraDistance, t.fov),
    yolLineY: vhToWorldY(t.yolLineVh, t.cameraDistance, t.fov),
    halfH: viewHalfHeight(t.cameraDistance, t.fov),
  };
}

/**
 * Convert a viewport-height percentage (0 = top, 100 = bottom) to a world-space
 * Y at z=0, for a camera at y=0 looking down -Z. Resolution independent.
 */
export function vhToWorldY(
  vh: number,
  cameraDistance: number,
  fovDeg: number
): number {
  const h = viewHalfHeight(cameraDistance, fovDeg);
  return (1 - vh / 50) * h;
}
