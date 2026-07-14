/**
 * Cycle 8B — auditable candidate editing in the Research Studio.
 *
 * Edits apply ONLY to normalized package items; the immutable submitted
 * envelope is never mutated, and nothing here writes canonical or yol_* rows.
 * Every edit operation is a SINGLE database transaction covering the candidate
 * mutation, QA invalidation/state update AND the append-only revision insert —
 * if any step fails (e.g. the audit insert) the whole edit rolls back, so no
 * partial or unaudited edit can remain.
 *
 * A MATERIAL edit (field / relationship type / endpoints / match) after QA
 * reverts the package to qa_pending and blocks approval until QA is rerun.
 * Review actions (hold/unhold, reject) are NOT material.
 *
 * Holds carry INDEPENDENT provenance: humanHeld and qaHeld are separate booleans
 * and may be true simultaneously; effective `held` is their OR. A QA rerun clears
 * only qaHeld; a human unhold clears only humanHeld. Removing one preserves the other.
 */
import { desc, eq } from 'drizzle-orm';
import {
  qaResults,
  researchPackageItemRevisions,
  researchPackageItems,
  researchPackages,
  entities,
  type ResearchPackageItem,
} from '../../db/schema';
import type { Db } from '../../db/repositories/types';
import {
  packageEntitySchema,
  packageRelationshipSchema,
  packageTimeSchema,
  packageClaimSchema,
} from '../../db/validation/research';
import { validateRelationshipEndpoints, getRelationshipVocabulary } from './vocabulary';

const EDITABLE_STATUSES = new Set(['submitted', 'qa_pending', 'qa_complete', 'in_review', 'returned']);
type EditKind = 'field_edit' | 'relationship_type' | 'relationship_endpoints' | 'canonical_match' | 'hold' | 'unhold' | 'reject_item';

export interface EditResult {
  item: ResearchPackageItem;
  invalidatedQa: boolean;
  packageStatus: string;
}

/** True if a QA result exists but is older than the package's last edit. */
export async function qaIsStale(db: Db, packageId: string): Promise<boolean> {
  const pkg = await db.query.researchPackages.findFirst({ where: eq(researchPackages.id, packageId) });
  if (!pkg || !pkg.lastEditedAt) return false;
  const [latestQa] = await db
    .select({ createdAt: qaResults.createdAt })
    .from(qaResults)
    .where(eq(qaResults.packageId, packageId))
    .orderBy(desc(qaResults.createdAt))
    .limit(1);
  if (!latestQa) return false;
  return pkg.lastEditedAt.getTime() > latestQa.createdAt.getTime();
}

async function loadEditable(tx: Db, itemId: string) {
  const item = await tx.query.researchPackageItems.findFirst({ where: eq(researchPackageItems.id, itemId) });
  if (!item) throw new Error(`package item ${itemId} not found`);
  const pkg = await tx.query.researchPackages.findFirst({ where: eq(researchPackages.id, item.packageId) });
  if (!pkg) throw new Error(`package ${item.packageId} not found`);
  if (!EDITABLE_STATUSES.has(pkg.status)) {
    throw new Error(`package ${pkg.id} is ${pkg.status}; candidate editing is only allowed before a final decision`);
  }
  return { item, pkg };
}

async function applyRevisionAndMaybeInvalidate(
  tx: Db,
  item: ResearchPackageItem,
  pkgStatus: string,
  editKind: EditKind,
  editor: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  material: boolean,
  note?: string,
): Promise<{ invalidatedQa: boolean; packageStatus: string }> {
  let invalidatedQa = false;
  let packageStatus = pkgStatus;
  if (material) {
    const hadQa = (await tx.select({ id: qaResults.id }).from(qaResults).where(eq(qaResults.packageId, item.packageId)).limit(1)).length > 0;
    const patch: Record<string, unknown> = { lastEditedAt: new Date(), updatedAt: new Date() };
    if (pkgStatus === 'qa_complete' || pkgStatus === 'in_review') {
      patch.status = 'qa_pending';
      packageStatus = 'qa_pending';
    }
    await tx.update(researchPackages).set(patch).where(eq(researchPackages.id, item.packageId));
    invalidatedQa = hadQa;
  }
  // The audit/revision insert is part of the SAME transaction: if it fails
  // (e.g. an empty editor violates the CHECK) the whole edit rolls back.
  await tx.insert(researchPackageItemRevisions).values({
    itemId: item.id, packageId: item.packageId, editKind, editor,
    beforeValue: before, afterValue: after, note, invalidatedQa,
  });
  return { invalidatedQa, packageStatus };
}

const SECTION_SCHEMAS = {
  entity: packageEntitySchema,
  relationship: packageRelationshipSchema,
  time: packageTimeSchema,
  claim: packageClaimSchema,
} as const;

