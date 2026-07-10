/**
 * Relationship repository. addRelationship() is safe against the duplicate
 * (source, target, type) case: it checks first and returns the existing
 * row with `created: false` rather than throwing a constraint error, while
 * still relying on the DB unique constraint as the source of truth under
 * concurrent writers.
 */
import { and, eq } from 'drizzle-orm';
import { relationships, type NewRelationship, type Relationship } from '../schema';
import type { Db } from './types';

export interface AddRelationshipResult {
  relationship: Relationship;
  created: boolean;
}

export async function addRelationship(db: Db, input: NewRelationship): Promise<AddRelationshipResult> {
  const existing = await db.query.relationships.findFirst({
    where: and(
      eq(relationships.sourceEntityId, input.sourceEntityId),
      eq(relationships.targetEntityId, input.targetEntityId),
      eq(relationships.type, input.type),
    ),
  });
  if (existing) {
    return { relationship: existing, created: false };
  }
  try {
    const [row] = await db.insert(relationships).values(input).returning();
    return { relationship: row, created: true };
  } catch (err) {
    // Race: another writer inserted the same (source, target, type) between
    // our check and insert. Re-read and return it instead of surfacing the
    // constraint violation to the caller.
    const raceRow = await db.query.relationships.findFirst({
      where: and(
        eq(relationships.sourceEntityId, input.sourceEntityId),
        eq(relationships.targetEntityId, input.targetEntityId),
        eq(relationships.type, input.type),
      ),
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

export async function listByType(db: Db, type: Relationship['type']): Promise<Relationship[]> {
  return db.query.relationships.findMany({ where: eq(relationships.type, type) });
}

export async function findDirectConnections(db: Db, entityId: string): Promise<Relationship[]> {
  const [out, inc] = await Promise.all([listOutgoing(db, entityId), listIncoming(db, entityId)]);
  return [...out, ...inc];
}
