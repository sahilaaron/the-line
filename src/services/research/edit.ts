/**
 * Cycle 8B — auditable candidate editing in the Research Studio.
 *
 * Edits apply ONLY to normalized package items; the immutable submitted
 * envelope is never mutated, and nothing here writes canonical or yol_* rows.
 * Every edit appends a revision (editor, timestamp, before/after). A MATERIAL
 * edit (field/type/endpoints/match) invalidates a prior QA result: the package
 * reverts to qa_pending and approval is blocked until QA is rerun. Review
 * actions (hold/unhold/reject) are NOT material and do not invalidate QA.
 */
import { and, desc, eq } from 'drizzle-orm';
import {
  qaResults,
  researchPackageItemRevisions,
  researchPackageItems,
  researchPackages,
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

async function loadEditable(db: Db, itemId: string) {
  const item = await db.query.researchPackageItems.findFirst({ where: eq(researchPackageItems.id, itemId) });
  if (!item) throw new Error(`package item ${itemId} not found`);
  const pkg = await db.query.researchPackages.findFirst({ where: eq(researchPackages.id, item.packageId) });
  if (!pkg) throw new Error(`package ${item.packageId} not found`);
  if (!EDITABLE_STATUSES.has(pkg.status)) {
    throw new Error(`package ${pkg.id} is ${pkg.status}; candidate editing is only allowed before a final decision`);
  }
  return { item, pkg };
}

async function applyRevisionAndMaybeInvalidate(
  db: Db,
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
    // A prior QA result now becomes stale; revert to qa_pending for clarity.
    const hadQa = (await db.select({ id: qaResults.id }).from(qaResults).where(eq(qaResults.packageId, item.packageId)).limit(1)).length > 0;
    const patch: Record<string, unknown> = { lastEditedAt: new Date(), updatedAt: new Date() };
    if (pkgStatus === 'qa_complete' || pkgStatus === 'in_review') {
      patch.status = 'qa_pending';
      packageStatus = 'qa_pending';
    }
    await db.update(researchPackages).set(patch).where(eq(researchPackages.id, item.packageId));
    invalidatedQa = hadQa;
  }
  await db.insert(researchPackageItemRevisions).values({
    itemId: item.id,
    packageId: item.packageId,
    editKind,
    editor,
    beforeValue: before,
    afterValue: after,
    note,
    invalidatedQa,
  });
  return { invalidatedQa, packageStatus };
}

const SECTION_SCHEMAS = {
  entity: packageEntitySchema,
  relationship: packageRelationshipSchema,
  time: packageTimeSchema,
  claim: packageClaimSchema,
} as const;

/** Material field edit of a candidate item's payload (validated). */
export async function editPackageItemFields(
  db: Db,
  itemId: string,
  patch: Record<string, unknown>,
  editor: string,
): Promise<EditResult> {
  const { item, pkg } = await loadEditable(db, itemId);
  const before = item.payload as Record<string, unknown>;
  const merged = { ...before, ...patch };
  const schema = SECTION_SCHEMAS[item.section as keyof typeof SECTION_SCHEMAS];
  const validated = schema ? (schema.parse(merged) as unknown as Record<string, unknown>) : merged;
  const [updated] = await db
    .update(researchPackageItems)
    .set({ payload: validated })
    .where(eq(researchPackageItems.id, itemId))
    .returning();
  const { invalidatedQa, packageStatus } = await applyRevisionAndMaybeInvalidate(
    db, item, pkg.status, 'field_edit', editor, before, validated, true,
  );
  return { item: updated, invalidatedQa, packageStatus };
}

function kindOfEntityRef(items: ResearchPackageItem[], ref: string): string | undefined {
  const e = items.find((i) => i.section === 'entity' && i.localRef === ref);
  if (!e) return undefined;
  const p = e.payload as { kind?: string; classifications?: string[] };
  return p.kind ?? p.classifications?.[0];
}

/** Change a candidate relationship to another ACTIVE registry type valid for
 * its endpoint kinds. Material -> invalidates QA. */
export async function changeRelationshipType(
  db: Db,
  itemId: string,
  newTypeKey: string,
  editor: string,
): Promise<EditResult> {
  const { item, pkg } = await loadEditable(db, itemId);
  if (item.section !== 'relationship') throw new Error('changeRelationshipType requires a relationship item');
  const before = item.payload as Record<string, unknown> & { sourceRef: string; targetRef: string };
  const items = (await db.query.researchPackageItems.findMany()).filter((i) => i.packageId === item.packageId);
  const sk = kindOfEntityRef(items, before.sourceRef) ?? 'concept';
  const tk = kindOfEntityRef(items, before.targetRef) ?? 'concept';
  const check = await validateRelationshipEndpoints(db, newTypeKey, sk, tk);
  if (!check.ok) throw new Error(`invalid relationship type change: ${check.reason}`);
  const after = { ...before, typeKey: newTypeKey };
  const [updated] = await db
    .update(researchPackageItems)
    .set({ payload: after })
    .where(eq(researchPackageItems.id, itemId))
    .returning();
  const { invalidatedQa, packageStatus } = await applyRevisionAndMaybeInvalidate(
    db, item, pkg.status, 'relationship_type', editor, before, after, true,
  );
  return { item: updated, invalidatedQa, packageStatus };
}

