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
 * Theme lens focus. DOM handlers write targets (0/1); a per-frame lerp in
 * YolScene moves `current` toward them; shaders read `current`.
 */
export const themeFocus = {
  target: { spaceflight: 0, computing: 0, signal: 0, coldwar: 0 },
  current: { spaceflight: 0, computing: 0, signal: 0, coldwar: 0 },
};

export type ThemeFocusKey = keyof typeof themeFocus.target;

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
  (Object.keys(themeFocus.target) as ThemeFocusKey[]).forEach((k) => {
    themeFocus.target[k] = 0;
    themeFocus.current[k] = 0;
  });
}

/** Reset helper for tests. */
export function resetRuntime(): void {
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
