# Research Studio (Cycle 8B)

The graph-native operator experience for The Line's private research pipeline.
`/crm` is the Research Studio; `/crm/packages/[id]` is the graph workspace.
This builds on — and preserves every invariant of — the Cycle 8A kernel.

## Three separated layers (unchanged)

1. **Candidate research + QA staging** (`research_*`, `qa_*`, decisions,
   revisions). Research/QA agents PROPOSE here; nothing is public.
2. **Private canonical knowledge graph** (base + graph-ext tables). Approval
   promotes accepted material here — private, never published.
3. **Public/editorial** (`yol_*`). Research and QA NEVER write here.

## Graph-native package review

The default review surface is a 2D React Flow canvas (chosen for precision and
legibility over spectacle — no 3D editor). It shows the package's central
entity as the anchored focal node, all candidate entities, matched canonical
entities, and candidate relationships as directional, labelled edges (the
registry forward label is drawn on the edge; the inverse label appears in the
inspector). Pan/zoom/fit, node dragging, a MiniMap and a deterministic initial
layout are provided, plus a chronology-layout toggle (dated nodes by year),
filters (kind, QA/held, synthetic), and an accessible table fallback that
represents the same graph.

Kind is shown by a glyph + text label; state by text badges — never colour
alone. Node states: `new_candidate`, `canonical_match`, `canonical_incomplete`,
`held`, `qa_flagged`, `synthetic_excluded`. Edge states: `held`, `qa_flagged`,
`disputed`, `provisional`, `normal`.

### Inspector

Selecting a node opens the right-side inspector (label, slug, kind, aliases,
external ids, description, canonical match/status, claims, sources, decision,
year, provenance back to the package). Selecting an edge shows the relationship
type, forward + inverse labels, direction, source→target, category, confidence,
assertion class, dispute and hold state (and a provisional warning for
`associated_with`).

## Candidate editing + QA invalidation

Sahil can edit candidates BEFORE approval. The immutable submitted envelope is
never changed — edits apply to normalized package items and are recorded in an
append-only revision history (`research_package_item_revisions`: editor,
timestamp, before/after, whether it invalidated QA). Supported: edit fields,
change a relationship to another ACTIVE registry type valid for the endpoint
kinds, change endpoints within the package, hold/unhold, reject an item, correct
a canonical match, and return the whole package.

**QA invalidation:** a MATERIAL edit (field / relationship type / endpoints /
match) after QA reverts the package to `qa_pending` and blocks approval until QA
is rerun (`qaIsStale` gate in `decidePackage`). Review actions (hold/unhold,
reject) are NOT material. The UI shows a clear banner. Nothing here writes
canonical or `yol_*` rows.

## Controlled vocabulary v1

Entity kinds are nouns; relationship types are verb-like edges. The registry
(not the legacy enum) is authoritative and is extended only by deliberate
governance (a forward-only seed), never a destructive migration.

**Entity kinds** (forward-only; all prior kinds preserved, `organisation`
displayed as "Organization"): person, organisation, place, event, invention,
discovery, technology, concept, movement, publication, product, law_policy,
civilisation, period, theme.

Classification guidance: a *discovery* is an entity for a found thing/principle
(discovered_by a person) and an *event* for the moment it happened; *technology*
is a broader capability/field while an *invention* is a specific devised
artifact; a *movement* is an organised collective/school while a *theme* is an
analytical lens; a *product* is a commercialised market offering while an
*invention* is the underlying devised thing.

**Relationship vocabulary v1** — the 13 original built-ins plus 25 additions
across attribution / support / causal / influence / succession / structural /
institutional / interaction / spatial / diffusion, each with a forward label,
inverse label, canonical direction, category, allowed source/target kinds,
acyclic expectation and description. `associated_with` remains a symmetric
`fallback` type flagged **provisional** (imprecise — refine later). One canonical
direction is stored; the UI renders the correct inverse label. See
`/crm/vocabulary` (read-only) and `src/db/seed/relationship-vocabulary.ts`.
Candidate relationship editing only offers active types compatible with the
selected endpoint kinds.

## Honest Claude CoWork queue

Research is run MANUALLY through Claude CoWork. There is NO Anthropic API call
and opening a batch does NOT launch Claude. Language: "Open a research batch"
(not "Start a run"); an unclaimed queued job reads exactly **`Awaiting
Agent(s)`**. Display states are DERIVED from the real state machine
(`display-state.ts`) — an expired lease reads `Awaiting Agent(s)` again; the
active-agent count comes from unexpired claimed/researching leases. Progression:
`Awaiting Agent(s) → Claimed → Researching → Submitted → Awaiting QA → Ready for
review → Completed`.