function kindOfEntityRef(items: ResearchPackageItem[], ref: string): string | undefined {
  const e = items.find((i) => i.section === 'entity' && i.localRef === ref);
  if (!e) return undefined;
  const p = e.payload as { kind?: string; classifications?: string[] };
  return p.kind ?? p.classifications?.[0];
}

/** Material field edit of a candidate item's payload (validated + atomic). */
export async function editPackageItemFields(db: Db, itemId: string, patch: Record<string, unknown>, editor: string): Promise<EditResult> {
  return db.transaction(async (tx) => {
    const { item, pkg } = await loadEditable(tx, itemId);
    const before = item.payload as Record<string, unknown>;
    const merged = { ...before, ...patch };
    const schema = SECTION_SCHEMAS[item.section as keyof typeof SECTION_SCHEMAS];
    const validated = schema ? (schema.parse(merged) as unknown as Record<string, unknown>) : merged;
    const [updated] = await tx.update(researchPackageItems).set({ payload: validated }).where(eq(researchPackageItems.id, itemId)).returning();
    const r = await applyRevisionAndMaybeInvalidate(tx, item, pkg.status, 'field_edit', editor, before, validated, true);
    return { item: updated, invalidatedQa: r.invalidatedQa, packageStatus: r.packageStatus };
  });
}

/** Change a candidate relationship to another ACTIVE registry type valid for
 * its endpoint kinds. Material + atomic. */
export async function changeRelationshipType(db: Db, itemId: string, newTypeKey: string, editor: string): Promise<EditResult> {
  return db.transaction(async (tx) => {
    const { item, pkg } = await loadEditable(tx, itemId);
    if (item.section !== 'relationship') throw new Error('changeRelationshipType requires a relationship item');
    const before = item.payload as Record<string, unknown> & { sourceRef: string; targetRef: string };
    const items = (await tx.query.researchPackageItems.findMany()).filter((i) => i.packageId === item.packageId);
    const sk = kindOfEntityRef(items, before.sourceRef) ?? 'concept';
    const tk = kindOfEntityRef(items, before.targetRef) ?? 'concept';
    const check = await validateRelationshipEndpoints(tx, newTypeKey, sk, tk);
    if (!check.ok) throw new Error(`invalid relationship type change: ${check.reason}`);
    const after = { ...before, typeKey: newTypeKey };
    const [updated] = await tx.update(researchPackageItems).set({ payload: after }).where(eq(researchPackageItems.id, itemId)).returning();
    const r = await applyRevisionAndMaybeInvalidate(tx, item, pkg.status, 'relationship_type', editor, before, after, true);
    return { item: updated, invalidatedQa: r.invalidatedQa, packageStatus: r.packageStatus };
  });
}

/** Change a candidate relationship's endpoints (within-package entity refs). Material + atomic. */
export async function changeRelationshipEndpoints(db: Db, itemId: string, sourceRef: string, targetRef: string, editor: string): Promise<EditResult> {
  return db.transaction(async (tx) => {
    const { item, pkg } = await loadEditable(tx, itemId);
    if (item.section !== 'relationship') throw new Error('changeRelationshipEndpoints requires a relationship item');
    if (sourceRef === targetRef) throw new Error('a relationship cannot link an entity to itself');
    const before = item.payload as Record<string, unknown> & { typeKey: string };
    const items = (await tx.query.researchPackageItems.findMany()).filter((i) => i.packageId === item.packageId);
    const sk = kindOfEntityRef(items, sourceRef);
    const tk = kindOfEntityRef(items, targetRef);
    if (!sk || !tk) throw new Error('endpoint refs must be entity items in the package');
    const check = await validateRelationshipEndpoints(tx, String(before.typeKey), sk, tk);
    if (!check.ok) throw new Error(`invalid endpoints for type ${before.typeKey}: ${check.reason}`);
    const after = { ...before, sourceRef, targetRef };
    const [updated] = await tx.update(researchPackageItems).set({ payload: after }).where(eq(researchPackageItems.id, itemId)).returning();
    const r = await applyRevisionAndMaybeInvalidate(tx, item, pkg.status, 'relationship_endpoints', editor, before, after, true);
    return { item: updated, invalidatedQa: r.invalidatedQa, packageStatus: r.packageStatus };
  });
}

/** Human hold/unhold (review action — NOT material). Toggles ONLY the human
 * hold; a current QA hold is INDEPENDENT and preserved. Effective `held` is the
 * OR of the two, so removing a human hold cannot clear a simultaneous QA hold,
 * and adding a human hold never overwrites the QA hold. Atomic. */
