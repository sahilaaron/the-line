# Data Integrity Rules (Cycle 3)

## Numeric conventions

- **Confidence** and **strength**: integer **0..100** inclusive, CHECK
  constraint on every table that has one (`periods.confidence`,
  `relationships.confidence`, `relationships.strength`, `claims.confidence`,
  `yol_themes.importance`). Chosen over 0..1 floats for readability in raw
  SQL/JSON and to avoid float-precision edge cases.
- **Years**: signed integers (astronomical year numbering). `startYear <=
  endYear` enforced by CHECK when both are set.

## Relationships

- **Self-relationships are forbidden** (`source_entity_id <>
  target_entity_id`, CHECK constraint). None of the 13 relationship types
  express a meaningful self-reference in this domain.
- **Duplicate edges are forbidden** at the DB level: unique constraint on
  `(source_entity_id, target_entity_id, type)`. The repository's
  `addRelationship()` checks first and returns `{ created: false }` on a
  repeat instead of throwing, and falls back to a race-safe re-read if a
  concurrent insert wins.
- **Cycles are allowed at the data level** — the graph is not a strict tree.
  `influenced` explicitly does NOT mean `caused`; mutual influence
  (`A influenced B` and `B influenced A`) is legitimate history.
- **Expected-acyclic types**: `part_of`, `replaced` (containment/succession
  — a cycle here is a modelling bug). All other types, including
  `influenced`, may legitimately cycle. `npm run db:audit` flags a cycle in
  an expected-acyclic type as an **error**; it does not flag cycles in other
  types at all.
- Traversal (`src/db/queries/traversal.ts`) is **cycle-safe** (visited-set +
  max depth), not cycle-free — it must terminate on any graph shape.

## Claims & sources

- No fabricated citations. Any source used in fixtures/seed data must set
  `isSynthetic: true`; the synthetic generator additionally prefixes titles
  with `SYNTHETIC:`.
- A claim with `verificationStatus` of `verified` or `corroborated` must
  have at least one linked source (`claim_sources` row). Enforced by Zod at
  creation time (`claimCreateSchema`) and checked by `npm run db:audit`
  (`claim_missing_required_source`) — not a DB-level constraint, since a
  polymorphic join can't easily be a CHECK.

## Media

- Only synthetic fixture media (`isSynthetic: true`) may claim a licence
  without a cleared/public-domain rights status. Non-synthetic media
  claiming a licence must have `rightsStatus` of `cleared` or
  `public_domain`. Enforced by `mediaImportSchema` and audited.
- Media marked `isPublicDomain: true` must not have `rightsStatus: 'unknown'`
  (`media_publishable_without_rights_status`).

## Editorial status

Enum: `draft | in_review | verified | disputed | published | archived`,
shared across periods, entities, relationships, and YoL compositions.
`archiveEntity()` is a soft delete (sets `editorialStatus: 'archived'`),
never a row delete — nothing in this layer hard-deletes content rows.

## Integrity audit (`npm run db:audit`)

Checks (see `src/db/queries/audit.ts`): duplicate slugs, duplicate edges,
invalid time ranges, relationships referencing missing/archived entities,
claims without required sources, orphaned polymorphic subjects (claims,
media associations), media rights-status violations, published YoL
compositions with no themes, unreachable entities (warning), dense nodes
(warning, threshold: degree > 200 — `DENSE_NODE_THRESHOLD`, see inline
comment for rationale), unexpected cycles in expected-acyclic relationship
types (error). Exit code is non-zero iff `errors.length > 0`; warnings never
fail the build. `--json` for a machine-readable report.
