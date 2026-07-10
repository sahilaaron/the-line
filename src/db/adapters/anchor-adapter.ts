/**
 * Documented future boundary — NOT wired into the live app.
 *
 * The 3D experience (src/experience/**, app/**) currently reads its 5
 * anchors directly from the static array in src/data/anchors.ts, and that
 * must keep working exactly as-is for this cycle. This module exists only
 * to demonstrate, with real types, how an `Anchor` (src/data/types.ts)
 * *could* eventually be composed from the DB layer once a future cycle
 * decides to wire it up — it is a pure mapping function with no side
 * effects and no runtime dependency from src/experience or app/** on it.
 *
 * To actually connect this in a future cycle: replace the static
 * `ANCHORS` import in wherever src/experience consumes it with a call to
 * `loadAnchorsFromDb()` (to be written then), which would run
 * `toAnchor()` over the 5 curated-anchor periods.
 */
import type { Anchor } from '../../data/types';
import type { DomainAnchorSource } from '../../domain/timeline';

/** Pure mapping: DomainAnchorSource (composed from DB rows) -> Anchor. */
export function toAnchor(source: DomainAnchorSource): Anchor {
  return {
    id: source.anchorSlug,
    year: source.year,
    label: source.label,
    subtitle: source.subtitle,
    themes: source.themes.map((t) => t.theme),
    era: source.era,
    placeholder: true,
  };
}
