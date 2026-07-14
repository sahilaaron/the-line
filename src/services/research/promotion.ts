/**
 * Promotion: the ONE path from an approved package into the private canonical
 * graph. It runs INSIDE the caller's transaction (`promoteWithinTx`) so the
 * human decision, item decisions, canonical writes, frontier jobs and the
 * final `promoted` status commit or roll back together. `promotePackage` is a
 * thin standalone wrapper for tests/CLI.
 *
 * Guarantees:
 *  - promotes only accepted items (held/rejected stay in staging);
 *  - matches existing entities by external id first, then controlled identity;
 *    NEVER fuzzy-auto-merges an ambiguous entity (aborts for human resolution);
 *  - does NOT silently drop an accepted item: an accepted item that cannot be
 *    promoted (unresolved ref, unknown/forecast relationship type, missing
 *    source, disallowed endpoint kind) FAILS and rolls the whole thing back —
 *    the only exception is a dependency on a deliberately-excluded synthetic
 *    item, which cascades as a counted synthetic exclusion;
 *  - creates non-public draft stubs for accepted new relationship targets;
 *  - writes time/relationships/claims/sources/media via repositories, never SQL;
 *  - preserves the package/run/QA/human provenance chain;
 *  - enqueues selected unfinished neighbours as frontier jobs;
 *  - is idempotent (a promoted package is a no-op) and, run inside the decision
 *    transaction, atomic;
 *  - NEVER writes yol_* / editorial curation and never publishes (rows stay
 *    private: isPlaceholder=true, editorialStatus in {draft,in_review}).
 */
import { eq } from 'drizzle-orm';
import {
  researchJobs,
  researchPackages,
  type Entity,
  type ResearchPackageItem,
} from '../../db/schema';
import type { Db } from '../../db/repositories/types';
import { createEntity, findEntityBySlug, updateEntity } from '../../db/repositories/entities';
import { createPeriod } from '../../db/repositories/periods';
import { createClaim, createSource, linkClaimToRelationship, linkClaimToSource } from '../../db/repositories/claims';
import { addRelationship } from '../../db/repositories/relationships';
import { createMedia, associateMedia } from '../../db/repositories/media';
import {
  addAlias,
  addClassification,
  addExternalId,
  addTimeAssociation,
  getRelationshipType,
  normalizeText,
} from '../../db/repositories/graph-ext';
import { createJob, findOpenJobByDedupeKey, nextJobSequence } from '../../db/repositories/research';
import { CLASSIFICATION_TO_KIND } from '../../db/validation/graph-ext';
import type { PackageClaim, PackageEntity, PackageRelationship } from '../../db/validation/research';
import { recordJobOutcome } from './run';
import { resolveEntity } from './resolver';

export interface PromotionResult {
  packageId: string;
  centralEntityId: string;
  alreadyPromoted: boolean;
  created: {
    entities: number;
    periods: number;
    timeAssociations: number;
    relationships: number;
    claims: number;
    sources: number;
    media: number;
    frontierJobs: number;
  };
  matchedEntities: number;
  /** Deliberate, counted exclusions (never silent drops of accepted items). */
  skipped: { synthetic: number; held: number; rejected: number };
}

const SYNTHETIC_RE = /synthetic|^synth-/i;

function isSyntheticEntity(it: ResearchPackageItem, e: PackageEntity): boolean {
  return it.isSynthetic || e.isSynthetic || SYNTHETIC_RE.test(e.slug) || SYNTHETIC_RE.test(e.label);
}

