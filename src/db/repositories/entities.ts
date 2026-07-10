/**
 * Entity repository: typed CRUD + query functions. No raw SQL outside this
 * layer — everything else (queries/, seed/, scripts/) goes through here.
 */
import { and, count, eq, ilike, inArray } from 'drizzle-orm';
import { entities, type Entity, type NewEntity } from '../schema';
import type { Db } from './types';

export async function createEntity(db: Db, input: NewEntity): Promise<Entity> {
  const [row] = await db.insert(entities).values(input).returning();
  return row;
}

export async function updateEntity(
  db: Db,
  id: string,
  patch: Partial<Omit<NewEntity, 'id'>>,
): Promise<Entity | undefined> {
  const [row] = await db
    .update(entities)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(entities.id, id))
    .returning();
  return row;
}

export async function findEntityById(db: Db, id: string): Promise<Entity | undefined> {
  return db.query.entities.findFirst({ where: eq(entities.id, id) });
}

export async function findEntityBySlug(db: Db, slug: string): Promise<Entity | undefined> {
  return db.query.entities.findFirst({ where: eq(entities.slug, slug) });
}

export async function listEntitiesByKind(db: Db, kind: Entity['kind']): Promise<Entity[]> {
  return db.query.entities.findMany({ where: eq(entities.kind, kind) });
}

export async function searchEntitiesByLabel(db: Db, term: string, limit = 20): Promise<Entity[]> {
  return db.query.entities.findMany({
    where: ilike(entities.label, `%${term}%`),
    limit,
  });
}

/** Archival is a soft delete via editorialStatus, never a row delete. */
export async function archiveEntity(db: Db, id: string): Promise<Entity | undefined> {
  const [row] = await db
    .update(entities)
    .set({ editorialStatus: 'archived', updatedAt: new Date() })
    .where(eq(entities.id, id))
    .returning();
  return row;
}

export async function listEntitiesByIds(db: Db, ids: string[]): Promise<Entity[]> {
  if (ids.length === 0) return [];
  return db.query.entities.findMany({ where: inArray(entities.id, ids) });
}

export async function countEntities(db: Db): Promise<number> {
  const [row] = await db.select({ value: count() }).from(entities);
  return row?.value ?? 0;
}

// re-exported for callers that need to build custom `and(...)` filters
export { and, eq };
