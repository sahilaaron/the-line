/**
 * Year on Line composition queries — build on the repository layer plus
 * the relationship traversal layer (for "related developments").
 */
import { and, eq, isNotNull } from 'drizzle-orm';
import * as repo from '../repositories';
import { periods, relationships, yolCompositions } from '../schema';
import type { Db } from '../repositories/types';
import type { YolComposition } from '../schema';

export async function compositionByYearOrPeriod(db: Db, year: number): Promise<YolComposition | undefined> {
  const containing = await repo.findExactYear(db, year);
  for (const period of containing) {
    const yol = await repo.findYolByPeriodId(db, period.id);
    if (yol) return yol;
  }
  return undefined;
}

export const activeThemesOrderedByImportance = repo.listActiveThemesOrderedByImportance;
export const featuredEntities = repo.listFeaturedEntities;

/** Entities connected to any of the YoL's featured entities via an incoming
 * or outgoing relationship — a light "what else is relevant" query. */
export async function relatedIncomingOutgoingDevelopments(db: Db, yolId: string) {
  const featured = await repo.listFeaturedEntities(db, yolId);
  const results: { entityId: string; relationship: (typeof relationships.$inferSelect) }[] = [];
  for (const f of featured) {
    const [out, inc] = await Promise.all([
      db.query.relationships.findMany({ where: eq(relationships.sourceEntityId, f.entityId) }),
      db.query.relationships.findMany({ where: eq(relationships.targetEntityId, f.entityId) }),
    ]);
    for (const r of out) results.push({ entityId: r.targetEntityId, relationship: r });
    for (const r of inc) results.push({ entityId: r.sourceEntityId, relationship: r });
  }
  return results;
}

/**
 * Nearest YoL composition to a target year, preferring an exact/containing
 * match, falling back to the nearest year that actually CARRIES an anchor
 * composition.
 *
 * Deliberately NOT `findNearestCuratedAnchor` + composition lookup: since
 * the local-chronology seed (issue #14), slugged periods also include
 * per-event and context-year rows (`evt-*`, `ctx-*`, `year-*`), so "any
 * slugged period" no longer identifies a parent-Line anchor. The honest
 * definition of an available destination is "a non-synthetic composition
 * with an anchorSlug", so search exactly that set.
 */
export async function nearestAvailableYolComposition(db: Db, year: number): Promise<YolComposition | undefined> {
  const exact = await compositionByYearOrPeriod(db, year);
  if (exact) return exact;
  const rows = await db
    .select({ yol: yolCompositions, displayYear: periods.displayYear, startYear: periods.startYear })
    .from(yolCompositions)
    .innerJoin(periods, eq(yolCompositions.periodId, periods.id))
    .where(and(eq(yolCompositions.isSynthetic, false), isNotNull(yolCompositions.anchorSlug)));
  let best: YolComposition | undefined;
  let bestDist = Infinity;
  for (const r of rows) {
    const y = r.displayYear ?? r.startYear;
    if (y === null) continue;
    const dist = Math.abs(y - year);
    if (dist < bestDist) {
      bestDist = dist;
      best = r.yol;
    }
  }
  return best;
}
