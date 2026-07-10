# GOAL — Build Cycle 6: Database-backed YoL local timeline world (ACTIVE)

(Cycle 5b — the multi-year Year Visual Identity proof — is complete and
merged via PR #10; its outcome is recorded in
`docs/implementation-notes.md`. This document describes the ACTIVE cycle,
tracked as issue #14 on branch `issue-14/database-backed-yol-timeline`.)

## Mission

Rebuild the Year on Line as the intended NESTED, SCROLL-DRIVEN LOCAL
TIMELINE WORLD, and connect it to the existing PGlite/Drizzle database
through a clean server-side read model — leaving a clear, tested database
destination for the historical research staging pipeline (#5) that follows.

## Outcome shape

- Entering a year feels like descending into a smaller timeline contained
  inside the parent Line: local Line near 91.7vh, a fixed local temporal
  marker, the chronology moving beneath it, and the field above changing
  with the active point. Wheel down = earlier; ←/→ step points; the
  direction grammar matches the parent Line.
- Both 1769 and 1969 render their local chronology from the database via
  `GET /api/yol/[anchorSlug]` (`src/db/queries/yol-read-model.ts`); the
  TypeScript registry (`src/data/yol/`) survives only as the isolated
  fallback for empty/unavailable databases.
- Schema extension (migration `drizzle/0001_*`): `yol_timeline_points` +
  `yol_point_themes`, sub-year integer date parts on `periods` (BCE-safe,
  no JS `Date`), `entity_theme_details.lens_key` and
  `yol_themes.display_label` bridges. Historical truth, YoL curation and
  visual identity remain separate concerns.
- Idempotent seed loads the current provisional 1769/1969 content as
  draft/placeholder chronology (no invented sources); synthetic records
  are excluded at the query boundary; DB failures never leak internals.

## Status (hand-off state — see issue #14 for the full criteria)

Done: schema + migration, repositories/validation/import-export/audit
coverage, chronology seed + tests, read model + API route + client
accessor (cache/dedupe/retry/prefetch) + unified view model + tests, the
YolPage local-timeline rebuild with tunables in `?debug=1`, unit + db
suites green, production build green, both years verified DB-backed in a
real browser.

Remaining: e2e suite rewrite (the old specs assume the stacked page and
wheel-ignored-in-YoL), CI seeded-database e2e path, remaining doc
corrections, evidence capture, PR. Tracked in issue #14.