export async function setItemHold(db: Db, itemId: string, held: boolean, editor: string): Promise<EditResult> {
  return db.transaction(async (tx) => {
    const { item, pkg } = await loadEditable(tx, itemId);
    const effective = held || item.qaHeld; // preserve any current QA hold
    const [updated] = await tx.update(researchPackageItems)
      .set({ humanHeld: held, held: effective })
      .where(eq(researchPackageItems.id, itemId)).returning();
    const r = await applyRevisionAndMaybeInvalidate(tx, item, pkg.status, held ? 'hold' : 'unhold', editor,
      { humanHeld: item.humanHeld, qaHeld: item.qaHeld, held: item.held },
      { humanHeld: held, qaHeld: item.qaHeld, held: effective }, false);
    return { item: updated, invalidatedQa: r.invalidatedQa, packageStatus: r.packageStatus };
  });
}

/** Reject an individual candidate item (review decision — not material). Atomic. */
export async function rejectPackageItem(db: Db, itemId: string, editor: string): Promise<EditResult> {
  return db.transaction(async (tx) => {
    const { item, pkg } = await loadEditable(tx, itemId);
    const [updated] = await tx.update(researchPackageItems).set({ decision: 'rejected', decidedAt: new Date() }).where(eq(researchPackageItems.id, itemId)).returning();
    const r = await applyRevisionAndMaybeInvalidate(tx, item, pkg.status, 'reject_item', editor, { decision: item.decision }, { decision: 'rejected' }, false);
    return { item: updated, invalidatedQa: r.invalidatedQa, packageStatus: r.packageStatus };
  });
}

/** Controlled canonical-match statuses. A match to a real canonical entity, or
 * an explicit "no match" verdict. Arbitrary free-text status is rejected. */
export const MATCH_STATUSES_WITH_ENTITY = ['canonical_complete', 'canonical_incomplete', 'confirmed_match'] as const;
export const MATCH_STATUSES_WITHOUT_ENTITY = ['new_candidate', 'no_match'] as const;
export const ALL_MATCH_STATUSES = [...MATCH_STATUSES_WITH_ENTITY, ...MATCH_STATUSES_WITHOUT_ENTITY] as const;

/**
 * Set/correct a candidate entity's canonical match (material -> invalidates QA).
 * Safe: a match status that asserts a canonical link REQUIRES a real canonical
 * entity id (validated to exist); clearing the match REQUIRES a no-entity
 * status. This prevents the previous bug where submitting a status with no id
 * silently cleared a real match. Atomic.
 */
export async function correctCanonicalMatch(db: Db, itemId: string, matchEntityId: string | null, matchStatus: string | null, editor: string): Promise<EditResult> {
  return db.transaction(async (tx) => {
    const { item, pkg } = await loadEditable(tx, itemId);
    if (item.section !== 'entity') throw new Error('canonical match applies to entity items');

    // Validate status vocabulary + status/id coherence.
    if (matchStatus !== null && !ALL_MATCH_STATUSES.includes(matchStatus as never)) {
      throw new Error(`invalid canonical match status "${matchStatus}"; allowed: ${ALL_MATCH_STATUSES.join(', ')}`);
    }
    if (matchEntityId) {
      if (matchStatus === null || !MATCH_STATUSES_WITH_ENTITY.includes(matchStatus as never)) {
        throw new Error(`a canonical match to an entity requires one of: ${MATCH_STATUSES_WITH_ENTITY.join(', ')}`);
      }
      const target = await tx.query.entities.findFirst({ where: eq(entities.id, matchEntityId) });
      if (!target) throw new Error(`canonical entity ${matchEntityId} does not exist`);
    } else {
      // No id: only a no-entity status (or null to fully clear) is allowed —
      // an asserting status without an id must NOT silently clear a real match.
      if (matchStatus !== null && !MATCH_STATUSES_WITHOUT_ENTITY.includes(matchStatus as never)) {
        throw new Error(`status "${matchStatus}" asserts a canonical link but no entity id was provided`);
      }
    }

    const before = { matchEntityId: item.matchEntityId, matchStatus: item.matchStatus };
    const [updated] = await tx.update(researchPackageItems).set({ matchEntityId, matchStatus }).where(eq(researchPackageItems.id, itemId)).returning();
    const r = await applyRevisionAndMaybeInvalidate(tx, item, pkg.status, 'canonical_match', editor, before, { matchEntityId, matchStatus }, true);
    return { item: updated, invalidatedQa: r.invalidatedQa, packageStatus: r.packageStatus };
  });
}

/** Revision history for a package (append-only, newest first). */
export async function listPackageRevisions(db: Db, packageId: string) {
  return db.query.researchPackageItemRevisions.findMany({
    where: eq(researchPackageItemRevisions.packageId, packageId),
    orderBy: [desc(researchPackageItemRevisions.createdAt)],
  });
}

export { getRelationshipVocabulary };
