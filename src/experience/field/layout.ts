/**
 * Deterministic temporal collage layout.
 *
 * Pure and seeded: the same items + config ALWAYS produce the same
 * arrangement (exact restoration depends on it), computed once per
 * dataset — never in the per-frame loop.
 *
 * Horizontal position is TEMPORAL: x derives from the item's historical
 * time relative to the field range. Vertical position is compositional:
 * items are sorted by editorial weight and greedily assigned to horizontal
 * lanes with per-lane interval collision tracking; a bounded x-nudge is
 * tried before an item falls to a deeper, quieter layer. Editorial
 * composition overrides (preferredLane / sizeClass / offsets / depth) win
 * whenever present, so a future CRM can art-direct individual records
 * without being required to.
 */
import type { HistoricalFieldItemVM } from '../../domain/worlds';

export interface FieldLayoutConfig {
  rangeStart: number;
  rangeEnd: number;
  /** vw of horizontal travel per year (same value the renderer scrolls by) */
  vwPerYear: number;
  /** deterministic seed — different fields get different (stable) texture */
  seed: string;
}

export interface FieldPlacement {
  id: string;
  slug: string;
  /** centre of the plate, in field vw (0 = rangeStart) */
  xVw: number;
  /** plate width in vw (height follows the media aspect ratio in CSS) */
  widthVw: number;
  /** top of the plate, vh from the top of the field area */
  yVh: number;
  lane: number;
  /** 0 = front layer, 1 = mid, 2 = deep (parallax + emphasis) */
  depth: number;
  zIndex: number;
  /** the item's representative year (drives per-frame emphasis) */
  midYear: number;
}

/* ------------------------------------------------------------------ */
/* Deterministic hashing (no Math.random anywhere)                     */
/* ------------------------------------------------------------------ */

