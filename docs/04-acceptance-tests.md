# 04 — Acceptance Tests (Cycle 1)

## Automated — Vitest (`src/experience/*.test.ts`)

- timePos clamps to [0, 4]; wheel-up at 2026 does not exceed 4.
- Nearest-anchor resolution correct at boundaries (e.g. 2.49 → index 2, 2.51 → index 3).
- Snap converges to the nearest anchor and never overshoots the range.
- Arrow-key stepping moves exactly one anchor and clamps at ends.
- Store: `beginDescent` only fires from `mode:'line'` when unlocked; repeated calls while locked are no-ops; `beginReturn` restores `mode:'line'` with timePos at the 1969 anchor.

## Automated — Playwright (if environment allows)

Core loop: load → year label reads 2026 → wheel down until 1969 active → click Earth → YoL heading "1969" visible → click return → Line View again with 1969 active. Double-click Earth rapidly → still exactly one descent.

## Manual browser checks

- Lens stays fixed; line moves beneath it; all five anchors reachable both directions.
- Earth theme spheres change per anchor; upper field mood changes per era.
- Descent hides the scene swap (no visible pop) at default settings.
- Rapid wheel + click spam during descent does nothing; resize mid-transition doesn't break layout.
- `?debug=1` shows panel + live metrics; sliders take effect immediately.
- 60fps-ish on a mid desktop GPU at `medium`; no runaway draw calls (< ~150).

Record failures honestly in `implementation-notes.md`.
