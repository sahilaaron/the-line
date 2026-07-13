/**
 * Transactional promotion: the ONE path from an approved package into the
 * private canonical graph. Guarantees (all locked in the brief):
 *  - promotes only accepted, non-held, non-synthetic items;
 *  - matches existing entities by external id first, then controlled identity;
 *  - NEVER fuzzy-auto-merges an ambiguous entity (aborts for human resolution);
 *  - creates non-public draft stubs for accepted new relationship targets;
 *  - writes time/relationships/claims/sources/media via repositories + typed
 *    validators, never ad-hoc SQL;
 *  - preserves the package/run/QA/human provenance chain;
 *  - enqueues selected unfinished neighbours as frontier jobs;
 *  - is atomic (a single db.transaction) and idempotent (status guard);
 *  - leaves rejected/held candidates in staging (never deleted);
 *  - NEVER writes yol_* / editorial-presentation tables;
 *  - never turns approval into public publication (all rows stay private:
 *    isPlaceholder=true, editorialStatus in {draft,in_review}, never published).
 */
import { eq } from 'drizzle-orm';
import { researchJobs, researchPackages, type ResearchPackageItem } from '../../db/schema';
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
import type {
  PackageClaim,
  PackageEntity,
  PackageRelationship,
} from '../../db/validation/research';
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
  skipped: { synthetic: number; held: number; rejected: number; unknownType: number; forecast: number };
}

const SYNTHETIC_RE = /synthetic|^synth-/i;

function isSyntheticEntity(it: ResearchPackageItem, e: PackageEntity): boolean {
  return it.isSynthetic || e.isSynthetic || SYNTHETIC_RE.test(e.slug) || SYNTHETIC_RE.test(e.label);
}

