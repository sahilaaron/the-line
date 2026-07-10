# Query Cookbook

All examples assume:

```ts
import { getDevDb } from '@/src/db/client/dev'; // CLI/script context
// or, in a test: const { db } = await freshMigratedDb();
const db = getDevDb();
```

## Entities

```ts
import * as repo from '@/src/db/repositories';

await repo.createEntity(db, { slug: 'steam-engine', kind: 'invention', label: 'Steam Engine' });
await repo.findEntityBySlug(db, 'steam-engine');
await repo.listEntitiesByKind(db, 'invention');
await repo.searchEntitiesByLabel(db, 'steam');
await repo.archiveEntity(db, entityId); // soft delete (editorialStatus: 'archived')
```

## Periods

```ts
await repo.findExactYear(db, 1969);                 // periods containing year 1969
await repo.findContainingRange(db, -100, 100);       // periods fully containing this range
await repo.listOverlappingPeriods(db, 1900, 2000);   // periods overlapping at all
await repo.findNearestCuratedAnchor(db, 1975);       // nearest slugged (curated) period
```

## Relationships

```ts
const { relationship, created } = await repo.addRelationship(db, {
  sourceEntityId: a.id,
  targetEntityId: b.id,
  type: 'influenced',
  confidence: 70,
});
await repo.listOutgoing(db, a.id);
await repo.listIncoming(db, b.id);
await repo.listByType(db, 'part_of');
```

## Graph traversal

```ts
import { ancestry, consequences, neighbourhood, shortestConnection } from '@/src/db/queries';

await ancestry(db, entityId, { maxDepth: 3 });
await consequences(db, entityId, { maxDepth: 3, minConfidence: 50 });
await neighbourhood(db, entityId, { maxDepth: 2, relationshipTypes: ['influenced', 'enabled'] });
await shortestConnection(db, fromId, toId, { maxDepth: 6 });
```

Every result includes `path` (the ordered list of relationship steps), not
just the endpoint id — so a caller can render "how are these connected."

## Year on Line

```ts
import { compositionByYearOrPeriod, activeThemesOrderedByImportance, featuredEntities, nearestAvailableYolComposition } from '@/src/db/queries';

const yol = await compositionByYearOrPeriod(db, 1969);
await activeThemesOrderedByImportance(db, yol.id);
await featuredEntities(db, yol.id);
await nearestAvailableYolComposition(db, 1975); // falls back to nearest curated anchor
```

### Read model for the rendered YoL (Cycle 6)

`GET /api/yol/[anchorSlug]` feeds the public Year-on-Line experience through
ONE query. It is the canonical read side of the local-timeline world:

```ts
import { yolReadModelByAnchorSlug } from '@/src/db/queries/yol-read-model';

const model = await yolReadModelByAnchorSlug(db, '1969');
// undefined            -> no composition for that slug (client -> fallback)
// model.points.length  -> 0 means migrated-but-unseeded (route reports `empty`)
// model.points[]       -> ordered stations (role, date parts, themes, claims,
//                         sources, provenance); model.themes[] -> lens tags
```

Contract and BCE-safe date formatting live in `src/domain/yol-read-model.ts`;
the API route (`app/api/yol/[anchorSlug]/route.ts`) only wraps this in a typed
envelope and never leaks paths, SQL or stacks.

**Synthetic exclusion is enforced HERE, at the query boundary.** Every join
in `yolReadModelByAnchorSlug` filters `isSynthetic = false` (composition,
period, theme entities, timeline points, claims, sources, media), so synthetic
stress rows (`db:seed:synthetic`) can never reach a rendered YoL. A point's
`provenance` is derived from `isPlaceholder` + `editorialStatus`
(`reviewed` only when not a placeholder and in a reviewed/verified/published
status; otherwise `placeholder`). See
[`research-handoff.md`](./research-handoff.md) for what the research pipeline
may write and which statuses make data publicly renderable.

## Integrity audit

```ts
import { runIntegrityAudit } from '@/src/db/queries/audit';
const report = await runIntegrityAudit(db);
// report.totals / report.warnings / report.errors
```

## Export / import

```ts
import { exportDatabase, exportYolClosure } from '@/src/db/import-export/export';
import { importFixture } from '@/src/db/import-export/import';

const payload = await exportDatabase(db);
const closure = await exportYolClosure(db, yolId);
const summary = await importFixture(targetDb, payload, { dryRun: true });
```
