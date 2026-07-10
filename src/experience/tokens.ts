/**
 * Shared visual tokens — the single source of the project's visual grammar,
 * spanning both depths of the world (Line View and Year on Line).
 *
 * - Three.js reads these via direct import (see PALETTE in config.ts).
 * - The DOM reads them as CSS variables set on `.experience`
 *   (cssVariables(), applied in Experience.tsx). globals.css keeps static
 *   fallbacks for pre-hydration paint only.
 *
 * 3D *tuning* values (camera, fov, densities, spacing…) are NOT tokens;
 * they stay in config.ts / useTuning and are unchanged by this system.
 * Do not add raw colours/durations to components — add them here.
 */

export const COLOR = {
  /* background depths: space → atmosphere → paper (outside time → inside a year) */
  depthSpace: '#050608',
  depthAtmosphere: '#0b1420',
  depthPaper: '#f4efe4',

  /* foreground inks, dark world */
  ink: '#d8dee8',
  inkDim: '#8a94a6',

  /* foreground inks, light (paper) world */
  paperInk: '#33291c',
  paperBody: '#4a4234',
  paperDim: '#8a7f6a',

  /* temporal lights */
  gold: '#e8b84a' /* warm historical light — active year, The Line, focus */,
  coolLine: '#7fa8d9' /* cool temporal distance */,
  atmosphere: '#6fb7ff',
  warmAccent: '#a4552e' /* restrained period red (dates, emphasis on paper) */,
} as const;

/** Common alpha steps for borders/surfaces so opacity stays consistent. */
export const ALPHA = {
  hairline: 0.14,
  border: 0.28,
  dim: 0.55,
  surface: 0.85,
} as const;

/** Transition durations, seconds. GSAP descent timing stays in config.ts. */
export const DURATION = {
  fast: 0.25,
  base: 0.5,
  slow: 0.9,
  page: 1.2,
} as const;

/**
 * Typographic role scale. Georgia (serif) owns years/titles/theses; the
 * system sans owns body, metadata and controls (uppercase + letterspaced).
 */
export const TYPE = {
  yearHero: 'clamp(2.2rem, 5.6vh, 3.4rem)' /* active year on the Line */,
  yearTitle: 'clamp(4.6rem, 13vh, 7.2rem)' /* the year inside YoL */,
  title: 'clamp(1.7rem, 3.4vh, 2.35rem)' /* section/event titles */,
  thesis: '1.12rem',
  body: '1rem',
  meta: '0.7rem' /* uppercase metadata (kickers, dates, sub-labels) */,
  control: '0.76rem' /* buttons and interactive labels */,
  note: '0.68rem' /* annotations, sources, integrity notes */,
} as const;

/** Spacing scale (rem). */
export const SPACE = {
  xs: '0.3rem',
  s: '0.55rem',
  m: '1.1rem',
  l: '1.7rem',
  xl: '2.6rem',
} as const;

/**
 * CSS variables for the DOM overlay. Applied once on `.experience`;
 * everything the user can read lives beneath that element.
 */
export function cssVariables(): Record<string, string> {
  return {
    '--depth-space': COLOR.depthSpace,
    '--depth-atmosphere': COLOR.depthAtmosphere,
    '--depth-paper': COLOR.depthPaper,
    '--ink': COLOR.ink,
    '--ink-dim': COLOR.inkDim,
    '--paper-ink': COLOR.paperInk,
    '--paper-body': COLOR.paperBody,
    '--paper-dim': COLOR.paperDim,
    '--gold': COLOR.gold,
    '--gold-dim': `rgba(232, 184, 74, ${ALPHA.dim})`,
    '--gold-hairline': `rgba(232, 184, 74, ${ALPHA.hairline})`,
    '--cool-line': COLOR.coolLine,
    '--warm-accent': COLOR.warmAccent,
    '--t-fast': `${DURATION.fast}s`,
    '--t-base': `${DURATION.base}s`,
    '--t-slow': `${DURATION.slow}s`,
    '--t-page': `${DURATION.page}s`,
    '--fs-year-hero': TYPE.yearHero,
    '--fs-year-title': TYPE.yearTitle,
    '--fs-title': TYPE.title,
    '--fs-thesis': TYPE.thesis,
    '--fs-body': TYPE.body,
    '--fs-meta': TYPE.meta,
    '--fs-control': TYPE.control,
    '--fs-note': TYPE.note,
  };
}
