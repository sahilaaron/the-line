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

/* ------------------------------------------------------------------ */
/* Local chronology (yol_timeline_points)                             */
/* ------------------------------------------------------------------ */

import {
  yolPointThemes,
  type NewYolPointTheme,
  type NewYolTimelinePoint,
  type YolTimelinePoint,
  yolTimelinePoints,
} from '../schema';

export async function createTimelinePoint(db: Db, input: NewYolTimelinePoint): Promise<YolTimelinePoint> {
  const [row] = await db.insert(yolTimelinePoints).values(input).returning();
  return row;
}

export async function addPointTheme(db: Db, input: NewYolPointTheme) {
  const [row] = await db.insert(yolPointThemes).values(input).onConflictDoNothing().returning();
  return row;
}

/** Ordered local chronology of a composition (displayOrder ascending —
 *  the authoritative, curated total order). */
export async function listTimelinePoints(db: Db, yolId: string): Promise<YolTimelinePoint[]> {
  return db.query.yolTimelinePoints.findMany({
    where: eq(yolTimelinePoints.yolId, yolId),
    orderBy: [asc(yolTimelinePoints.displayOrder)],
  });
}

export async function listPointThemes(db: Db, pointIds: string[]) {
  if (pointIds.length === 0) return [];
  return db.query.yolPointThemes.findMany({ where: inArray(yolPointThemes.pointId, pointIds) });
}

/** Existence check used by the idempotent seed: a point in this
 *  composition for this entity (or this role, for subject-less points). */
export async function findTimelinePointByEntity(db: Db, yolId: string, entityId: string) {
  return db.query.yolTimelinePoints.findFirst({
    where: (t, { and: andOp, eq: eqOp }) => andOp(eqOp(t.yolId, yolId), eqOp(t.entityId, entityId)),
  });
}

export async function findTimelinePointByRole(db: Db, yolId: string, role: YolTimelinePoint['role']) {
  return db.query.yolTimelinePoints.findFirst({
    where: (t, { and: andOp, eq: eqOp }) => andOp(eqOp(t.yolId, yolId), eqOp(t.role, role)),
  });
}
