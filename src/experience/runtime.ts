/**
 * Per-frame mutable state that deliberately lives OUTSIDE React state.
 * Scenes read these in useFrame; DOM handlers and GSAP write them. Discrete
 * state (mode, active anchor, locks) lives in the Zustand store instead.
 */

import { INDEX_2026 } from '@/src/data/anchors';

/** Continuous scroll position along the Line, in anchor-index units. */
export const timeState = {
  pos: INDEX_2026,
  target: INDEX_2026,
  /** performance.now() of the last user scroll/key input */
  lastInputMs: -1e9,
  /** true once the user has scrolled at least once (dismisses the hint) */
  hasScrolled: false,
};

/**
 * Continuous position along the YoL LOCAL timeline, in point-index units.
 * Mirrors timeState: DOM handlers write target, the YolPage rAF eases pos
 * toward it with the same snap discipline as the parent Line.
 */
export const localTimeState = {
  pos: 0,
  target: 0,
  /** performance.now() of the last local scroll/key input */
  lastInputMs: -1e9,
  /** number of points on the active local timeline (0 = uninitialised) */
  count: 0,
};

/** Install a year's local timeline (called when a YoL view model mounts). */
export function setLocalTimeline(count: number, initialIndex: number): void {
  localTimeState.count = count;
  localTimeState.pos = initialIndex;
  localTimeState.target = initialIndex;
  localTimeState.lastInputMs = -1e9;
}

/** Descent/return transition state, animated by GSAP in DescentController. */
export const descentState = {
  /** 0 = Line View world, 1 = YoL world (scene swap happens at 0.5) */
  blend: 0,
  /** cloud layer opacity 0..1 */
  cloud: 0,
  /** destination signals inside the cloud passage, 0..1 */
  signals: 0,
  /** theme orbs flying past the camera during departure, 0..1 */
  orbFly: 0,
};

/**
 * Destination-year atmosphere for the shared transition: the sky the camera
 * hands over to and the light the clouds warm toward. Set from the
 * destination year's visual identity when a descent starts, so the same
 * descent choreography carries year-specific cues. Defaults match 1969.
 */
export const destinationStyle = {
  sky: '#0d1522',
  cloudLo: '#6b5e4d',
  cloudHi: '#f7ebcc',
};

export function setDestinationStyle(s: {
  sky: string;
  cloudLo: string;
  cloudHi: string;
}): void {
  destinationStyle.sky = s.sky;
  destinationStyle.cloudLo = s.cloudLo;
  destinationStyle.cloudHi = s.cloudHi;
}

/**
 * Staged arrival reveal of the YoL tableau, animated by GSAP after the swap.
 * 3D layers and DOM overlay both read these each frame.
 */
export const yolReveal = {
  env: 0,
  subject: 0,
  text: 0,
  themes: 0,
  line: 0,
};

/**
 * Theme lens focus. Keys are the ACTIVE YEAR's lens keys (normalised anchor
 * theme ids), installed by the YoL page via setThemeLenses — never a fixed
 * set. DOM handlers write targets (0/1); per-frame lerps move `current`
 * toward them; readers use `current`.
 */
export const themeFocus = {
  target: {} as Record<string, number>,
  current: {} as Record<string, number>,
};

export type ThemeFocusKey = string;

/** Install the lens key set for the year being viewed (resets focus). */
export function setThemeLenses(keys: string[]): void {
  const target: Record<string, number> = {};
  const current: Record<string, number> = {};
  for (const k of keys) {
    target[k] = 0;
    current[k] = 0;
  }
  themeFocus.target = target;
  themeFocus.current = current;
}

/** Default lens set (1969) so legacy scenes/tests have stable keys before
 *  a YoL page installs the active year's lenses. */
setThemeLenses(['spaceflight', 'computing', 'signal', 'coldwar']);

/** prefers-reduced-motion, kept fresh by a matchMedia listener (Experience). */
export const motionPref = { reduced: false };

/** Live render metrics, written inside the Canvas, read by the debug panel. */
export const metricsState = {
  fps: 0,
  drawCalls: 0,
  triangles: 0,
  dpr: 1,
};

export function resetYolReveal(): void {
  yolReveal.env = 0;
  yolReveal.subject = 0;
  yolReveal.text = 0;
  yolReveal.themes = 0;
  yolReveal.line = 0;
}

export function resetThemeFocus(): void {
  for (const k of Object.keys(themeFocus.target)) {
    themeFocus.target[k] = 0;
    themeFocus.current[k] = 0;
  }
}

/** Reset helper for tests. */
export function resetRuntime(): void {
  localTimeState.pos = 0;
  localTimeState.target = 0;
  localTimeState.lastInputMs = -1e9;
  localTimeState.count = 0;
  timeState.pos = INDEX_2026;
  timeState.target = INDEX_2026;
  timeState.lastInputMs = -1e9;
  timeState.hasScrolled = false;
  descentState.blend = 0;
  descentState.cloud = 0;
  descentState.signals = 0;
  descentState.orbFly = 0;
  resetYolReveal();
  resetThemeFocus();
}