The queue page shows the full run ID (with copy), batch limit, counts, state,
stop control, active-agent count, per-job priority/attempts/agent/lease/error,
and copy controls: **Copy Research Agent Prompt**, **Copy QA Agent Prompt**,
**Copy Claim Command**, **Copy Run ID**. Queue management: edit priority, edit
focus note (before claim), cancel a queued job, requeue eligible failed/
released work. The page auto-refreshes at a modest interval via `router.refresh`
(no form-state loss).

### CoWork research-agent workflow

Copy the Research Agent Prompt into a manually-launched CoWork session. The
agent uses the CLI: `claim-next-active` / `claim --run`, `begin`, `heartbeat`
(keeps the lease), `submit`, `release`/`fail`. It may READ jobs and WRITE a
validated package; it must NEVER QA its own work, approve, promote, publish or
write canonical/`yol_*`. Atomic claims + lease recovery mean two agents can
never hold one job.

### CoWork QA-agent workflow

A SEPARATE role. Reads a submitted package, checks it independently, and submits
QA (`qa --package <id> --file qa.json`) with item-level flags. QA never
promotes, edits candidates, or writes canonical/`yol_*`, and never QAs a package
it researched.

## Known limitations

- Deep canonical entity merging is NOT implemented (out of scope; `mark_duplicate`
  only records a duplicate).
- Random Wikipedia discovery stays disabled unless an injected adapter is
  supplied (no autonomous paid-model execution).
- No authentication (local/internal only).
- The graph canvas targets laptop widths and up; very dense neighbourhoods rely
  on filters + the table fallback rather than automatic clustering.
- Relationship endpoint-kind enforcement is applied at edit and promotion time;
  legacy pre-8B data is not retro-validated.

## Next construction cycle

Automatic public entity pages / Topic World overlays from published canonical
entities; deep merge with reparenting; richer graph clustering/expand-collapse
heuristics; a QA provider handoff; freshness/refresh policy; multi-run agent
dashboards.

## Correction-pass semantics (holds, atomic edits, queue leasing, counters)

### Human holds vs QA-derived holds

Every held item carries `hold_source`: `human` or `qa`. A human hold (set from
the inspector) persists until a human removes it. A QA flag places a `qa` hold.
When QA reruns, obsolete QA-derived holds (items no longer flagged by the latest
QA result) are cleared automatically; a human hold is NEVER cleared by a QA
rerun. `approve_with_holds` excludes any held item regardless of source.

### Atomic edits + revisions

Every candidate-edit operation (entity fields, relationship type, relationship
endpoints, canonical match, hold/unhold, reject) runs as a SINGLE database
transaction covering the payload mutation, QA invalidation/package-state update,
and the append-only revision insert. If any step fails (e.g. the audit insert),
the whole edit rolls back — no partial or unaudited edit remains. The immutable
submitted envelope is never mutated; nothing writes canonical or `yol_*` rows.
A material edit (field / type / endpoints / match) after QA reverts the package
to `qa_pending` and blocks approval until QA is rerun. An explicit item-level
rejection is never reversed by package approval and is never promoted.

### Queue leasing + ownership

A claim records the exact worker identity (`claimed_by_worker`) and a lease. All
lease operations verify EXACT worker identity — never a prefix — so `agent-1`
cannot operate a lease owned by `agent-10`. `begin`/`heartbeat` extend the
lease; `release` returns the job to the queue; `fail` marks it failed;
expired-lease recovery reclaims abandoned work. Atomic claims + lease recovery
mean two agents can never hold one job.

### Counter semantics (run)

- **batchLimit** — the total number of jobs the run will CLAIM.
- **claimedCount** — batch slots currently CONSUMED. A claim consumes a slot; a
  release or an expired-lease recovery FREES the slot (the run can claim
  replacement work); a completed / failed / returned outcome KEEPS the slot
  (the batch was spent on that job). A run completes when `claimedCount ==
  batchLimit` and no job is in flight (claimed/researching).
- **completedCount / failedCount / returnedCount** — terminal outcome tallies,
  each incremented exactly once (idempotent). The counters and the UI tell the
  same story: `Awaiting Agent(s)` means a queued, claimable job — never work
  already submitted or in QA.

### "Awaiting Agent(s)" and manual CoWork

