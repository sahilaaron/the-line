# GOAL — Build Cycle 7: Historical Field & recursive Topic Worlds (COMPLETE - merged PR #17)

(Cycle 6 — the database-backed YoL local timeline — is complete and merged
via PR #15; its outcome is recorded in `docs/implementation-notes.md`.
This document describes cycle 7 (now complete - merged PR #17), tracked as issue #16 on branch
`issue-16/historical-field-topic-worlds`.)

## Mission

Turn the experience into a RECURSIVE world: selecting 1769 descends into a
continuous 1760–1780 Historical Field (temporal collage above a fixed
local marker), any subject expands into a Topic World, and topics open
further topics to arbitrary depth (Steam Engine → James Watt → University
of Glasgow → Scottish Enlightenment) — all through one generic world-stack
architecture with exact restoration at every level. 1969 keeps the
database-backed YoL renderer from cycle 6, untouched.

## Delivered by Fable (the architectural kernel — proven)

- Generic world stack in the store (`pushWorld/popWorld/returnToDepth`,
  frame-owned restoration, one transition lock) + `worlds.ts` frames.
- Continuous historical time (`fieldTimeState`) and the topic chapter
  axis; wheel/arrow/Escape routing per world type; grammar unchanged.
- Deterministic seeded temporal collage layout (lane collision handling,
  editorial overrides, visible window, emphasis falloff) — unit-proven at
  60-record scale.
- Historical Field + generic Topic World renderers, shared-element
  push/pop transition plate (data-readiness-gated), breadcrumb/back
  chrome, deterministic placeholder plates (no image assets).
- Async data boundary (`src/domain/worlds.ts` +
  `HistoricalWorldDataSource` + mock adapter) so the future CRM replaces
  the adapter, not the renderers — contract in
  `docs/backend-crm-handoff.md`.
- Proof content (14 field records, 4 two-chapter worlds) and the smoke
  suite: `e2e/historical-chain.spec.ts` runs the WHOLE chain with exact
  restoration at every depth; all 14 e2e specs green locally; 16 new unit
  tests (layout + world stack).

## Delivered by Opus (the construction — completing the cycle)

- 60 field records across 1760–1780 (mixed kinds, aspect ratios 0.6–2.3,
  prominence 32–95, ranges, four editorial `composition` overrides);
  near-band density 8–19 in the core and 6–8 at the edges (the sparse
  1760–63 / 1777–80 edges are gone) — unit-checked in `field/layout.test`.
- Four topic worlds filled to 6/6/5/6 provisional chapters, one onward
  doorway each along the demonstration chain (Enlightenment terminal).
- Seeded placeholder-plate treatment variants (border / hatch / vignette /
  registration marks / internal geometry) — deterministic from seed only.
- Field visual refinement (framing, hover labels, tick rhythm, sky) and
  per-`data-chapter` topic atmosphere drift; the lane-3 hover-label
  overflow defect is fixed.
- Narrow (<=900 / <=560px): `field-prev` / `field-next` controls (locked
  during transitions) + pointer/touch drag on the field, a thinned-but-
  still-temporal collage, no page overflow, no chrome clipping.
- Accessibility: far/hidden plates and inactive-chapter doorways leave the
  tab order; decorative graphics stay silent; field items announce
  title / kind / date / opens-world.
- Reduced motion verified on the single kernel path (no second renderer);
  new `reduced-motion-field.spec.ts` proves the whole chain restores.
- Playwright: kernel `historical-chain` kept green; added
  `historical-field.spec.ts` (8) and `topic-worlds.spec.ts` (7); all
  1969/DB regressions green. Evidence (11 screenshots + a descent->depth-4
  ->return recording) captured and attached to the PR (not committed).
- Docs updated (03 / 04 / README / this file / implementation-notes).

Outcome: the recursive layered-world experience is complete end to end —
1769 descends into a populated 1760–1780 Historical Field, subjects expand
into topic worlds to arbitrary depth with exact restoration at every level,
and 1969 keeps its database-backed YoL untouched. Remaining follow-ups are
a real-GPU motion review and the optional outgoing-world transition zoom.
