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

## Cycle 7 — the layered world stack (issue #16)

Kernel proof (`e2e/historical-chain.spec.ts`, protected — do not weaken):
the full Line → 1769 → Historical Field → Steam Engine → James Watt →
University of Glasgow → Scottish Enlightenment chain descends and restores
EXACTLY at every depth, then lands on the parent Line at 1769; no page
reload and no Canvas remount across the whole chain.

Historical Field (`e2e/historical-field.spec.ts`): enters at 1769 with a
dense collage (≥8 plates); travels earlier AND later with an anchored plate
never flashing out on year crossings; deterministic arrangement survives
leave + re-entry (same plate layout position); focus reveals metadata
without displacing the plate; a rapid double-click cannot push two worlds;
far non-interactive plates are removed from the tab order. Narrow (≈480px):
`field-prev`/`field-next` walk the timeline (disabled while locked), the
temporal collage is preserved (not a card list), no page horizontal
overflow; pointer/touch drag on the background moves through years.

Topic Worlds (`e2e/topic-worlds.spec.ts`): wheel and ←→ travel horizontally
through chapters; pointer drag moves a chapter and adjacent chapters peek;
inactive-chapter doorways are not tab-reachable while active ones are; each
doorway opens the correct next world; the transition lock prevents a
duplicate push; exact chapter position is restored on return; breadcrumb
depth jumps are safe (jump back to the field, then the Line at 1769).

Reduced motion (`e2e/reduced-motion-field.spec.ts`): the whole field →
topic → return chain still works and restores under `reducedMotion:'reduce'`
on the single kernel renderer.

Regressions kept green: 1969 enters its DB-backed YoL (`local-timeline`,
`reduced-motion`, `fallback`); synthetic content never renders
(`synthetic-exclusion`); the two prototype years enter DIFFERENT renderers.

Unit: `src/experience/field/layout.test.ts` adds density coverage across
the range (near-band ≥6 everywhere, ≥10 in the core, edges non-empty) and
kind/theme/depth/aspect spread; `world-stack.test.ts` unchanged.
