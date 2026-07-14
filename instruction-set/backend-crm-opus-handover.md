# Backend / CRM Handover — Cycle 8A kernel → Opus construction

**For: the next construction cycle. From: the Cycle 8A kernel build (Opus). Issue: #5. Branch: `issue-5/research-staging-crm`.**

Cycle 8A built and PROVED the research-staging KERNEL: the durable data model,
state machines, service boundaries and a minimal end-to-end CRM proof. Your
cycle is construction on top of it. Read `docs/research-operations.md` and
`docs/research-package-contract.md` first, then this.

## What is already true (do not rebuild, do not weaken)

- **Schema (migration `drizzle/0002_research_staging_crm.sql`, forward-only,
  verified idempotent):** canonical graph extensions + 7 staging tables. See
  `docs/database/schema-overview.md`.
- **Kernel services** (`src/services/research/*`), all unit-proven:
  - `state-machine.ts` — run/job/package transition tables + `assertTransition`.
  - `config.ts` — the ONE place for lease/priority/completeness tunables.
  - `queue.ts` — pure `selectNextJob` + transactional `claimNextJob` (batch
    limit, stop, double-claim guard, lease recovery, human>frontier>random).
  - `run.ts` — `createRun`, safe `requestStop`, `settleRun`, counters.
  - `resolver.ts` — 8-state `resolveEntity` (external-id > slug > alias/label;
    never fuzzy-merges ambiguous).
  - `submit.ts` — idempotent envelope → normalized items (+ resolver tags).
  - `qa.ts` — QA results/flags + holds.
  - `decision.ts` — authoritative per-item human decision.
  - `promotion.ts` — the ONE atomic, idempotent path staging → private
    canonical graph.
- **External-agent CLI** `src/scripts/research-agent.ts` (`npm run
  research:agent`) and `src/scripts/seed-research-demo.ts` (`npm run
  db:seed:research`).
- **CRM** under `app/crm/*` (dashboard, queue, package review, entity proof),
  read models in `src/db/queries/crm.ts`, actions in `app/crm/actions.ts`.
- **Proof**: `src/services/research/fixtures/steam-engine.ts` +
  `steam-engine.integration.test.ts` (10 acceptance checks), `kernel-pure`,
  `kernel-db`, and `e2e/research-crm.spec.ts` (CI-ready).

## Protected kernel rules (must never be violated)

1. **Three layers stay separate.** Research staging ≠ private canonical graph
   ≠ public/editorial (`yol_*`). Promotion NEVER writes `yol_*`, editorial
   status promotion, prominence, collage composition, topic chapters, identity
   tokens, or `topicWorldSlug`. (Preserves `docs/backend-crm-handoff.md` and
   `docs/database/research-handoff.md`.)
2. **Promotion never publishes.** Promoted rows are private: `isPlaceholder=
   true`, editorialStatus `draft`/`in_review`, never `published`. Acceptance
   into canon and public selection are separate decisions.
3. **Assertion classes never blur.** `inference`/`forecast` can never be
   promoted as verified fact (validator + `db:audit` guard). Do not build
   forecasting.
4. **No synthetic into canon.** Items marked `isSynthetic` or `synthetic`/
   `synth-`-prefixed are never promoted.
5. **No fuzzy auto-merge.** Ambiguous duplicates require human resolution.
6. **All writes go through repositories + validators.** No ad-hoc SQL in
   services/UI. New relationship types go in the `relationship_type_registry`,
   NOT a new enum. New classifications go in `CLASSIFICATION_VOCABULARY`.
7. **Never use JS `Date` for historical years** (astronomical integers only).
8. **One decision per package** (row-by-row exceptions are holds, not separate
   decisions).

## Remaining construction (your cycle)

Prioritised. None of it should weaken the kernel.

1. **Deep merge / entity reparenting.** The human decision `mark_duplicate`
   deliberately only RECORDS that the subject duplicates an existing canonical
   entity (it points the package at the target and does NOT reparent data). A
   later dedicated cycle should implement a real deep merge that reparents
   accepted time associations/relationships/claims/sources onto the target and
   sets `mergedIntoId`/`supersededById`, atomically + idempotently. Do not
   expose it as "merge" until it actually reparents.
