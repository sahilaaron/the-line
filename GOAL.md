# GOAL — No active build cycle (housekeeping / between cycles)

Updated 2026-07-23. Cycle 8 is COMPLETE and merged. There is no active
cycle; the next cycle has not been selected yet.

## State of the project

- **Cycle 8A** (issue #5, research staging pipeline & CRM kernel) and
  **Cycle 8B** (Research Studio: vocabulary v1, package editing with
  revisions, React Flow package graph, honest queue, generation-safe
  leases, expired-lease enforcement) are merged to `main` via **PR #19**.
  A CRM page-scrolling fix followed as **PR #20**. Main tip as of this
  update: `bc279b4`. Migrations run 0000–0009.
- The research kernel test suite (142 tests), lint, typecheck and build
  were green at merge. Playwright runs in CI.
- The pipeline is built but has NOT yet been fed real research at scale:
  the canonical graph still contains only seed/proof content (Steam
  Engine fixture, prototype data).

## Standing constraints

- Substantive work happens on `issue-<n>/<slug>` branches, never on
  `main` (see CLAUDE.md). Sahil alone merges and moves issues to Done.
- Research must respect the historical-integrity rules in the project
  instructions; promotion never writes `yol_*`.

## Candidates for the next cycle (not yet chosen)

1. **Run the research pipeline for real** — turn
   `docs/research/movable-type-printing-1400-1500.md` (branch
   `research/movable-type-printing-1400-1500`) into research packages,
   QA them, and promote the first genuinely researched content into the
   canonical graph via the Studio.
2. **Issue #1 — complete database-to-Line integration** so the
   timeline/Field/Topic Worlds read from the canonical graph the
   pipeline populates.
3. **Issue #13 — refresh 1969 YoL with final generated media** (visual/
   content cycle).
4. **Issue #4 — design temporal echoes** (design/shaping work).

Issue #3 (read-only data studio) is likely superseded by the CRM/Studio
and may deserve closing or re-shaping — Sahil to decide.

When a cycle is selected, replace this file with that cycle's goal.
