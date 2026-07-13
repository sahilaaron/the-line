# Research Pipeline Handoff (for issue #5)

This is the write/read contract for the historical research + staging
pipeline that follows Cycle 6. Cycle 6 (issue #14) made the database the
primary source for the rendered Year-on-Line and left these tables ready to
be populated with real, sourced history. **Issue #5 owns the staging design
itself** (candidate ingestion, promotion workflow, review UI); this document
only fixes the boundary it must respect.

Linked from [`schema-overview.md`](./schema-overview.md).

## What the pipeline may populate (canonical write side)

Write through the repositories and validators — never raw SQL, never partial
rows that skip the Zod schemas.

- **Time** — `periods`, incl. the sub-year integer parts
  (`start_month`/`start_day`/`end_month`/`end_day`). Repo: `repositories/periods.ts`.
  Validate with `validation/period.ts` (`periodCreateSchema`). Astronomical
  year numbering; never JS `Date`.
- **Entities** — `entities` + the per-kind subtype tables. Repo:
  `repositories/entities.ts`. Validate with `validation/entity.ts`
  (`entityCreateSchema`, `entityKindValues`).
- **Relationships** — `relationships` (+ `relationship_claims`). Repo:
  `repositories/relationships.ts`. Validate with `validation/relationship.ts`.
  Respect the acyclic constraints declared in `schema/shared.ts`.
- **Claims & sources** — `claims`, `sources`, `claim_sources`. Repo:
  `repositories/claims.ts`. Validate with `validation/claim.ts`
  (`claimCreateSchema`, `sourceCreateSchema`, `claimSourceLinkSchema`).
  **This is where historical truth becomes sourced** — a claim carries
  `subjectType`/`subjectId`; a claim is linked to one or more sources with an
  optional quotation/locator.
- **Media** — `media`, `media_associations`. Repo: `repositories/media.ts`.
  Validate with `validation/media.ts` (`mediaImportSchema`). Rights status is
  mandatory; generated/reconstructed imagery must never be labelled archival.

The validated input shapes live in `src/db/validation/*` and are the single
definition of a well-formed row. If a shape is missing a field the pipeline
needs, extend the validator (and its test) rather than bypassing it.

## How researched data reaches the rendered YoL

The read side is ONE query: `yolReadModelByAnchorSlug` in
`src/db/queries/yol-read-model.ts`, exposed as `GET /api/yol/[anchorSlug]`.

A year's stations are `yol_timeline_points` rows tied to a
`yol_compositions` row (by `anchor_slug`). A point may reference an
`entity_id`; **claims and sources reach the read model through that entity**
— `claims.subjectType = 'entity'` and `claims.subjectId = <the point's
entity>`, then `claim_sources` → `sources`. So to make a station show a
sourced date/quotation, the pipeline attaches the claim to the point's
entity, not to the point directly.

## What makes data publicly renderable

The read model excludes anything synthetic at every join
(`isSynthetic = false`) and derives provenance from two fields:

- `isPlaceholder = false` **and** `editorialStatus ∈ {in_review, verified,
  published}` → provenance surfaces as **reviewed**;
- otherwise → **placeholder** (shown honestly as provisional/unsourced).

Candidates should therefore stay `isPlaceholder = true` / `editorialStatus =
draft` until a human promotes them; promotion (the transition into a
reviewed status) is the staging pipeline's job and belongs to issue #5.
Nothing is deleted to hide it — provenance is surfaced, not suppressed.

## What the pipeline must NEVER write directly

- **YoL curation tables** — `yol_compositions`, `yol_themes`,
  `yol_timeline_points`, `yol_point_themes`, `yol_scene_hints`,
  `yol_featured_entities`. These are editorial/presentation curation, not raw
  research. The pipeline supplies entities/periods/claims/sources; a curator
  (or a separate, reviewed step) composes them into a year.
- **Identity / manifests** — the Year Visual Identity system and its media
  manifests are authored, not researched. Do not write year styling from the
  pipeline.
- **`MediaFrame` provenance** — never relabel generated/reconstructed imagery
  as genuine archival media.
- **Anything synthetic into public rows** — synthetic stress data
  (`db:seed:synthetic`, `synth-`/`SYNTHETIC:` prefixes, `isSynthetic = true`)
  is for load/robustness testing only and must never enter a row that could
  be promoted to public.

## Status

Issue #5 stays **BLOCKED** until issue #14 is merged by Sahil. The canonical
tables, repositories, validators and the read boundary above are the stable
surface #5 builds on; the staging/promotion mechanism is #5's to design.

---

## Status update (Cycle 8A, issue #5 — DELIVERED)

Issue #5 is no longer blocked (issue #14/PR #15 merged). Cycle 8A built the
staging design on top of the boundary above and **preserves every constraint
in it**: the promotion service writes time/entities/relationships/claims/
sources/media only through the repositories + validators named here, never raw
SQL, never `yol_*`, never synthetic rows, never a placeholder relabelled as
reviewed/archival. Candidates stay `isPlaceholder=true` / editorial `draft`/
`in_review` until a human promotes; promotion is PRIVATE canonical acceptance,
not publication. See `docs/research-package-contract.md` and
`docs/research-operations.md`.
