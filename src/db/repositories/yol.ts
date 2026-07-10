import { asc, eq, inArray } from 'drizzle-orm';
import {
  entities,
  yolCompositions,
  yolFeaturedEntities,
  yolSceneHints,
  yolThemes,
  type NewYolComposition,
  type YolComposition,
} from '../schema';
import type { Db } from './types';

export async function createYolComposition(db: Db, input: NewYolComposition): Promise<YolComposition> {
  const [row] = await db.insert(yolCompositions).values(input).returning();
  return row;
}

export async function findYolByAnchorSlug(db: Db, anchorSlug: string): Promise<YolComposition | undefined> {
  return db.query.yolCompositions.findFirst({ where: eq(yolCompositions.anchorSlug, anchorSlug) });
}

export async function findYolByPeriodId(db: Db, periodId: string): Promise<YolComposition | undefined> {
  return db.query.yolCompositions.findFirst({ where: eq(yolCompositions.periodId, periodId) });
}

export async function listActiveThemesOrderedByImportance(db: Db, yolId: string) {
  const rows = await db.query.yolThemes.findMany({
    where: eq(yolThemes.yolId, yolId),
    orderBy: [asc(yolThemes.displayOrder)],
  });
  return [...rows].sort((a, b) => b.importance - a.importance);
}

export async function listSceneHints(db: Db, yolId: string) {
  return db.query.yolSceneHints.findMany({ where: eq(yolSceneHints.yolId, yolId) });
}

export async function listFeaturedEntities(db: Db, yolId: string) {
  const rows = await db.query.yolFeaturedEntities.findMany({
    where: eq(yolFeaturedEntities.yolId, yolId),
    orderBy: [asc(yolFeaturedEntities.displayOrder)],
  });
  if (rows.length === 0) return [];
  const entityRows = await db.query.entities.findMany({
    where: inArray(entities.id, rows.map((r) => r.entityId)),
  });
  const byId = new Map(entityRows.map((e) => [e.id, e]));
  return rows.map((r) => ({ ...r, entity: byId.get(r.entityId) })).filter((r) => r.entity);
}
