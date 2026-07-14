# GOAL — Build Cycle 8A: Research Staging Pipeline & CRM kernel (ACTIVE)

Tracked as issue #5 on branch `issue-5/research-staging-crm`. This is an
architecture/kernel cycle (Opus): build the durable data model, state
machines, service boundaries and a minimal but genuinely usable end-to-end
CRM proof that turns candidate research into the **private canonical graph**.
Cycles 6 (PR #15) and 7 (PR #17) are complete and untouched by this cycle.

## Mission

The Line is becoming a **knowledge graph of civilisation**; the timeline,
Historical Field and Topic Worlds are interfaces over that graph, not the
graph itself. Cycle 8A builds the pipeline that populates the graph with
sourced, reviewed history while keeping three concerns strictly separated:

1. **Research staging** — candidate work, bot provenance, QA, review decisions
   and immutable package snapshots;
2. **Canonical historical graph** — accepted, PRIVATE knowledge (extends the
   base 24 tables);
3. **Editorial presentation** — public curation (`yol_*`), never written by
   research.

Acceptance into the canonical graph and selection for public presentation are
**separate decisions**. Promotion never publishes.

## Delivered (Opus — the kernel)

- **Schema (migration 0002, forward-only):** entity identity satellites
  (aliases, external ids, controlled classifications resolving the kind
  drift), typed multi-role `entity_time_associations`, a growable
  `relationship_type_registry` (with `relationships.typeKey` bridge; legacy
  enum relaxed to nullable, backfilled, 13 builtins seeded), `assertion_class`
  on claims/relationships, entity graph-status/freshness/supersession
  metadata, and the 7 staging tables (runs, jobs, packages + immutable
  envelope, normalized package items, qa results, qa flags, decisions).
- **Kernel services** (`src/services/research/*`): centralised config;
  explicit run/job/package state machines; a deterministic queue selector
  (human > frontier > random) with lease recovery and double-claim guard;
  safe run stop + counters; injected discovery adapter; an 8-state entity
  resolver; idempotent package submission; QA ingestion with holds;
  authoritative per-item human decisions; and a single **atomic, idempotent
  transactional promotion** into the private canonical graph that excludes
  synthetic/held items, preserves provenance, enqueues frontier jobs and never
  writes `yol_*`.
- **External-agent CLI** (`npm run research:agent`) so a manually-launched
  CoWork session can claim/submit/qa/status without Anthropic API billing.
- **Minimal internal CRM** (`/crm`): dashboard, queue & runs, package review
  (package-level approval with per-item holds), canonical record proof.
- **Steam Engine proof fixture** + tests at every layer (state machine, queue,
  resolver, validators, promotion success/rollback/idempotency, synthetic
  exclusion, provenance) and a CI-ready Playwright UI spec.

## For the next cycle (Opus)

See `instruction-set/backend-crm-opus-handover.md` for the exact remaining
construction, protected kernel rules and known risks. Cycle 8A deliberately
does NOT build: forecasting, paid model integrations, public automatic entity
pages, full Topic World authoring, media upload, or production auth.
