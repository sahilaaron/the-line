/**
 * Seed Inspector data endpoint (read-only).
 *
 * The FIRST and ONLY place the running app reads the DB. All SQL lives here in
 * a Node route handler, never in a React component — src/experience/** and
 * app/**.tsx only fetch this JSON, preserving the project's data/rendering
 * boundary. Reads the SAME PGlite directory the db:* seed scripts write to
 * (resolveDevDataDir(): PGLITE_DATA_DIR or `.pglite-data/dev`), reported back
 * as `dbPath` so it can be verified.
 *
 * Auto-detects the seed set (empty / prototype / synthetic). Curated anchors
 * are returned with full detail; the thousands of synthetic rows are only ever
 * summarised by count — never enumerated here and never rendered in the canvas.
 */
import { NextResponse } from 'next/server';
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { getDevDb } from '@/src/db/client/dev';
import { resolveDevDataDir } from '@/src/db/client/dev';
import {
  claims,
  claimSources,
  entities,
  media,
  periods,
  relationships,
  sources,
  yolCompositions,
  yolFeaturedEntities,
  yolThemes,
} from '@/src/db/schema';
import type { Db } from '@/src/db/repositories/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REVIEWED = new Set(['in_review', 'verified', 'published']);
type Provenance = 'prototype' | 'synthetic' | 'reviewed';
function provenance(isSynthetic: boolean, editorialStatus?: string | null): Provenance {
  if (isSynthetic) return 'synthetic';
  if (editorialStatus && REVIEWED.has(editorialStatus)) return 'reviewed';
  return 'prototype';
}

/** Cap on enumerated child rows per anchor (safety against dense synthetic nodes). */
const LIST_CAP = 40;

async function syntheticCount(
  db: Db,
  table: typeof entities | typeof periods | typeof relationships | typeof claims | typeof sources | typeof yolCompositions,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table)
    .where(eq(table.isSynthetic, true));
  return row?.n ?? 0;
}