/** Change a candidate relationship's endpoints (within-package entity refs).
 * Validates the refs exist and the endpoint kinds satisfy the current type. */
export async function changeRelationshipEndpoints(
  db: Db,
  itemId: string,
  sourceRef: string,
  targetRef: string,
  editor: string,
): Promise<EditResult> {
  const { item, pkg } = await loadEditable(db, itemId);
  if (item.section !== 'relationship') throw new Error('changeRelationshipEndpoints requires a relationship item');
  if (sourceRef === targetRef) throw new Error('a relationship cannot link an entity to itself');
  const before = item.payload as Record<string, unknown> & { typeKey: string };
  const items = (await db.query.researchPackageItems.findMany()).filter((i) => i.packageId === item.packageId);
  const sk = kindOfEntityRef(items, sourceRef);
  const tk = kindOfEntityRef(items, targetRef);
  if (!sk || !tk) throw new Error('endpoint refs must be entity items in the package');
  const check = await validateRelationshipEndpoints(db, String(before.typeKey), sk, tk);
  if (!check.ok) throw new Error(`invalid endpoints for type ${before.typeKey}: ${check.reason}`);
  const after = { ...before, sourceRef, targetRef };
  const [updated] = await db
    .update(researchPackageItems)
    .set({ payload: after })
    .where(eq(researchPackageItems.id, itemId))
    .returning();
  const { invalidatedQa, packageStatus } = await applyRevisionAndMaybeInvalidate(
    db, item, pkg.status, 'relationship_endpoints', editor, before, after, true,
  );
  return { item: updated, invalidatedQa, packageStatus };
}

/** Hold/unhold a candidate (review action — NOT material, does not invalidate QA). */
export async function setItemHold(db: Db, itemId: string, held: boolean, editor: string): Promise<EditResult> {
  const { item, pkg } = await loadEditable(db, itemId);
  const [updated] = await db
    .update(researchPackageItems)
    .set({ held })
    .where(eq(researchPackageItems.id, itemId))
    .returning();
  const { invalidatedQa, packageStatus } = await applyRevisionAndMaybeInvalidate(
    db, item, pkg.status, held ? 'hold' : 'unhold', editor, { held: item.held }, { held }, false,
  );
  return { item: updated, invalidatedQa, packageStatus };
}

/** Reject an individual candidate item (review decision — not material). */
export async function rejectPackageItem(db: Db, itemId: string, editor: string): Promise<EditResult> {
  const { item, pkg } = await loadEditable(db, itemId);
  const [updated] = await db
    .update(researchPackageItems)
    .set({ decision: 'rejected', decidedAt: new Date() })
    .where(eq(researchPackageItems.id, itemId))
    .returning();
  const { invalidatedQa, packageStatus } = await applyRevisionAndMaybeInvalidate(
    db, item, pkg.status, 'reject_item', editor, { decision: item.decision }, { decision: 'rejected' }, false,
  );
  return { item: updated, invalidatedQa, packageStatus };
}

/** Set/correct a candidate entity's canonical match (material -> invalidates QA). */
export async function correctCanonicalMatch(
  db: Db,
  itemId: string,
  matchEntityId: string | null,
  matchStatus: string | null,
  editor: string,
): Promise<EditResult> {
  const { item, pkg } = await loadEditable(db, itemId);
  if (item.section !== 'entity') throw new Error('canonical match applies to entity items');
  const before = { matchEntityId: item.matchEntityId, matchStatus: item.matchStatus };
  const [updated] = await db
    .update(researchPackageItems)
    .set({ matchEntityId, matchStatus })
    .where(eq(researchPackageItems.id, itemId))
    .returning();
  const { invalidatedQa, packageStatus } = await applyRevisionAndMaybeInvalidate(
    db, item, pkg.status, 'canonical_match', editor, before, { matchEntityId, matchStatus }, true,
  );
  return { item: updated, invalidatedQa, packageStatus };
}

/** Revision history for a package (append-only, newest first). */
export async function listPackageRevisions(db: Db, packageId: string) {
  return db.query.researchPackageItemRevisions.findMany({
    where: eq(researchPackageItemRevisions.packageId, packageId),
    orderBy: [desc(researchPackageItemRevisions.createdAt)],
  });
}

export { getRelationshipVocabulary };
void and;
