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
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';
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
import { ALL_MATCH_STATUSES, MATCH_STATUSES_WITHOUT_ENTITY, kindsCompatible, deriveMatchStatus, compatibleKinds } from './match-compat';
export { ALL_MATCH_STATUSES, MATCH_STATUSES_WITH_ENTITY, MATCH_STATUSES_WITHOUT_ENTITY, kindsCompatible, deriveMatchStatus } from './match-compat';

const EDITABLE_STATUSES = new Set(['submitted', 'qa_pending', 'qa_complete', 'in_review', 'returned']);
type EditKind = 'field_edit' | 'relationship_type' | 'relationship_endpoints' | 'canonical_match' | 'hold' | 'unhold' | 'reject_item' | 'clear_agent_hold' | 'confirm_agent_hold';

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

/**
 * Fields the GENERIC editor may change, per section (strict allowlist). Governed
 * structural fields are deliberately EXCLUDED and must go through their dedicated
 * services: relationship type -> changeRelationshipType; relationship endpoints
 * -> changeRelationshipEndpoints; canonical match -> correctCanonicalMatch; holds
 * -> setItemHold; item rejection -> rejectPackageItem. This closes the bypass
 * where the generic field editor could rewrite typeKey/sourceRef/targetRef with
 * only the loose Zod shape and skip registry/endpoint/synthetic governance.
 */
const GENERIC_EDITABLE_FIELDS: Record<string, ReadonlySet<string>> = {
  entity: new Set(['label', 'slug', 'shortDescription', 'aliases', 'externalIds']),
  relationship: new Set(['explanation', 'confidence', 'strength', 'assertionClass', 'disputed', 'startYear', 'endYear']),
  time: new Set(['label', 'startYear', 'endYear', 'precision', 'note', 'confidence']),
  claim: new Set(['text', 'assertionClass', 'confidence', 'verification']),
};