export async function promotePackage(
  db: Db,
  packageId: string,
): Promise<PromotionResult> {
  return db.transaction(async (tx) => {
    const pkg = await tx.query.researchPackages.findFirst({
      where: eq(researchPackages.id, packageId),
    });
    if (!pkg) throw new Error(`package ${packageId} not found`);

    const created = { entities: 0, periods: 0, timeAssociations: 0, relationships: 0, claims: 0, sources: 0, media: 0, frontierJobs: 0 };
    const skipped = { synthetic: 0, held: 0, rejected: 0, unknownType: 0, forecast: 0 };
    let matchedEntities = 0;

    // Idempotency: promoting an already-promoted package is a no-op.
    if (pkg.status === 'promoted') {
      return {
        packageId,
        centralEntityId: pkg.promotedEntityId ?? '',
        alreadyPromoted: true,
        created,
        skipped,
        matchedEntities: 0,
      };
    }
    if (pkg.status !== 'approved' && pkg.status !== 'approved_with_holds') {
      throw new Error(`package ${packageId} is ${pkg.status}, not approved — cannot promote`);
    }

    const pkgItems = (await tx.query.researchPackageItems.findMany()).filter(
      (i) => i.packageId === packageId,
    );

    const bySection = (s: ResearchPackageItem['section']) => pkgItems.filter((i) => i.section === s);
    const promotable = (i: ResearchPackageItem) => {
      if (i.decision === 'accepted') return true;
      if (i.decision === 'held') skipped.held++;
      else if (i.decision === 'rejected') skipped.rejected++;
      return false;
    };

    const refToEntity = new Map<string, string>();
    const refToRel = new Map<string, string>();
    const refToSource = new Map<string, string>();
    const refToTimeAssoc = new Map<string, string>();
    const newlyCreatedConnected: { entityId: string; title: string }[] = [];
    let centralEntityId = '';
    let centralPrimaryPeriodSet = false;

    // --- entities ---
    for (const it of bySection('entity')) {
      const e = it.payload as unknown as PackageEntity;
      if (!promotable(it)) continue;
      if (isSyntheticEntity(it, e)) {
        skipped.synthetic++;
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
      if (res.entity) {
        entityId = res.entity.id;
        matchedEntities++;
        // An existing frontier/stub gaining real research becomes a candidate.
        if (res.entity.graphStatus === 'frontier' || res.entity.graphStatus === 'draft_stub') {
          await updateEntity(tx, entityId, {
            graphStatus: e.role === 'central' ? 'canonical_incomplete' : 'draft_stub',
            revision: res.entity.revision + 1,
          });
        }
      } else {
        const kind =
          e.kind ?? CLASSIFICATION_TO_KIND[e.classifications?.[0] ?? 'other'] ?? 'concept';
        const isCentral = e.role === 'central';
        const ent = await createEntity(tx, {
          slug: e.slug,
          kind,
          label: e.label,
          summary: e.shortDescription,
          isPlaceholder: true,
          isSynthetic: false,
          // PRIVATE canonical, never published: central becomes reviewable,
          // connected neighbours become draft stubs.
          editorialStatus: isCentral ? 'in_review' : 'draft',
          graphStatus: isCentral ? 'canonical_incomplete' : 'draft_stub',
        });
        entityId = ent.id;
        created.entities++;
        if (!isCentral) newlyCreatedConnected.push({ entityId, title: e.label });
      }
      // identity satellites (idempotent)
      for (const a of e.aliases ?? []) {
        await addAlias(tx, { entityId, alias: a.alias, aliasType: a.aliasType, lang: a.lang });
      }
      for (const x of e.externalIds ?? []) {
        await addExternalId(tx, { entityId, scheme: x.scheme, value: x.value, url: x.url });
      }
      for (const c of e.classifications ?? []) {
        await addClassification(tx, { entityId, classification: c });
      }
      refToEntity.set(e.ref, entityId);
      if (e.role === 'central') centralEntityId = entityId;
    }
    if (!centralEntityId) throw new Error('promotion aborted: central entity was not promotable');

    // --- time associations (each becomes a private period + typed assoc) ---
    for (const it of bySection('time')) {
      const t = it.payload as unknown as {
        ref: string; entityRef: string; role: string; label?: string;
        startYear: number; endYear?: number; startMonth?: number; startDay?: number;
        endMonth?: number; endDay?: number; precision: string; confidence: number; note?: string;
      };
      if (!promotable(it)) continue;
      const entityId = refToEntity.get(t.entityRef);
      if (!entityId) continue;
      const period = await createPeriod(tx, {
        label: t.label ?? `${t.role} ${t.startYear}`,
        precision: t.precision as never,
        startYear: t.startYear,
        endYear: t.endYear,
        startMonth: t.startMonth,
        startDay: t.startDay,
        endMonth: t.endMonth,
        endDay: t.endDay,
        displayYear: t.startYear,
        confidence: t.confidence,
        isPlaceholder: true,
        isSynthetic: false,
        editorialStatus: 'in_review',
      });
      created.periods++;
      const assoc = await addTimeAssociation(tx, {
        entityId,
        periodId: period.id,
        role: t.role as never,
        confidence: t.confidence,
        note: t.note,
        isSynthetic: false,
      });
      created.timeAssociations++;
      refToTimeAssoc.set(t.ref, assoc.id);
      // Give the central entity a primaryPeriodId for renderer compatibility.
      if (entityId === centralEntityId && !centralPrimaryPeriodSet) {
        await updateEntity(tx, centralEntityId, { primaryPeriodId: period.id });
        centralPrimaryPeriodSet = true;
      }
    }

    // --- sources ---
    for (const it of bySection('source')) {
      const s = it.payload as unknown as {
        ref: string; title: string; type: string; url?: string; identifier?: string; publicationYear?: number;
      };
      if (!promotable(it)) continue;
      const src = await createSource(tx, {
        title: s.title,
        type: s.type as never,
        url: s.url,
        identifier: s.identifier,
        publicationYear: s.publicationYear,
        isSynthetic: false,
      });
      created.sources++;
      refToSource.set(s.ref, src.id);
    }

    // --- relationships ---
    for (const it of bySection('relationship')) {
      const r = it.payload as unknown as PackageRelationship;
      if (!promotable(it)) continue;
      if (r.assertionClass === 'forecast') { skipped.forecast++; continue; }
      const sourceId = refToEntity.get(r.sourceRef);
      const targetId = refToEntity.get(r.targetRef);
      if (!sourceId || !targetId) continue;
      const rt = await getRelationshipType(tx, r.typeKey);
      if (!rt) { skipped.unknownType++; continue; }
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
      if (!promotable(it)) continue;
      const subjectId =
        c.subjectSection === 'relationship'
          ? refToRel.get(c.subjectRef)
          : c.subjectSection === 'time'
            ? refToTimeAssoc.get(c.subjectRef)
            : refToEntity.get(c.subjectRef);
      if (!subjectId) continue;
      const subjectType = c.subjectSection === 'relationship' ? 'relationship' : c.subjectSection === 'time' ? 'time_association' : 'entity';
      const claim = await createClaim(tx, {
        text: c.text,
        subjectType,
        subjectId,
        assertionClass: c.assertionClass,
        confidence: c.confidence,
        verificationStatus: c.verification,
        disputed: c.disputed,
        isSynthetic: false,
      });
      created.claims++;
      for (const sl of c.sourceLinks ?? []) {
        const sid = refToSource.get(sl.sourceRef);
        if (sid) await linkClaimToSource(tx, claim.id, sid, { quotation: sl.quotation, locator: sl.locator });
      }
      if (subjectType === 'relationship') await linkClaimToRelationship(tx, subjectId, claim.id);
    }

    // --- media ---
    for (const it of bySection('media')) {
      const m = it.payload as unknown as {
        ref: string; subjectRef: string; mediaType: string; src?: string; alt: string;
        rightsStatus: string; provenance?: string; status: string;
      };
      if (!promotable(it)) continue;
      const entityId = refToEntity.get(m.subjectRef);
      if (!entityId) continue;
      const media = await createMedia(tx, {
        title: m.alt,
        mediaType: m.mediaType as never,
        sourceUrl: m.src,
        rightsStatus: m.rightsStatus as never,
        isPublicDomain: m.rightsStatus === 'public_domain',
        attributionText: m.provenance,
        isSynthetic: false,
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
        centralTitle: title,
        centralUrl: url,
        origin: 'frontier',
        priority,
        sequence: seq++,
        parentEntityId: parent,
        parentContext: `frontier from package ${packageId}`,
        dedupeKey,
        status: 'queued',
      });
      created.frontierJobs++;
    };
    for (const n of newlyCreatedConnected) {
      await enqueueFrontier(n.title, undefined, 0, centralEntityId);
    }
    for (const it of bySection('next_entity')) {
      if (!promotable(it)) continue;
      const n = it.payload as unknown as { title: string; url?: string; suggestedPriority: number };
      await enqueueFrontier(n.title, n.url, n.suggestedPriority ?? 0, centralEntityId);
    }

    // --- finalize: bump central, mark package promoted, complete the job ---
    const central = await findEntityBySlug(tx, (bySection('entity').find((i) => (i.payload as unknown as PackageEntity).role === 'central')!.payload as unknown as PackageEntity).slug);
    if (central) {
      await updateEntity(tx, centralEntityId, {
        revision: central.revision + 1,
        freshnessCheckedAt: new Date(),
      });
    }
    await tx
      .update(researchPackages)
      .set({ status: 'promoted', promotedEntityId: centralEntityId, promotedAt: new Date(), updatedAt: new Date() })
      .where(eq(researchPackages.id, packageId));

    const job = await tx.query.researchJobs.findFirst({ where: eq(researchJobs.id, pkg.jobId) });
    if (job && (job.status === 'submitted' || job.status === 'returned')) {
      await tx.update(researchJobs).set({ status: 'completed', updatedAt: new Date() }).where(eq(researchJobs.id, job.id));
      if (job.claimedByRunId) await recordJobOutcome(tx, job.claimedByRunId, 'completed');
    }

    return { packageId, centralEntityId, alreadyPromoted: false, created, skipped, matchedEntities };
  });
}
