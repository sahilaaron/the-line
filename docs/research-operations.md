# Research Operations — the daily workflow

Plain-language guide to running the historical research pipeline. This is
INTERNAL tooling. It turns candidate research into the **private canonical
graph**; it never publishes anything to the public experience.

## The three layers (never confuse them)

1. **Candidate research** — everything in the `research_*` / `qa_*` /
   `package_decisions` staging tables. Proposed, not accepted.
2. **Private canonical knowledge** — accepted entities, time associations,
   relationships, claims, sources, media in the base graph tables. Real, but
   `isPlaceholder=true` / editorial status `draft`/`in_review` and **never
   published**. The canonical graph deliberately holds MORE than the public
   experience shows.
3. **Public / editorial presentation** — `yol_*` curation. A separate human
   decision selects what (if anything) becomes public. Research agents and the
   promotion service NEVER write here.

## Daily flow

1. **Sahil starts a run** in the CRM (`/crm`) with a positive integer batch
   limit, or `npm run research:agent -- create-run --limit 5`.
2. **Sahil launches Claude CoWork** in the repo (no Anthropic API billing).
3. **Claim a job:** `npm run research:agent -- claim --run <runId>`. Prints the
   next job (title/url/focus note) or `{ job: null, reason }`.
4. **If the queue is empty** and the run allows it, `claim` can obtain a random
   eligible seed through an **injected discovery adapter** (disabled by
   default; pass `--seeds "Title A|Title B"` for a deterministic local seed, or
   wire a real, timeout-safe Wikipedia adapter later).
5. **Research externally** and write a package file (see
   `research-package-contract.md`), then
   `npm run research:agent -- submit --job <jobId> --file package.json`.
6. **A separate QA session** reads the package and submits QA:
   `npm run research:agent -- qa --package <pkgId> --file qa.json`.
7. **Sahil reviews** the package in `/crm/packages/<id>` and
   approves / approves-with-holds / returns / marks-duplicate / rejects.

`npm run research:agent -- status` prints queue counts and packages awaiting
review at any time.

## Queue order (deterministic)

Within an active run that has not hit its batch limit and has not been stopped:

1. **Human priority** — `manual` and `returned_correction` jobs first.
2. **Frontier** — already-discovered but insufficiently-researched connected
   entities (created as draft stubs / suggested-next during promotion).
3. **Random discovery** — only when neither of the above exists, and only via
   the injected adapter.

Inside each group: higher `priority` first, then lower `sequence` (stable
insertion order). Fully unit-tested in `kernel-pure.test.ts`.

## Job & run states

- **Job:** `queued → claimed → (researching) → submitted → completed`; plus
  `claimed/researching → queued` (lease recovery/release), `submitted →
  returned` (sent back → a new `returned_correction` job), `→ failed`
  (reject/error), `queued → cancelled`.
- **Run:** `active → stopping → stopped` (safe stop) or `active → completed`
  (batch limit reached and no jobs in flight). `stopRequested` blocks new
  claims immediately.
- **Package:** `submitted → qa_pending/qa_complete → in_review →
  approved / approved_with_holds → promoted`; or `in_review →
  returned / marked_duplicate / rejected`.

## Stop semantics (safe)

Requesting a stop sets `stopRequested=true` and moves the run to `stopping`.
**New claims are blocked immediately.** Any in-flight claimed/researching job
is allowed to **finish** (submit) — it is neither killed nor corrupted. When no
jobs remain in flight, the run settles to `stopped`. A stopped run never leaves
a job or package in a half-state. Tested in `kernel-db.test.ts`.

## Lease / recovery

A claimed job holds a `workerLock` and a `leaseExpiresAt` (default 15 min). If a
worker abandons a job, the lease expires and the kernel treats it as
re-claimable (`recoverExpiredLeases`, or automatically on the next `claim`). Two
workers can never hold the same job: the claim update is guarded by the
status+lease predicate inside a transaction.

## Existing-entity handling (not a binary skip)

The resolver returns one of: `absent`, `draft_stub`, `queued_or_researching`,
`candidate_in_review`, `canonical_incomplete`, `canonical_complete`, `stale`,
`ambiguous_duplicate`, `superseded_or_archived`. Only a **sufficiently complete
canonical** record defaults to "already known"; the operator may still request
a refresh/expansion. **Ambiguous matches are never silently merged** — they
require human resolution.

## What each external session may read/write

- **Research session:** READ jobs (via `claim`), WRITE a package (via
  `submit`). May not promote or touch public curation.
- **QA session:** READ a package, WRITE `qa_results` + `qa_flags` (via `qa`).
  May not promote.
- **Human (Sahil) in the CRM:** the only actor who promotes (approve /
  approve_with_holds) into the private canonical graph, or returns /
  marks-duplicate / rejects. Publishing to `yol_*` is a separate, later step outside this cycle.