/** Material field edit of a candidate item's payload (allowlisted + validated + atomic). */
export async function editPackageItemFields(db: Db, itemId: string, patch: Record<string, unknown>, editor: string): Promise<EditResult> {
  return db.transaction(async (tx) => {
    const { item, pkg } = await loadEditable(tx, itemId);
    // Reject any field not on the section allowlist BEFORE touching anything —
    // this is the server-side guard; hidden client form fields are not trusted.
    const allowed = GENERIC_EDITABLE_FIELDS[item.section];
    if (!allowed) throw new Error(`section ${item.section} has no generically-editable fields`);
    for (const key of Object.keys(patch)) {
      if (!allowed.has(key)) {
        throw new Error(`field "${key}" cannot be changed through the generic editor; use the dedicated governed service`);
      }
    }
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
    const effective = held || item.qaHeld || item.agentHeld; // preserve current QA/agent holds
    const [updated] = await tx.update(researchPackageItems)
      .set({ humanHeld: held, held: effective })
      .where(eq(researchPackageItems.id, itemId)).returning();
    const r = await applyRevisionAndMaybeInvalidate(tx, item, pkg.status, held ? 'hold' : 'unhold', editor,
      { humanHeld: item.humanHeld, qaHeld: item.qaHeld, agentHeld: item.agentHeld, held: item.held },
      { humanHeld: held, qaHeld: item.qaHeld, agentHeld: item.agentHeld, held: effective }, false);
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

/**
 * Set/correct a candidate entity's canonical match (material -> invalidates QA).
 * Hardened: the target must be a real, NON-synthetic canonical entity of a
 * compatible kind; the status is DERIVED from the target's completeness (a
 * caller-supplied status must agree or is rejected). Clearing requires a
 * no-entity status, so a status can never silently clear a real match. These
 * checks run server-side, so a forged client action cannot bypass them. Atomic.
 */
export async function correctCanonicalMatch(db: Db, itemId: string, matchEntityId: string | null, matchStatus: string | null, editor: string): Promise<EditResult> {
  return db.transaction(async (tx) => {
    const { item, pkg } = await loadEditable(tx, itemId);
    if (item.section !== 'entity') throw new Error('canonical match applies to entity items');

    if (matchStatus !== null && !ALL_MATCH_STATUSES.includes(matchStatus as never)) {
      throw new Error(`invalid canonical match status "${matchStatus}"; allowed: ${ALL_MATCH_STATUSES.join(', ')}`);
    }

    let finalStatus: string | null;
    if (matchEntityId) {
      const target = await tx.query.entities.findFirst({ where: eq(entities.id, matchEntityId) });
      if (!target) throw new Error(`canonical entity ${matchEntityId} does not exist`);
      // Synthetic entities are never valid canonical-match targets — enforced on
      // the server even if a client submits the id directly.
      if (target.isSynthetic) throw new Error(`entity ${matchEntityId} is synthetic and cannot be a canonical-match target`);
      // Kind compatibility.
      const p = item.payload as { kind?: string; classifications?: string[] };
      const candidateKind = p.kind ?? p.classifications?.[0] ?? 'concept';
      if (!kindsCompatible(candidateKind, target.kind)) {
        throw new Error(`incompatible kinds: a ${candidateKind} candidate cannot match a ${target.kind} entity`);
      }
      // Status is derived from the target; a supplied status must agree.
      const derived = deriveMatchStatus(target.graphStatus);
      if (matchStatus !== null && matchStatus !== derived) {
        throw new Error(`match status must be "${derived}" (derived from the target's ${target.graphStatus} state), not "${matchStatus}"`);
      }
      finalStatus = derived;
    } else {
      // No id: only a no-entity status (or null to fully clear) is allowed.
      if (matchStatus !== null && !MATCH_STATUSES_WITHOUT_ENTITY.includes(matchStatus as never)) {
        throw new Error(`status "${matchStatus}" asserts a canonical link but no entity id was provided`);
      }
      finalStatus = matchStatus;
    }

    const before = { matchEntityId: item.matchEntityId, matchStatus: item.matchStatus };
    const [updated] = await tx.update(researchPackageItems).set({ matchEntityId, matchStatus: finalStatus }).where(eq(researchPackageItems.id, itemId)).returning();
    const r = await applyRevisionAndMaybeInvalidate(tx, item, pkg.status, 'canonical_match', editor, before, { matchEntityId, matchStatus: finalStatus }, true);
    return { item: updated, invalidatedQa: r.invalidatedQa, packageStatus: r.packageStatus };
  });
}

export interface MatchTarget { id: string; label: string; slug: string; kind: string; graphStatus: string; matchStatus: string }

/**
 * Server-side, scalable search for valid canonical-match targets. Excludes
 * synthetic entities and restricts to kinds compatible with the candidate, with
 * a bounded page size (no silent "latest 300 rows" cap). The derived status is
 * returned so the picker shows the status that WILL be applied.
 */
export async function searchCanonicalMatchTargets(
  db: Db,
  opts: { term?: string; candidateKind: string; limit?: number },
): Promise<MatchTarget[]> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const kinds = compatibleKinds(opts.candidateKind);
  const term = (opts.term ?? '').trim();
  const where = term
    ? and(
        eq(entities.isSynthetic, false),
        inArray(entities.kind, kinds as never),
        or(ilike(entities.label, `%${term}%`), ilike(entities.slug, `%${term}%`)),
      )
    : and(eq(entities.isSynthetic, false), inArray(entities.kind, kinds as never));
  const rows = await db
    .select({ id: entities.id, label: entities.label, slug: entities.slug, kind: entities.kind, graphStatus: entities.graphStatus })
    .from(entities)
    .where(where)
    .orderBy(entities.label)
    .limit(limit);
  return rows.map((r) => ({ ...r, matchStatus: deriveMatchStatus(r.graphStatus) }));
}

/**
 * Governed human resolution of an AGENT-proposed hold — "Clear agent hold". The
 * reviewer determined the item does NOT need to remain held: clears agentHeld
 * only, preserves humanHeld and qaHeld, recomputes effective held. Atomic; a
 * revision records the prior and resulting hold sources, reviewer, timestamp and
 * reason. Allowed only before a final package decision (loadEditable enforces
 * this). It never touches a QA or human hold. */
export async function clearAgentHold(db: Db, itemId: string, editor: string, reason?: string): Promise<EditResult> {
  return db.transaction(async (tx) => {
    const { item, pkg } = await loadEditable(tx, itemId);
    if (!item.agentHeld) throw new Error(`item ${itemId} has no agent hold to clear`);
    const effective = item.humanHeld || item.qaHeld;
    const [updated] = await tx.update(researchPackageItems)
      .set({ agentHeld: false, held: effective })
      .where(eq(researchPackageItems.id, itemId)).returning();
    const r = await applyRevisionAndMaybeInvalidate(
      tx, item, pkg.status, 'clear_agent_hold', editor,
      { humanHeld: item.humanHeld, qaHeld: item.qaHeld, agentHeld: true, held: item.held },
      { humanHeld: item.humanHeld, qaHeld: item.qaHeld, agentHeld: false, held: effective },
      false, reason ?? 'reviewer cleared the agent-proposed hold',
    );
    return { item: updated, invalidatedQa: r.invalidatedQa, packageStatus: r.packageStatus };
  });
}

/**
 * Governed human resolution of an AGENT-proposed hold — "Confirm as human hold".
 * The reviewer AGREES the item should remain held: transfers the agent hold into
 * a HUMAN hold (humanHeld=true, agentHeld=false), preserves qaHeld, effective
 * held stays true. Atomic + audited; allowed only before a final decision. */
export async function confirmAgentHoldAsHuman(db: Db, itemId: string, editor: string, reason?: string): Promise<EditResult> {
  return db.transaction(async (tx) => {
    const { item, pkg } = await loadEditable(tx, itemId);
    if (!item.agentHeld) throw new Error(`item ${itemId} has no agent hold to confirm`);
    const [updated] = await tx.update(researchPackageItems)
      .set({ agentHeld: false, humanHeld: true, held: true })
      .where(eq(researchPackageItems.id, itemId)).returning();
    const r = await applyRevisionAndMaybeInvalidate(
      tx, item, pkg.status, 'confirm_agent_hold', editor,
      { humanHeld: item.humanHeld, qaHeld: item.qaHeld, agentHeld: true, held: item.held },
      { humanHeld: true, qaHeld: item.qaHeld, agentHeld: false, held: true },
      false, reason ?? 'reviewer confirmed the agent hold as a human hold',
    );
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