/** Deterministic ordering of a symmetric edge so (A,B) and (B,A) collapse. */
function orderSymmetric(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

/**
 * Promote an approved package into canon INSIDE the given transaction. Throws
 * (rolling the caller's tx back) on any accepted item that cannot be promoted.
 */
export async function promoteWithinTx(tx: Db, packageId: string): Promise<PromotionResult> {
  const pkg = await tx.query.researchPackages.findFirst({
    where: eq(researchPackages.id, packageId),
  });
  if (!pkg) throw new Error(`package ${packageId} not found`);

  const created = { entities: 0, periods: 0, timeAssociations: 0, relationships: 0, claims: 0, sources: 0, media: 0, frontierJobs: 0 };
  const skipped = { synthetic: 0, held: 0, rejected: 0 };
  let matchedEntities = 0;

  // Idempotency: a promoted package is a harmless no-op.
  if (pkg.status === 'promoted') {
    return { packageId, centralEntityId: pkg.promotedEntityId ?? '', alreadyPromoted: true, created, skipped, matchedEntities: 0 };
  }
  if (pkg.status !== 'approved' && pkg.status !== 'approved_with_holds') {
    throw new Error(`package ${packageId} is ${pkg.status}, not approved — cannot promote`);
  }

  const pkgItems = (await tx.query.researchPackageItems.findMany()).filter((i) => i.packageId === packageId);
  const bySection = (s: ResearchPackageItem['section']) => pkgItems.filter((i) => i.section === s);
  /** Count held/rejected; report whether an item was accepted by the reviewer. */
  const isAccepted = (i: ResearchPackageItem): boolean => {
    if (i.decision === 'accepted') return true;
    if (i.decision === 'held') skipped.held++;
    else if (i.decision === 'rejected') skipped.rejected++;
    return false;
  };

  const refToEntity = new Map<string, string>();
  const refToKind = new Map<string, string>();
  const refToRel = new Map<string, string>();
  const refToSource = new Map<string, string>();
  const refToTimeAssoc = new Map<string, string>();
  /** Entity refs deliberately excluded as synthetic — dependents cascade. */
  const syntheticRefs = new Set<string>();
  const newlyCreatedConnected: { entityId: string; title: string }[] = [];
  let centralEntityId = '';
  let centralPrimaryPeriodSet = false;

  // --- entities ---
  for (const it of bySection('entity')) {
    const e = it.payload as unknown as PackageEntity;
    if (!isAccepted(it)) continue;
    if (isSyntheticEntity(it, e)) {
      // Deliberate safety exclusion (counted). Dependents cascade below.
      skipped.synthetic++;
      syntheticRefs.add(e.ref);
      continue;
    }
    const res = await resolveEntity(tx, {
      slug: e.slug,
      label: e.label,
      aliases: (e.aliases ?? []).map((a) => a.alias),
      externalIds: e.externalIds ?? [],
    });
    if (res.status === 'ambiguous_duplicate') {
      throw new Error(
        `promotion aborted: "${e.slug}" is an ambiguous duplicate (${(res.candidateIds ?? []).join(', ')}) — requires human resolution`,
      );
    }
    let entityId: string;
    let kind: Entity['kind'];
    if (res.entity) {
      entityId = res.entity.id;
      kind = res.entity.kind;
      matchedEntities++;
      if (res.entity.graphStatus === 'frontier' || res.entity.graphStatus === 'draft_stub') {
        await updateEntity(tx, entityId, {
          graphStatus: e.role === 'central' ? 'canonical_incomplete' : 'draft_stub',
          revision: res.entity.revision + 1,
        });
      }
    } else {
      kind = (e.kind ?? CLASSIFICATION_TO_KIND[e.classifications?.[0] ?? 'other'] ?? 'concept') as Entity['kind'];
      const isCentral = e.role === 'central';
      const ent = await createEntity(tx, {
        slug: e.slug,
        kind,
        label: e.label,
        summary: e.shortDescription,
        isPlaceholder: true,
        isSynthetic: false,
        editorialStatus: isCentral ? 'in_review' : 'draft',
        graphStatus: isCentral ? 'canonical_incomplete' : 'draft_stub',
      });
      entityId = ent.id;
      created.entities++;
      if (!isCentral) newlyCreatedConnected.push({ entityId, title: e.label });
    }
    for (const a of e.aliases ?? []) await addAlias(tx, { entityId, alias: a.alias, aliasType: a.aliasType, lang: a.lang });
    for (const x of e.externalIds ?? []) await addExternalId(tx, { entityId, scheme: x.scheme, value: x.value, url: x.url });
    for (const c of e.classifications ?? []) await addClassification(tx, { entityId, classification: c });
    refToEntity.set(e.ref, entityId);
    refToKind.set(e.ref, kind);
    if (e.role === 'central') centralEntityId = entityId;
  }
  if (!centralEntityId) throw new Error('promotion aborted: the central entity was not accepted/promotable');

  // --- time associations ---
  for (const it of bySection('time')) {
    const t = it.payload as unknown as {
      ref: string; entityRef: string; role: string; label?: string; startYear: number; endYear?: number;
      startMonth?: number; startDay?: number; endMonth?: number; endDay?: number; precision: string; confidence: number; note?: string;
    };
    if (!isAccepted(it)) continue;
    if (syntheticRefs.has(t.entityRef)) { skipped.synthetic++; continue; }
    const entityId = refToEntity.get(t.entityRef);
    if (!entityId) throw new Error(`promotion aborted: accepted chronology item "${t.ref}" references unresolved entity "${t.entityRef}" — hold it or fix the reference`);
    const period = await createPeriod(tx, {
      label: t.label ?? `${t.role} ${t.startYear}`,
      precision: t.precision as never,
      startYear: t.startYear, endYear: t.endYear,
      startMonth: t.startMonth, startDay: t.startDay, endMonth: t.endMonth, endDay: t.endDay,
      displayYear: t.startYear, confidence: t.confidence,
      isPlaceholder: true, isSynthetic: false, editorialStatus: 'in_review',
    });
    created.periods++;
    const assoc = await addTimeAssociation(tx, { entityId, periodId: period.id, role: t.role as never, confidence: t.confidence, note: t.note, isSynthetic: false });
    created.timeAssociations++;
    refToTimeAssoc.set(t.ref, assoc.id);
    if (entityId === centralEntityId && !centralPrimaryPeriodSet) {
      await updateEntity(tx, centralEntityId, { primaryPeriodId: period.id });
      centralPrimaryPeriodSet = true;
    }
  }

  // --- sources ---
  for (const it of bySection('source')) {
    const s = it.payload as unknown as { ref: string; title: string; type: string; url?: string; identifier?: string; publicationYear?: number };
    if (!isAccepted(it)) continue;
    const src = await createSource(tx, { title: s.title, type: s.type as never, url: s.url, identifier: s.identifier, publicationYear: s.publicationYear, isSynthetic: false });
    created.sources++;
    refToSource.set(s.ref, src.id);
  }

  // --- relationships ---
  for (const it of bySection('relationship')) {
    const r = it.payload as unknown as PackageRelationship;
    if (!isAccepted(it)) continue;
    // Cascade-exclude a relationship touching a deliberately-excluded synthetic.
    if (syntheticRefs.has(r.sourceRef) || syntheticRefs.has(r.targetRef)) { skipped.synthetic++; continue; }
    if (r.assertionClass === 'forecast') {
      throw new Error(`promotion aborted: accepted relationship "${r.ref}" is a forecast — forecasts cannot be promoted as canonical; hold it or reclassify`);
    }
    let sourceId = refToEntity.get(r.sourceRef);
    let targetId = refToEntity.get(r.targetRef);
    const sourceKind = refToKind.get(r.sourceRef);
    const targetKind = refToKind.get(r.targetRef);
    if (!sourceId || !targetId) {
      throw new Error(`promotion aborted: accepted relationship "${r.ref}" references unresolved entity (${r.sourceRef} to ${r.targetRef}) — hold it or fix the reference`);
    }
    const rt = await getRelationshipType(tx, r.typeKey);
    if (!rt) {
      throw new Error(`promotion aborted: accepted relationship "${r.ref}" uses unregistered type "${r.typeKey}" — register the type, hold the item, or fix it`);
    }
    // Enforce the registry's allowed endpoint kinds.
    if (rt.allowedSourceKinds && rt.allowedSourceKinds.length > 0 && sourceKind && !rt.allowedSourceKinds.includes(sourceKind)) {
      throw new Error(`promotion aborted: relationship "${r.ref}" source kind "${sourceKind}" not allowed for type "${r.typeKey}" (${rt.allowedSourceKinds.join('/')})`);
    }
    if (rt.allowedTargetKinds && rt.allowedTargetKinds.length > 0 && targetKind && !rt.allowedTargetKinds.includes(targetKind)) {
      throw new Error(`promotion aborted: relationship "${r.ref}" target kind "${targetKind}" not allowed for type "${r.typeKey}" (${rt.allowedTargetKinds.join('/')})`);
    }
    // Collapse reversed duplicates for symmetric types.
    if (rt.directionality === 'symmetric') [sourceId, targetId] = orderSymmetric(sourceId, targetId);
    const { relationship, created: didCreate } = await addRelationship(tx, {
      sourceEntityId: sourceId,
      targetEntityId: targetId,
      typeKey: r.typeKey,
      type: rt.isBuiltin ? (r.typeKey as never) : null,
      assertionClass: r.assertionClass,
      explanation: r.explanation,
      strength: r.strength,
      confidence: r.confidence,
      disputed: r.disputed,
      isSynthetic: false,
      editorialStatus: 'in_review',
    });
    if (didCreate) created.relationships++;
    refToRel.set(r.ref, relationship.id);
  }

  // --- claims (+ source links) ---
  for (const it of bySection('claim')) {
    const c = it.payload as unknown as PackageClaim;
    if (!isAccepted(it)) continue;
    // Cascade-exclude a claim about a deliberately-excluded synthetic entity.
    if (c.subjectSection === 'entity' && syntheticRefs.has(c.subjectRef)) { skipped.synthetic++; continue; }
    const subjectId =
      c.subjectSection === 'relationship' ? refToRel.get(c.subjectRef)
      : c.subjectSection === 'time' ? refToTimeAssoc.get(c.subjectRef)
      : refToEntity.get(c.subjectRef);
    if (!subjectId) {
      throw new Error(`promotion aborted: accepted claim "${c.ref}" references unresolved ${c.subjectSection} "${c.subjectRef}" — hold it or fix the reference`);
    }
    const subjectType = c.subjectSection === 'relationship' ? 'relationship' : c.subjectSection === 'time' ? 'time_association' : 'entity';
    const claim = await createClaim(tx, {
      text: c.text, subjectType, subjectId,
      assertionClass: c.assertionClass, confidence: c.confidence, verificationStatus: c.verification, disputed: c.disputed, isSynthetic: false,
    });
    created.claims++;
    for (const sl of c.sourceLinks ?? []) {
      const sid = refToSource.get(sl.sourceRef);
      if (!sid) {
        throw new Error(`promotion aborted: accepted claim "${c.ref}" cites source "${sl.sourceRef}" which was not promoted — accept the source or hold the claim`);
      }
      await linkClaimToSource(tx, claim.id, sid, { quotation: sl.quotation, locator: sl.locator });
    }
    if (subjectType === 'relationship') await linkClaimToRelationship(tx, subjectId, claim.id);
  }

  // --- media ---
  for (const it of bySection('media')) {
    const m = it.payload as unknown as { ref: string; subjectRef: string; mediaType: string; src?: string; alt: string; rightsStatus: string; provenance?: string; status: string };
    if (!isAccepted(it)) continue;
    if (syntheticRefs.has(m.subjectRef)) { skipped.synthetic++; continue; }
    const entityId = refToEntity.get(m.subjectRef);
    if (!entityId) throw new Error(`promotion aborted: accepted media "${m.ref}" references unresolved entity "${m.subjectRef}" — hold it or fix the reference`);
    const media = await createMedia(tx, {
      title: m.alt, mediaType: m.mediaType as never, sourceUrl: m.src,
      rightsStatus: m.rightsStatus as never, isPublicDomain: m.rightsStatus === 'public_domain', attributionText: m.provenance, isSynthetic: false,
    });
    created.media++;
    await associateMedia(tx, media.id, 'entity', entityId);
  }

  // --- frontier jobs: new stubs + accepted suggested next entities ---
  let seq = await nextJobSequence(tx);
  const enqueueFrontier = async (title: string, url: string | undefined, priority: number, parent: string) => {
    const dedupeKey = normalizeText(url ?? title);
    const existing = await findOpenJobByDedupeKey(tx, dedupeKey);
    if (existing) return;
    await createJob(tx, {
      centralTitle: title, centralUrl: url, origin: 'frontier', priority, sequence: seq++,
      parentEntityId: parent, parentContext: `frontier from package ${packageId}`, dedupeKey, status: 'queued',
    });
    created.frontierJobs++;
  };
  for (const n of newlyCreatedConnected) await enqueueFrontier(n.title, undefined, 0, centralEntityId);
  for (const it of bySection('next_entity')) {
    if (!isAccepted(it)) continue;
    const n = it.payload as unknown as { title: string; url?: string; suggestedPriority: number };
    await enqueueFrontier(n.title, n.url, n.suggestedPriority ?? 0, centralEntityId);
  }

  // --- finalize ---
  const central = await findEntityBySlug(tx, (bySection('entity').find((i) => (i.payload as unknown as PackageEntity).role === 'central')!.payload as unknown as PackageEntity).slug);
  if (central) await updateEntity(tx, centralEntityId, { revision: central.revision + 1, freshnessCheckedAt: new Date() });

  await tx.update(researchPackages)
    .set({ status: 'promoted', promotedEntityId: centralEntityId, promotedAt: new Date(), updatedAt: new Date() })
    .where(eq(researchPackages.id, packageId));

  const job = await tx.query.researchJobs.findFirst({ where: eq(researchJobs.id, pkg.jobId) });
  if (job && (job.status === 'submitted' || job.status === 'returned')) {
    await tx.update(researchJobs).set({ status: 'completed', updatedAt: new Date() }).where(eq(researchJobs.id, job.id));
    if (job.claimedByRunId) await recordJobOutcome(tx, job.claimedByRunId, 'completed');
  }

  return { packageId, centralEntityId, alreadyPromoted: false, created, skipped, matchedEntities };
}

/** Standalone wrapper: promote in its own transaction (tests / retry / CLI). */
export async function promotePackage(db: Db, packageId: string): Promise<PromotionResult> {
  return db.transaction(async (tx) => promoteWithinTx(tx, packageId));
}
