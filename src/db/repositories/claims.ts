import { and, eq, inArray } from 'drizzle-orm';
import { claimSources, claims, relationshipClaims, sources, type Claim, type NewClaim, type NewSource, type Source } from '../schema';
import type { Db } from './types';

export async function createClaim(db: Db, input: NewClaim): Promise<Claim> {
  const [row] = await db.insert(claims).values(input).returning();
  return row;
}

export async function createSource(db: Db, input: NewSource): Promise<Source> {
  const [row] = await db.insert(sources).values(input).returning();
  return row;
}

export async function linkClaimToSource(
  db: Db,
  claimId: string,
  sourceId: string,
  extra?: { quotation?: string; locator?: string },
): Promise<void> {
  await db
    .insert(claimSources)
    .values({ claimId, sourceId, quotation: extra?.quotation, locator: extra?.locator })
    .onConflictDoNothing();
}

export async function linkClaimToRelationship(db: Db, relationshipId: string, claimId: string): Promise<void> {
  await db.insert(relationshipClaims).values({ relationshipId, claimId }).onConflictDoNothing();
}

export async function findClaimById(db: Db, id: string): Promise<Claim | undefined> {
  return db.query.claims.findFirst({ where: eq(claims.id, id) });
}

export async function listClaimsForSubject(
  db: Db,
  subjectType: Claim['subjectType'],
  subjectId: string,
): Promise<Claim[]> {
  return db.query.claims.findMany({
    where: and(eq(claims.subjectType, subjectType), eq(claims.subjectId, subjectId)),
  });
}

export async function listSourcesForClaim(db: Db, claimId: string): Promise<Source[]> {
  const links = await db.query.claimSources.findMany({ where: eq(claimSources.claimId, claimId) });
  if (links.length === 0) return [];
  const ids = links.map((l) => l.sourceId);
  return db.query.sources.findMany({ where: inArray(sources.id, ids) });
}
