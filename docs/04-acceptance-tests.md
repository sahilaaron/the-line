# 04 — Acceptance Tests (Cycle 1)

## Automated — Vitest (`src/experience/*.test.ts`)

- timePos clamps to [0, 4]; wheel-up at 2026 does not exceed 4.
- Nearest-anchor resolution correct at boundaries (e.g. 2.49 → index 2, 2.51 → index 3).
- Snap converges to the nearest anchor and never overshoots the range.
- Arrow-key stepping moves exactly one anchor and clamps at ends.
- Store: `requestDescent` only fires from `mode:'line'` when unlocked and only for anchors with a year world (`hasYol`); repeated calls while locked are no-ops; `requestReturn` restores `mode:'line'` at the origin anchor.

## Automated — Playwright

> **Rebuilt in Cycle 6 (issue #14)** for the local-timeline world and the
> database source. The suite (`e2e/*.spec.ts`) runs against a migrated +
> seeded PGlite database (see `playwright.config.ts` / CI `PGLITE_DATA_DIR`).

Parent Line (`parent-line.spec.ts`): 2026 caps travel; arrow keys step
anchors; descent only where a year world exists (notice otherwise); rapid
double-click cannot double-fire; `?debug=1` panel + metrics.

Local timeline (`local-timeline.spec.ts`), for BOTH 1769 and 1969: enter from
the parent Line → `[data-testid=yol-page][data-source=database]`; initial
active point is the year's overview; move earlier (wheel down) and later
(ArrowRight); focus a theme lens (non-matching stations get `.dim`, matching
stay lit); return lands on the SAME year.

Also: `fallback.spec.ts` (unavailable DB → `data-source=fallback`, loop still
works, no leaked internals), `narrow.spec.ts` (480px prev/next), 
`reduced-motion.spec.ts`, and `synthetic-exclusion.spec.ts` (no `SYNTHETIC`/
`synth-` text ever renders).

## Manual browser checks

- Lens stays fixed; line moves beneath it; all five anchors reachable both directions.
- Earth theme spheres change per anchor; upper field mood changes per era.
- Descent hides the scene swap (no visible pop) at default settings.
- Rapid wheel + click spam during descent does nothing; resize mid-transition doesn't break layout.
- `?debug=1` shows panel + live metrics; sliders take effect immediately.
- 60fps-ish on a mid desktop GPU at `medium`; no runaway draw calls (< ~150).

Record failures honestly in `implementation-notes.md`.
