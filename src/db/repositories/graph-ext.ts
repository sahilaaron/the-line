/**
 * Repositories for the Cycle 8A canonical graph extensions: entity aliases,
 * external ids, classifications, typed time associations, and the
 * relationship-type registry. No raw SQL outside this layer.
 */
import { and, eq, inArray } from 'drizzle-orm';
import {
  entityAliases,
  entityClassifications,
  entityExternalIds,
  entityTimeAssociations,
  relationshipTypeRegistry,
  type NewEntityAlias,
  type NewEntityClassification,
  type NewEntityExternalId,
  type NewEntityTimeAssociation,
  type NewRelationshipTypeRegistryRow,
  type EntityAlias,
  type EntityExternalId,
  type EntityClassification,
  type EntityTimeAssociation,
  type RelationshipTypeRegistryRow,
} from '../schema';
import type { Db } from './types';

/** Canonical text normalization for alias/label matching: lowercase, strip
 * diacritics, collapse whitespace, drop surrounding punctuation. Pure. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/* ---- aliases ---- */
export async function addAlias(db: Db, input: Omit<NewEntityAlias, 'normalized'> & { normalized?: string }): Promise<EntityAlias> {
  const normalized = input.normalized ?? normalizeText(input.alias);
  const [row] = await db
    .insert(entityAliases)
    .values({ ...input, normalized })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  const existing = await db.query.entityAliases.findFirst({
    where: and(
      eq(entityAliases.entityId, input.entityId),
      eq(entityAliases.normalized, normalized),
      eq(entityAliases.aliasType, input.aliasType ?? 'alias'),
    ),
  });
  return existing!;
}

export async function listAliases(db: Db, entityId: string): Promise<EntityAlias[]> {
  return db.query.entityAliases.findMany({ where: eq(entityAliases.entityId, entityId) });
}

export async function findAliasMatches(db: Db, normalized: string): Promise<EntityAlias[]> {
  return db.query.entityAliases.findMany({ where: eq(entityAliases.normalized, normalized) });
}

/* ---- external ids ---- */
export async function addExternalId(db: Db, input: NewEntityExternalId): Promise<EntityExternalId> {
  const [row] = await db.insert(entityExternalIds).values(input).onConflictDoNothing().returning();
  if (row) return row;
  const existing = await db.query.entityExternalIds.findFirst({
    where: and(eq(entityExternalIds.scheme, input.scheme), eq(entityExternalIds.value, input.value)),
  });
  return existing!;
}

export async function findByExternalId(
  db: Db,
  scheme: EntityExternalId['scheme'],
  value: string,
): Promise<EntityExternalId | undefined> {
  return db.query.entityExternalIds.findFirst({
    where: and(eq(entityExternalIds.scheme, scheme), eq(entityExternalIds.value, value)),
  });
}

export async function listExternalIds(db: Db, entityId: string): Promise<EntityExternalId[]> {
  return db.query.entityExternalIds.findMany({ where: eq(entityExternalIds.entityId, entityId) });
}

/* ---- classifications ---- */
export async function addClassification(db: Db, input: NewEntityClassification): Promise<EntityClassification> {
  const [row] = await db.insert(entityClassifications).values(input).onConflictDoNothing().returning();
  if (row) return row;
  const existing = await db.query.entityClassifications.findFirst({
    where: and(
      eq(entityClassifications.entityId, input.entityId),
      eq(entityClassifications.classification, input.classification),
    ),
  });
  return existing!;
}

export async function listClassifications(db: Db, entityId: string): Promise<EntityClassification[]> {
  return db.query.entityClassifications.findMany({
    where: eq(entityClassifications.entityId, entityId),
  });
}

/* ---- time associations ---- */
export async function addTimeAssociation(db: Db, input: NewEntityTimeAssociation): Promise<EntityTimeAssociation> {
  const [row] = await db.insert(entityTimeAssociations).values(input).onConflictDoNothing().returning();
  if (row) return row;
  const existing = await db.query.entityTimeAssociations.findFirst({
    where: and(
      eq(entityTimeAssociations.entityId, input.entityId),
      eq(entityTimeAssociations.periodId, input.periodId),
      eq(entityTimeAssociations.role, input.role ?? 'existence'),
    ),
  });
  return existing!;
}

export async function listTimeAssociations(db: Db, entityId: string): Promise<EntityTimeAssociation[]> {
  return db.query.entityTimeAssociations.findMany({
    where: eq(entityTimeAssociations.entityId, entityId),
  });
}

/* ---- relationship-type registry ---- */
export async function registerRelationshipType(
  db: Db,
  input: NewRelationshipTypeRegistryRow,
): Promise<RelationshipTypeRegistryRow> {
  const [row] = await db
    .insert(relationshipTypeRegistry)
    .values(input)
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  return (await db.query.relationshipTypeRegistry.findFirst({
    where: eq(relationshipTypeRegistry.key, input.key),
  }))!;
}

export async function getRelationshipType(
  db: Db,
  key: string,
): Promise<RelationshipTypeRegistryRow | undefined> {
  return db.query.relationshipTypeRegistry.findFirst({
    where: eq(relationshipTypeRegistry.key, key),
  });
}

export async function listRelationshipTypes(db: Db): Promise<RelationshipTypeRegistryRow[]> {
  return db.query.relationshipTypeRegistry.findMany();
}

export async function listRelationshipTypesByKeys(
  db: Db,
  keys: string[],
): Promise<RelationshipTypeRegistryRow[]> {
  if (keys.length === 0) return [];
  return db.query.relationshipTypeRegistry.findMany({
    where: inArray(relationshipTypeRegistry.key, keys),
  });
}
