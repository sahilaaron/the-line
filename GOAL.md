# GOAL — Build Cycle 7: Historical Field & recursive Topic Worlds (ACTIVE)

(Cycle 6 — the database-backed YoL local timeline — is complete and merged
via PR #15; its outcome is recorded in `docs/implementation-notes.md`.
This document describes the ACTIVE cycle, tracked as issue #16 on branch
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

## Remaining (Opus construction — see instruction-set/YoL-layered-handover.md)

40–60 field records; 4–7 chapters per world; visual refinement and
placeholder variants; narrow-screen field controls + touch drag;
accessibility tab-order management; reduced-motion spec variant;
comprehensive Playwright coverage; evidence capture; docs completion
(03/04/README + this file's outcome record); CI + PR against issue #16.
