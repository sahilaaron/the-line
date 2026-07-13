# Research Package Contract

Authoritative shapes for the research pipeline. The single source of truth is
`src/db/validation/research.ts` (Zod) — this document describes it; the code
wins on any drift. A complete, valid example lives in
`src/services/research/fixtures/steam-engine.ts`.

## Cross-reference model

Every section item carries a stable `ref` (a "localRef", unique within its
section). Cross-section links use those refs, so a package can describe
relationships/claims/media BEFORE any canonical id exists. The central
entity's ref is conventionally `"central"`.

## Envelope (submitted by a research session)

```jsonc
{
  "schemaVersion": 1,
  "submittedBy": "cowork:session-id",
  "job": { "jobId": "…", "centralTitle": "Steam engine", "centralUrl": "https://…" },

  // 1. Entity identity — exactly one entity has role "central".
  "entities": [
    {
      "ref": "central", "role": "central",
      "slug": "steam-engine", "label": "Steam engine (provisional record)",
      "kind": "invention",                       // optional; else derived from classifications
      "classifications": ["invention", "technology"],
      "shortDescription": "…", "fullDescription": "…",
      "aliases": [{ "alias": "atmospheric engine", "aliasType": "alias" }],
      "externalIds": [{ "scheme": "wikidata", "value": "Q7644" }],
      "isSynthetic": false                        // true ⇒ NEVER promoted
    },
    { "ref": "watt", "role": "connected", "slug": "james-watt", "label": "James Watt", "kind": "person", "classifications": ["person"], "matchExistingSlug": "james-watt" }
  ],

  // 2. Chronology — typed lifecycle milestones (an entity may have many).
  "chronology": [
    { "ref": "t-patent", "entityRef": "central", "role": "patented", "startYear": 1769, "precision": "exact", "confidence": 80 }
  ],

  // 3. Connections — typed relationships (registry keys); held ⇒ excluded.
  "connections": [
    { "ref": "rel-watt", "sourceRef": "central", "targetRef": "watt", "typeKey": "improved_by", "explanation": "…", "confidence": 75, "assertionClass": "recorded_fact" }
  ],

  // 4. Claims + sources (source links carry quotation/locator).
  "sources": [
    { "ref": "src-patent", "title": "Watt, J. (1769). Patent GB 913…", "type": "primary_document", "publicationYear": 1769 }
  ],
  "claims": [
    { "ref": "c-patent", "subjectRef": "central", "subjectSection": "entity",
      "text": "James Watt was granted a patent for a separate-condenser steam engine in 1769.",
      "assertionClass": "recorded_fact", "verification": "verified",
      "sourceLinks": [{ "sourceRef": "src-patent", "locator": "GB 913" }] }
  ],

  // 5. Media candidates — honest status; generated/reconstructed ≠ archival.
  "media": [
    { "ref": "m-plate", "subjectRef": "central", "mediaType": "image", "alt": "…", "rightsStatus": "unknown", "status": "placeholder" }
  ],

  // 6. Unresolved questions.
  "questions": [
    { "ref": "q-attr", "category": "ambiguity", "detail": "…", "severity": "major", "relatedSection": "relationship", "relatedRef": "rel-newcomen" }
  ],

  // 7. Suggested next entities → become frontier jobs on promotion.
  "nextEntities": [
    { "ref": "n-boulton", "title": "Matthew Boulton", "reason": "Commercial partner; unresearched.", "suggestedPriority": 40 }
  ]
}
```

### Validation guarantees (enforced by Zod)

- exactly one `role: "central"` entity; unique refs within each section;
- chronology/relationship/claim/media refs resolve to declared items;
- a relationship cannot link an entity to itself;
- `endYear >= startYear`; astronomical-year integers (never JS `Date`);
- a `verified`/`corroborated` claim needs ≥1 source link AND must be
  `recorded_fact` or `interpretation` — an `inference`/`forecast` can never be
  verified as fact;
- generated/reconstructed media may not claim `public_domain` rights.

## Assertion classes

`recorded_fact` (directly sourced) · `interpretation` (attributed reading) ·
`inference` (system-derived) · `forecast` (future scenario). Cycle 8A ingests
the first two. Inference/forecast may be stored but are never promoted as
verified fact — a machine-readable guarantee (validator + `db:audit`).

## Classification vs kind (the kind-drift resolution)

`entities.kind` stays the small renderer enum (person/invention/event/theme/
place/organisation/civilisation/concept/period). Richer meaning rides in
`entity_classifications` (a controlled vocabulary: discovery, idea, document,
work, law, treaty, technology, movement, …). Two reconciliations are explicit:
`idea → concept` and `discovery → event`. New classifications need no code
migration; the vocabulary is `CLASSIFICATION_VOCABULARY` in
`validation/graph-ext.ts`.

## QA contract (submitted by a QA session)

```jsonc
{
  "recommendation": "hold",                 // pass | hold | correct | duplicate | insufficient_evidence
  "summary": "…", "toolName": "…", "model": "…", "qaRunRef": "…",
  "flags": [
    { "targetSection": "relationship", "targetRef": "rel-newcomen",
      "severity": "major", "category": "attribution",
      "explanation": "\"replaced\" overstates: engines coexisted.",
      "correctiveSource": "Hills 1989, ch. 2", "state": "hold" }
  ]
}
```

A non-`pass` flag on a specific item marks that package item **held** (excluded
by default) so the reviewer sees it flagged. QA never promotes.

## Human decision (final, package-level)

```jsonc
{ "decision": "approve_with_holds",         // approve | approve_with_holds | return | mark_duplicate | reject
  "reviewer": "Sahil",
  "heldItems": [{ "section": "relationship", "localRef": "rel-newcomen" }],  // for approve_with_holds
  "instructions": "…",                       // required for return
  "reason": "…",                             // required for reject
  "duplicateOfSlug": "…" }                    // required for mark_duplicate (records a duplicate; NOT a deep merge)
```

The per-item `decision` set here is **authoritative** for promotion:
`approve` accepts every item (reviewer overrides QA holds);
`approve_with_holds` accepts all except the reviewer's holds (composite {section, localRef}) plus QA-held items. `mark_duplicate` records that the subject duplicates an existing canonical entity — it does NOT deep-merge/reparent data (a later dedicated cycle).
Held/rejected items stay in staging with their evidence — never deleted.
Approve/approve_with_holds trigger the atomic transactional promotion.