/** FNV-1a 32-bit — stable across platforms. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic 0..1 from a seed string. */
export function unit(seedText: string): number {
  return hash32(seedText) / 0xffffffff;
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/** Vertical bands above the local Line (top offsets in vh). The field
 *  area runs ~6vh..72vh; the local Line owns the bottom. */
const LANES = [
  { yVh: 7, jitterVh: 3 },
  { yVh: 24, jitterVh: 4 },
  { yVh: 41, jitterVh: 4 },
  { yVh: 56, jitterVh: 3 },
] as const;

const SIZE_BASE_VW: Record<'small' | 'medium' | 'large', number> = {
  small: 8,
  medium: 12,
  large: 17,
};

/** minimum clear gap between plates sharing a lane, vw */
const LANE_GAP_VW = 2.2;
/** how far an item may be nudged off its true temporal x, vw */
const MAX_NUDGE_VW = 3.2;
/** horizontal jitter so same-year items don't stack on one axis, years */
const X_JITTER_YEARS = 0.35;

function sizeClassOf(item: HistoricalFieldItemVM): 'small' | 'medium' | 'large' {
  if (item.composition?.sizeClass) return item.composition.sizeClass;
  if (item.prominence >= 70) return 'large';
  if (item.prominence >= 45) return 'medium';
  return 'small';
}

function depthOf(item: HistoricalFieldItemVM): number {
  if (item.composition?.depth !== undefined) return Math.min(2, Math.max(0, item.composition.depth));
  if (item.prominence >= 60) return 0;
  if (item.prominence >= 40) return 1;
  return 2;
}

export function midYearOf(item: HistoricalFieldItemVM): number {
  return item.endYear !== undefined ? (item.startYear + item.endYear) / 2 : item.startYear;
}

interface Interval {
  lo: number;
  hi: number;
}

function overlaps(intervals: Interval[], lo: number, hi: number): boolean {
  return intervals.some((iv) => lo < iv.hi && hi > iv.lo);
}

/** Nearest position (bounded) that clears every interval in the lane, or
 *  null when no bounded nudge fits. */
function nudgedX(intervals: Interval[], x: number, halfW: number, maxNudge: number): number | null {
  if (!overlaps(intervals, x - halfW, x + halfW)) return x;
  // candidate positions: flush against each blocking interval's edges
  const candidates: number[] = [];
  for (const iv of intervals) {
    candidates.push(iv.lo - halfW - LANE_GAP_VW / 2, iv.hi + halfW + LANE_GAP_VW / 2);
  }
  let best: number | null = null;
  for (const c of candidates) {
    if (Math.abs(c - x) > maxNudge) continue;
    if (overlaps(intervals, c - halfW, c + halfW)) continue;
    if (best === null || Math.abs(c - x) < Math.abs(best - x)) best = c;
  }
  return best;
}

/**
 * Compute the full arrangement. Deterministic: iteration order is a
 * stable sort (prominence desc, then midYear, then id), all pseudo-random
 * values come from seeded hashes of `${config.seed}:${item.id}`.
 */
export function computeFieldLayout(
  items: HistoricalFieldItemVM[],
  config: FieldLayoutConfig
): FieldPlacement[] {
  const ordered = [...items].sort((a, b) => {
    if (b.prominence !== a.prominence) return b.prominence - a.prominence;
    const ya = midYearOf(a);
    const yb = midYearOf(b);
    if (ya !== yb) return ya - yb;
    return a.id < b.id ? -1 : 1;
  });

  // lane occupancy tracked separately per depth layer: deep layers sit
  // behind and may safely share x-space with the front without colliding
  const occupancy = new Map<string, Interval[]>();
  const laneOf = (depth: number, lane: number) => `${depth}:${lane}`;

  const placements: FieldPlacement[] = [];

  for (const item of ordered) {
    const seed = `${config.seed}:${item.id}`;
    const size = sizeClassOf(item);
    let depth = depthOf(item);
    const widthVw = SIZE_BASE_VW[size] * (0.9 + unit(`${seed}:w`) * 0.25);
    const halfW = widthVw / 2 + LANE_GAP_VW / 2;

    const jitterYears = (unit(`${seed}:xj`) * 2 - 1) * X_JITTER_YEARS;
    const trueX =
      (midYearOf(item) - config.rangeStart + jitterYears) * config.vwPerYear +
      (item.composition?.offsetX ?? 0);

    // lane preference: editorial override, else seeded
    const preferred =
      item.composition?.preferredLane !== undefined
        ? Math.min(LANES.length - 1, Math.max(0, item.composition.preferredLane))
        : Math.floor(unit(`${seed}:lane`) * LANES.length);

    // try lanes in ring order from the preference; bounded nudge within
    // each; drop one depth layer (fresh occupancy space) before giving up
    let placed: { lane: number; x: number } | null = null;
    for (let attempt = 0; attempt < 2 && !placed; attempt++) {
      for (let ring = 0; ring < LANES.length && !placed; ring++) {
        const lane = (preferred + ring) % LANES.length;
        const key = laneOf(depth, lane);
        const intervals = occupancy.get(key) ?? [];
        const x = nudgedX(intervals, trueX, halfW, MAX_NUDGE_VW);
        if (x !== null) placed = { lane, x };
      }
      if (!placed && depth < 2) depth += 1;
      else break;
    }
    // last resort: keep temporal truth, deepest layer, accept overlap
    const lane = placed?.lane ?? preferred;
    const x = placed?.x ?? trueX;
    if (!placed) depth = 2;

    const key = laneOf(depth, lane);
    const intervals = occupancy.get(key) ?? [];
    intervals.push({ lo: x - halfW, hi: x + halfW });
    occupancy.set(key, intervals);

    const laneDef = LANES[lane];
    const yVh =
      laneDef.yVh +
      (unit(`${seed}:yj`) * 2 - 1) * laneDef.jitterVh +
      (item.composition?.offsetY ?? 0);

    placements.push({
      id: item.id,
      slug: item.slug,
      xVw: x,
      widthVw,
      yVh,
      lane,
      depth,
      zIndex: 100 + Math.round(item.prominence) - depth * 40,
      midYear: midYearOf(item),
    });
  }

  return placements;
}

/* ------------------------------------------------------------------ */
/* Visible window                                                      */
/* ------------------------------------------------------------------ */

/**
 * Which placements should be MOUNTED for a given time. Called on discrete
 * year changes (not per frame); the architecture holds for hundreds of
 * records because everything outside radius + overscan stays unmounted.
 */
export function visiblePlacements(
  placements: FieldPlacement[],
  time: number,
  radiusYears: number,
  overscanYears: number
): FieldPlacement[] {
  const reach = radiusYears + overscanYears;
  return placements.filter((p) => Math.abs(p.midYear - time) <= reach);
}

/** Per-frame emphasis for one placement (pure; the renderer applies it). */
export function emphasisAt(
  temporalDistanceYears: number,
  cfg: { activeRadius: number; opacityFalloff: number; scaleFalloff: number }
): { opacity: number; scale: number; interactive: boolean } {
  const d = Math.abs(temporalDistanceYears);
  const beyond = Math.max(0, d - cfg.activeRadius);
  return {
    opacity: Math.max(0.14, 1 - beyond * cfg.opacityFalloff),
    scale: Math.max(0.82, 1 - beyond * cfg.scaleFalloff),
    interactive: d <= cfg.activeRadius,
  };
}