export async function GET() {
  const dbPath = resolveDevDataDir();
  try {
    const db = getDevDb();

    const [
      entityCount,
      periodCount,
      relationshipCount,
      claimCount,
      sourceCount,
      mediaCount,
      yolCount,
    ] = await Promise.all([
      db.$count(entities),
      db.$count(periods),
      db.$count(relationships),
      db.$count(claims),
      db.$count(sources),
      db.$count(media),
      db.$count(yolCompositions),
    ]);

    const seeded = entityCount + periodCount + yolCount > 0;
    if (!seeded) {
      return NextResponse.json({
        seeded: false,
        dbPath,
        seedSet: 'empty',
        message:
          'No seeded data in this database. Run `npm run db:reset` then `npm run db:seed` (optionally `npm run db:seed:synthetic`).',
        counts: { entities: 0, periods: 0, relationships: 0, claims: 0, sources: 0, media: 0, yol: 0 },
        anchors: [],
      });
    }

    const [synEntities, synPeriods, synRelationships, synClaims, synSources] = await Promise.all([
      syntheticCount(db, entities),
      syntheticCount(db, periods),
      syntheticCount(db, relationships),
      syntheticCount(db, claims),
      syntheticCount(db, sources),
    ]);
    const hasSynthetic = synEntities + synPeriods + synRelationships > 0;

    const entityKinds = await db
      .select({ kind: entities.kind, n: sql<number>`count(*)::int` })
      .from(entities)
      .groupBy(entities.kind)
      .orderBy(desc(sql`count(*)`));

    // Curated anchors = periods carrying a non-synthetic composition with an
    // anchorSlug. NOT "every non-synthetic period": since the issue-14
    // chronology seed, per-event and context-year periods exist too and must
    // not be woven onto the Line as anchors.
    const yols = await db
      .select()
      .from(yolCompositions)
      .where(and(eq(yolCompositions.isSynthetic, false), isNotNull(yolCompositions.anchorSlug)));
    const yolByPeriod = new Map(yols.map((y) => [y.periodId, y]));
    const yolIds = yols.map((y) => y.id);

    const periodIds = yols.map((y) => y.periodId);
    const curated = periodIds.length
      ? await db
          .select()
          .from(periods)
          .where(and(eq(periods.isSynthetic, false), inArray(periods.id, periodIds)))
          .orderBy(asc(periods.startYear))
      : [];

    // Themes per YoL (join through the theme entity for its label).
    const themeRows = yolIds.length
      ? await db
          .select({ yolId: yolThemes.yolId, label: entities.label, importance: yolThemes.importance })
          .from(yolThemes)
          .innerJoin(entities, eq(yolThemes.themeEntityId, entities.id))
          .where(inArray(yolThemes.yolId, yolIds))
          .orderBy(desc(yolThemes.importance))
      : [];
    const themesByYol = new Map<string, { label: string; importance: number }[]>();
    for (const r of themeRows) {
      const a = themesByYol.get(r.yolId) ?? [];
      a.push({ label: r.label, importance: r.importance });
      themesByYol.set(r.yolId, a);
    }

    // Featured entities per YoL.
    const featRows = yolIds.length
      ? await db
          .select({
            yolId: yolFeaturedEntities.yolId,
            label: entities.label,
            kind: entities.kind,
            isSynthetic: entities.isSynthetic,
            editorialStatus: entities.editorialStatus,
          })
          .from(yolFeaturedEntities)
          .innerJoin(entities, eq(yolFeaturedEntities.entityId, entities.id))
          .where(inArray(yolFeaturedEntities.yolId, yolIds))
          .orderBy(asc(yolFeaturedEntities.displayOrder))
      : [];
    const featByYol = new Map<string, { label: string; kind: string; provenance: Provenance }[]>();
    for (const r of featRows) {
      const a = featByYol.get(r.yolId) ?? [];
      a.push({ label: r.label, kind: r.kind, provenance: provenance(r.isSynthetic, r.editorialStatus) });
      featByYol.set(r.yolId, a);
    }

    // Entities attached to each curated period (their primary period).
    const anchorEntities = periodIds.length
      ? await db
          .select({
            id: entities.id,
            periodId: entities.primaryPeriodId,
            label: entities.label,
            kind: entities.kind,
            isSynthetic: entities.isSynthetic,
            editorialStatus: entities.editorialStatus,
          })
          .from(entities)
          .where(inArray(entities.primaryPeriodId, periodIds))
      : [];
    const entIds = anchorEntities.map((e) => e.id);
    const entLabel = new Map(anchorEntities.map((e) => [e.id, e.label]));
    const entitiesByPeriod = new Map<string, typeof anchorEntities>();
    for (const e of anchorEntities) {
      if (!e.periodId) continue;
      const a = entitiesByPeriod.get(e.periodId) ?? [];
      a.push(e);
      entitiesByPeriod.set(e.periodId, a);
    }

    // Relationships touching any anchor entity (empty for the minimal prototype).
    const rels = entIds.length
      ? await db
          .select()
          .from(relationships)
          .where(or(inArray(relationships.sourceEntityId, entIds), inArray(relationships.targetEntityId, entIds)))
          .limit(LIST_CAP * 6)
      : [];

    // Claims about any anchor period or entity, with their sources.
    const claimWhere = [] as ReturnType<typeof and>[];
    if (periodIds.length) claimWhere.push(and(eq(claims.subjectType, 'period'), inArray(claims.subjectId, periodIds)));
    if (entIds.length) claimWhere.push(and(eq(claims.subjectType, 'entity'), inArray(claims.subjectId, entIds)));
    const anchorClaims = claimWhere.length
      ? await db.select().from(claims).where(or(...claimWhere)).limit(LIST_CAP * 6)
      : [];
    const claimIds = anchorClaims.map((c) => c.id);
    const srcRows = claimIds.length
      ? await db
          .select({
            claimId: claimSources.claimId,
            title: sources.title,
            type: sources.type,
            publicationYear: sources.publicationYear,
            isSynthetic: sources.isSynthetic,
          })
          .from(claimSources)
          .innerJoin(sources, eq(claimSources.sourceId, sources.id))
          .where(inArray(claimSources.claimId, claimIds))
      : [];
    const srcByClaim = new Map<string, { title: string; type: string; publicationYear: number | null; provenance: Provenance }[]>();
    for (const r of srcRows) {
      const a = srcByClaim.get(r.claimId) ?? [];
      a.push({ title: r.title, type: r.type, publicationYear: r.publicationYear, provenance: provenance(r.isSynthetic) });
      srcByClaim.set(r.claimId, a);
    }

    const anchors = curated.map((p) => {
      const yol = yolByPeriod.get(p.id);
      const myEntities = entitiesByPeriod.get(p.id) ?? [];
      const mySet = new Set(myEntities.map((e) => e.id));

      const outgoing = rels
        .filter((r) => mySet.has(r.sourceEntityId))
        .slice(0, LIST_CAP)
        .map((r) => ({
          type: r.type,
          other: entLabel.get(r.targetEntityId) ?? r.targetEntityId,
          strength: r.strength,
          confidence: r.confidence,
          disputed: r.disputed,
          provenance: provenance(r.isSynthetic, r.editorialStatus),
        }));
      const incoming = rels
        .filter((r) => mySet.has(r.targetEntityId))
        .slice(0, LIST_CAP)
        .map((r) => ({
          type: r.type,
          other: entLabel.get(r.sourceEntityId) ?? r.sourceEntityId,
          strength: r.strength,
          confidence: r.confidence,
          disputed: r.disputed,
          provenance: provenance(r.isSynthetic, r.editorialStatus),
        }));

      const periodEntityIds = new Set(myEntities.map((e) => e.id));
      const myClaims = anchorClaims
        .filter(
          (c) =>
            (c.subjectType === 'period' && c.subjectId === p.id) ||
            (c.subjectType === 'entity' && periodEntityIds.has(c.subjectId)),
        )
        .slice(0, LIST_CAP)
        .map((c) => ({
          text: c.text,
          verificationStatus: c.verificationStatus,
          disputed: c.disputed,
          provenance: provenance(c.isSynthetic),
          sources: srcByClaim.get(c.id) ?? [],
        }));

      return {
        slug: p.slug,
        label: p.label,
        displayYear: p.displayYear,
        startYear: p.startYear,
        period: {
          precision: p.precision,
          confidence: p.confidence,
          editorialStatus: p.editorialStatus,
          isPlaceholder: p.isPlaceholder,
          provenance: provenance(p.isSynthetic, p.editorialStatus),
        },
        yol: yol
          ? {
              title: yol.title,
              thesis: yol.thesis,
              supportingLine: yol.supportingLine,
              atmosphere: yol.atmospherePreset,
              editorialStatus: yol.editorialStatus,
              provenance: provenance(yol.isSynthetic, yol.editorialStatus),
            }
          : null,
        themes: yol ? themesByYol.get(yol.id) ?? [] : [],
        featured: yol ? featByYol.get(yol.id) ?? [] : [],
        entityCount: myEntities.length,
        relationships: { incoming, outgoing },
        claims: myClaims,
      };
    });

    return NextResponse.json({
      seeded: true,
      dbPath,
      seedSet: hasSynthetic ? 'synthetic' : 'prototype',
      hasSynthetic,
      generatedAt: new Date().toISOString(),
      counts: {
        entities: entityCount,
        periods: periodCount,
        relationships: relationshipCount,
        claims: claimCount,
        sources: sourceCount,
        media: mediaCount,
        yol: yolCount,
      },
      synthetic: {
        entities: synEntities,
        periods: synPeriods,
        relationships: synRelationships,
        claims: synClaims,
        sources: synSources,
      },
      prototype: {
        entities: entityCount - synEntities,
        periods: periodCount - synPeriods,
        relationships: relationshipCount - synRelationships,
        claims: claimCount - synClaims,
        sources: sourceCount - synSources,
      },
      entityKinds,
      anchors,
    });
  } catch (err) {
    return NextResponse.json(
      {
        seeded: false,
        dbError: true,
        dbPath,
        error: err instanceof Error ? err.message : String(err),
        message:
          'Could not read the local database at the path above. Run `npm run db:reset` then `npm run db:seed` first.',
      },
      { status: 200 },
    );
  }
}
