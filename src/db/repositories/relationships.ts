/**
 * Relationship repository. Identity is (source, target, typeKey) from Cycle
 * 8A (legacy `type` used only for rows predating the registry). addRelationship
 * is safe against duplicates: it checks first and returns the existing row
 * with `created: false` rather than throwing, still relying on the DB unique
 * constraints under concurrent writers.
 */
import { and, eq, type SQL } from 'drizzle-orm';
import { relationships, type NewRelationship, type Relationship } from '../schema';
import type { Db } from './types';

export interface AddRelationshipResult {
  relationship: Relationship;
  created: boolean;
}

/** Durable identity predicate: prefer typeKey, fall back to the legacy enum. */
function relationshipIdentityWhere(input: NewRelationship): SQL | undefined {
  const base = and(
    eq(relationships.sourceEntityId, input.sourceEntityId),
    eq(relationships.targetEntityId, input.targetEntityId),
  );
  if (input.typeKey != null) return and(base, eq(relationships.typeKey, input.typeKey));
  if (input.type != null) return and(base, eq(relationships.type, input.type));
  return base;
}

export async function addRelationship(db: Db, input: NewRelationship): Promise<AddRelationshipResult> {
  const existing = await db.query.relationships.findFirst({
    where: relationshipIdentityWhere(input),
  });
  if (existing) return { relationship: existing, created: false };
  try {
    const [row] = await db.insert(relationships).values(input).returning();
    return { relationship: row, created: true };
  } catch (err) {
    const raceRow = await db.query.relationships.findFirst({
      where: relationshipIdentityWhere(input),
    });
    if (raceRow) return { relationship: raceRow, created: false };
    throw err;
  }
}

export async function listOutgoing(db: Db, entityId: string): Promise<Relationship[]> {
  return db.query.relationships.findMany({ where: eq(relationships.sourceEntityId, entityId) });
}

export async function listIncoming(db: Db, entityId: string): Promise<Relationship[]> {
  return db.query.relationships.findMany({ where: eq(relationships.targetEntityId, entityId) });
}

export async function listByType(
  db: Db,
  type: NonNullable<Relationship['type']>,
): Promise<Relationship[]> {
  return db.query.relationships.findMany({ where: eq(relationships.type, type) });
}

export async function listByTypeKey(db: Db, typeKey: string): Promise<Relationship[]> {
  return db.query.relationships.findMany({ where: eq(relationships.typeKey, typeKey) });
}

export async function findDirectConnections(db: Db, entityId: string): Promise<Relationship[]> {
  const [out, inc] = await Promise.all([listOutgoing(db, entityId), listIncoming(db, entityId)]);
  return [...out, ...inc];
}