2. **Return-correction loop.** A `return` queues a `returned_correction` job;
   wire the re-research → re-submit → re-review path in the UI and prove it
   end to end.
3. **Real discovery adapter.** Optional, small, timeout-safe Wikipedia seed
   adapter behind an env flag, fully replaceable by the deterministic test
   adapter. Do NOT make tests depend on the network.
4. **CRM depth.** Package review polish (source viewer, connection map instead
   of a relational list, per-section diff on re-submission); a run-history
   view; freshness/refresh controls; bulk queue triage. Keep it calm/spare —
   not a SaaS dashboard.
5. **Canonical → public adapter.** When public automatic entity pages arrive,
   add a read adapter that projects a published canonical entity into the
   Historical Field / Topic World VMs (`src/domain/worlds.ts`) — as a
   presentation OVERLAY, never a duplicate entity. The data model already
   supports this; do not pre-build the public API.
6. **QA provider wiring.** The QA staging contract is ready for a future
   external Perplexity/Grok session; wire the actual provider handoff (still
   no paid API in tests).
7. **Freshness policy.** `config.freshnessMaxAgeMs` is 0 (age-staleness off);
   decide and implement a real refresh cadence + `graphStatus='stale'`
   transitions.

## Known limitations / risks (honest)

- **No auth.** The CRM is local/internal only; not production-secure. Do not
  ship it publicly without an auth layer.
- **`mark_duplicate` does not reparent data** (records the duplicate only; deep merge is a later cycle — see #1).
- **Random discovery is a stub** (deterministic/injected only).
- **Completeness heuristic is coarse** (≥2 claims AND ≥1 time association →
  `canonical_complete`). Tune in `config.ts` as real data arrives.
- **Legacy relationship `type` enum is nullable** from 0002; new registry-only
  types store `typeKey` with `type=null`. Read code must coalesce
  `typeKey ?? type` (traversal/read models already unaffected because existing
  rows keep both).
- **Staging uses validated JSON payloads** in `research_package_items.payload`
  by design (transient, per-section reviewed). Canonical truth stays fully
  normalized. Do not "normalize" staging further without cause.
- **Sandbox note:** the full Playwright run and the final `next build` trace
  step exceed the 45s-capped sandbox shell; both are CI-ready and were proven
  by a live-server smoke (all `/crm` pages HTTP 200 against the seeded+promoted
  DB). Re-run in CI for artifacted screenshots.

## Extension points already in place

- `relationship_type_registry` (inverse wording, directionality, allowed
  kinds, cycle policy) — add types as data.
- `entity_classifications` controlled vocabulary — add subjects (document,
  law, treaty, work…) without touching renderers.
- `entity_time_associations` — multi-role timelines already supported.
- `DiscoveryAdapter` injection point in `queue.claimNextJob`.
- `assertion_class` on claims/relationships — inference/forecast can be stored
  now and surfaced later without ever becoming "fact".

---

## Cycle 8B addendum — Research Studio (does not weaken any 8A rule above)

Cycle 8B turned `/crm` into the graph-native Research Studio. Every protected
Cycle 8A rule above still holds. New protected rules for 8B:

- The relationship-type REGISTRY is authoritative (not the legacy enum). Extend
  the vocabulary via `src/db/seed/relationship-vocabulary.ts` + a forward-only
  seed, never a destructive enum migration. Entity kinds are forward-only
  additive only (never rename `organisation`).
- Candidate editing is auditable and append-only (`research_package_item_
  revisions`); the immutable submitted envelope is never mutated; editing never
  writes canonical/`yol_*`.
- A MATERIAL candidate edit after QA invalidates QA (→ `qa_pending`) and blocks
  approval until QA is rerun (`qaIsStale` gate). Do not bypass it.
- Candidate relationship edits must validate the type is ACTIVE and its endpoint
  kinds accept the endpoints (`services/research/vocabulary.ts`).
- The CoWork queue must stay HONEST: opening a batch never launches Claude; an
  unclaimed queued job is exactly `Awaiting Agent(s)`; display states are derived
  from the real state machine; no Anthropic API / paid-model execution.

Remaining construction for the next cycle: automatic public entity pages / Topic
World overlays; deep merge with reparenting; graph clustering/expand-collapse
heuristics for very dense packages; QA provider handoff; freshness policy.
