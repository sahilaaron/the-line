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