`Awaiting Agent(s)` is a queued job with no live agent lease. Adding a topic
only CREATES such a job — it never launches Claude. A human starts a Claude
CoWork session, copies the generated Research Agent Prompt, and the agent claims
the job via the CLI (`claim-next-active` / `claim --run`), works it, and submits
a validated package. Opening a research batch likewise does not launch Claude.

## Feature completeness (this cycle)

Complete and tested (unit/integration): vocabulary v1 + endpoint validation;
graph projection with canonical-match/hold/QA state; atomic candidate editing +
revision history + QA invalidation; human-vs-QA hold provenance; queue
leasing/ownership + counter repair on release/recovery; classification→kind
preservation; honest display states + CLI. Rendered in the Studio UI: graph
canvas, inspector (node + edge) with sources/flags/holds/questions/dates +
canonical link, chronology re-layout, endpoint-filtered relationship dropdown,
filters (kind/category/candidate-vs-canonical/QA-held/synthetic-dev), edit
controls (label/match/endpoints/type/hold/reject), accessible table fallback.

Intentionally deferred: deep canonical entity merge (mark_duplicate records a
duplicate only); automatic public entity pages / Topic World overlays; graph
auto-clustering for very dense packages; a real Wikipedia discovery adapter;
production authentication.

## Correction pass v3 (2026-07-15)

Independently-reproduced defects fixed in this pass. Only behaviour that is
implemented AND tested is described here.

### Independent human vs QA holds
A package item now carries two independent booleans, `human_held` and `qa_held`;
the effective `held` column is maintained as their OR and a CHECK constraint
(`research_package_items_held_consistent`) forbids any inconsistent state.
Migration `0007` backfills existing rows from the old `hold_source` value
(`human`/`qa`), defaults any other held row to a human hold, then drops
`hold_source`. Consequences:

- a human hold and a current QA hold can coexist;
- removing a human hold (`setItemHold(..., false)`) never clears a current QA hold;
- a passing QA rerun clears only `qa_held`; a human hold survives;
- promotion / `approve_with_holds` read the effective `held`, so an item held by
  either reason is excluded by default.

### Current vs historical QA
`projectPackageGraph` derives current QA flags from the LATEST `qa_result` only.
Older results and their flags stay in the database for audit history but never
mark a node/edge as currently flagged, so a passing rerun visibly clears the
graph's `qa_flagged` state. Edge hold provenance (`humanHeld`/`qaHeld`) is now
projected onto `GraphEdge` and rendered accurately, including simultaneous holds.

### Expired-lease reclaim capacity
`claimNextJob` can reclaim an expired `claimed`/`researching` job directly. A
reclaim is not a new batch item: the prior run's slot is released exactly once
and the new claim consumes one. Same-run reclaim nets zero; a different run
reclaiming decrements the old run and increments the new one. `claimed_by_run_id`
follows the reclaiming run.

### Canonical-match editing
`correctCanonicalMatch` enforces controlled statuses and status/id coherence: a
status that asserts a canonical link (`canonical_complete`,
`canonical_incomplete`, `confirmed_match`) requires a real, existing entity id; a
no-entity status (`new_candidate`, `no_match`) is required to clear a match.
Arbitrary free-text status and non-existent ids are rejected. The Studio node
inspector provides a match editor (search + real-entity picker + controlled
status select + explicit "clear match"); it can no longer silently clear a real
match by submitting a status with no id.

### Agent prompt worker identity
The generated research-agent prompt tells the operator to choose ONE worker name
and pass `--worker <your-name>` on every lease command (claim, claim-next-active,
begin, heartbeat, release, fail). The lease is owned by that exact name; omitting
`--worker` (which defaults to `cowork`) will not own the lease.

### Developer-mode synthetic visibility
Synthetic candidates are excluded from a normal package projection entirely
(and edges to them are dropped). They are included only when the SERVER receives
an explicit `?dev=1` developer-mode input; the client "show synthetic" checkbox
appears only in that mode and merely toggles visibility of already-authorized
data. Synthetic items remain unpromotable.

### Queue UI
Each job row shows its full id with a Copy control, the exact claimed worker
(from `claimed_by_worker`), lease freshness/expiry, last-activity timestamp, and
any failure/return reason; the focus note is editable while a job is queued.
Priority ordering (priority desc, sequence asc) is preserved.

### Inspector/editing completeness
Node inspector: editable label, description and date (chronology start year);
functional canonical-match editor; independent human-hold toggle. Edge inspector:
sources/citations, dates, accurate human/QA hold provenance, type/endpoint edits.
A neighbourhood focus control collapses the graph to a selected node and its
direct neighbours. The accessible table rows select the node/edge they describe.
