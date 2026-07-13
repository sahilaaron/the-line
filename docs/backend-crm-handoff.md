# Backend / CRM Handoff — The Contract Behind the World Renderers

**Audience: the future Opus backend/CRM cycle (issue #5 lineage).** This is
NOT an implementation plan for the current frontend — it is the contract
the CRM must satisfy so the Historical Field and Topic World renderers
never need rewriting. Companion documents:
`docs/database/research-handoff.md` (canonical historical-truth tables from
cycle 6) and `src/domain/worlds.ts` (the authoritative type definitions —
this document describes them; the code file wins on any drift).

## 1. The boundary

```
CRM / database / API adapter          (future cycle builds THIS)
        ↓ implements
HistoricalWorldDataSource             (src/domain/worlds.ts)
        ↓ returns
domain view models (HistoricalFieldVM, TopicWorldVM, …)
        ↓ consumed by
the experience renderers              (already built; do not touch)
```

Today `src/data/worlds/mock-adapter.ts` implements the interface with
prototype content. The CRM cycle replaces `getWorldDataSource()` with an
API-backed adapter (likely an `/api/worlds/...` route pair mirroring the
proven `/api/yol/[anchorSlug]` pattern: typed envelopes, no leaked
internals, synthetic exclusion at the query boundary). The renderers, the
world stack, the layout algorithm and the tests do not change.

## 2. Required API reads

- `getHistoricalField({ rangeStart, rangeEnd, focusYear })` →
  `HistoricalFieldVM` — every publishable record whose time intersects
  the range. The renderer windows by ±(visibleRadius+overscan) years
  client-side; the API may later accept a window hint for very dense
  ranges, but MUST keep returning stable ids.
- `getTopicWorld(slug)` → `TopicWorldVM` — one world with ordered
  chapters, identity tokens and related topics.
- Both: cacheable, idempotent, fast (they are awaited inside descent /
  push transitions — the lock releases only when data is ready).

## 3. Fields the CRM must store and edit

### Historical records (→ HistoricalFieldItemVM)
- identity: `slug` (stable, public), kind (person/invention/discovery/
  event/organisation/place/idea).
- copy: `title`, `summary` (short), editorial status.
- time: `startYear`, optional `endYear` (astronomical integers; sub-year
  precision may reuse cycle 6's periods columns), `dateLabel`,
  `datePrecision` (day/month/year/range/approximate).
- weighting: `prominence` 0–100 (drives size/z/lane priority),
  `themeKeys`.
- linking: optional `topicWorldSlug` (what the record opens).
- provenance: `placeholder | reviewed` + editorialStatus (same rules as
  cycle 6: reviewed requires isPlaceholder=false AND
  in_review/verified/published).

### Temporal collage composition (per record, ALL optional)
- `preferredLane` (0–3), `sizeClass` (small/medium/large), `offsetX` /
  `offsetY` (vw/vh fine-tuning), `depth` (0–2 parallax layer).
- The deterministic layout works with none of these; they are editorial
  overrides and must never be required. The CRM should preview their
  effect (see §6).

### Topic chapters (→ TopicChapterVM)
- ordered list per world: `title`, `body` (short editorial copy), media
  refs, optional `relatedTopicSlug` + `relatedTopicTitle` (a doorway).
- world-level: `title`, `supportingLine`, `dateLabel`, `kind`,
  `relatedTopics[]`, identity token set (background/foreground/muted/
  accent/secondaryAccent/surface/atmosphere/typeTreatment/
  motionCharacter/textureTreatment) — identity is DESIGN data curated by
  humans, validated against the renderer's known atmosphere/type/motion
  keys.

### Media (→ HistoricalMediaVM)
- `src` (empty = placeholder plate), `alt` (required), `aspectRatio`,
  optional crop, `mediaType`, `rightsStatus`, `provenance`,
  `placeholder` flag.
- Rights rules carry over from the identity system: generated or
  reconstructed media is NEVER labelled archival; no rights claims on
  non-archival media; placeholder media carries no rights claims at all.

### Relationships between topic worlds
- typed links (slug ↔ slug) with a display title and kind; these power
  `relatedTopics` and chapter doorways. Historical-truth relationships
  (influenced/enabled/…) stay in the cycle-6 `relationships` table —
  world-to-world doorways are CURATION, not historical claims.

## 4. Publication rules

- `placeholder` content renders publicly ONLY with its provisional
  labelling (the renderers add it; the CRM must not strip it).
- `reviewed` requires the cycle-6 provenance rule (non-placeholder +
  reviewed editorial status) AND human editorial approval.
- Synthetic/stress records must be excluded at the API query boundary
  (the proven pattern in `src/db/queries/yol-read-model.ts`).
- A research agent may WRITE candidate historical truth (periods,
  entities, claims, sources — per docs/database/research-handoff.md) but
  must NEVER directly publish: no direct writes to prominence, collage
  composition, topic chapters, identity tokens, `topicWorldSlug` links,
  or any editorialStatus promotion. Those are human-curated surfaces.

## 5. Editing surfaces the CRM needs

1. Historical-record editor (fields above + provenance workflow).
2. Range/field browser: all records in a date range, ordered by year ×
   prominence, with density warnings (>18 visible near one year).
3. Topic World editor: chapters (ordered, with doorway pickers limited
   to existing worlds), identity token editor with palette preview.
4. Media manager: uploads later; today `src`+rights+alt metadata.
5. Publication queue: placeholder → reviewed promotions with diffs.

## 6. Previewing the public renderer

The renderer is data-driven end to end, so preview = run the app against
a staging adapter: point `getWorldDataSource()` at a
staging-API-backed implementation behind an env flag (mirror
`PGLITE_DATA_DIR`'s pattern). The `?debug=1&tune.<key>=<value>` URL
tuning lets editors judge composition changes live. Deterministic layout
guarantees the preview equals production for the same data + seed.

## 7. What stays out of the database

The Year Visual Identity system, the world-stack navigation, tuning
values, lane geometry and the placeholder plate treatments are FRONTEND
design/architecture. The CRM stores content, weights, identity TOKENS and
composition OVERRIDES — never CSS, never layout code, never transition
choreography.
