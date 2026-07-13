/**
 * Read models for the internal research CRM. Shapes typed view models the
 * server components render — no SQL in the app layer. This is INTERNAL tooling
 * over research staging + private canonical knowledge; it deliberately never
 * reads or writes yol_* public curation.
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  claims,
  claimSources,
  entities,
  entityAliases,
  entityClassifications,
  entityExternalIds,
  entityTimeAssociations,
  packageDecisions,
  periods,
  qaFlags,
  relationships,
  researchJobs,
  researchPackageItems,
  researchPackages,
  researchRuns,
  sources,
  type ResearchJob,
} from '../schema';
import type { Db } from '../repositories/types';
import {
  countJobsByStatus,
  countOpenJobsByOrigin,
  listPackagesByStatus,
  listRecentPackages,
  listRuns,
} from '../repositories/research';

export async function getDashboard(db: Db) {
  const [jobsByStatus, queuedByOrigin, runs, awaitingQa, awaitingReview, recentPackages] =
    await Promise.all([
      countJobsByStatus(db),
      countOpenJobsByOrigin(db),
      listRuns(db, 5),
      listPackagesByStatus(db, ['submitted', 'qa_pending']),
      listPackagesByStatus(db, ['qa_complete', 'in_review']),
      listRecentPackages(db, 10),
    ]);
  const promotions = await db.query.researchPackages.findMany({
    where: eq(researchPackages.status, 'promoted'),
    orderBy: [desc(researchPackages.promotedAt)],
    limit: 8,
  });
  return { jobsByStatus, queuedByOrigin, runs, awaitingQa, awaitingReview, recentPackages, promotions };
}

export async function getQueueView(db: Db): Promise<{ activeRun: typeof researchRuns.$inferSelect | undefined; jobs: ResearchJob[] }> {
  const activeRun = await db.query.researchRuns.findFirst({
    where: inArray(researchRuns.status, ['active', 'stopping']),
    orderBy: [desc(researchRuns.startedAt)],
  });
  const jobs = await db.query.researchJobs.findMany({
    orderBy: [researchJobs.priority, researchJobs.sequence],
    limit: 100,
  });
  return { activeRun, jobs };
}

export async function getPackageDetail(db: Db, packageId: string) {
  const pkg = await db.query.researchPackages.findFirst({ where: eq(researchPackages.id, packageId) });
  if (!pkg) return undefined;
  const items = await db.query.researchPackageItems.findMany({
    where: eq(researchPackageItems.packageId, packageId),
    orderBy: [researchPackageItems.section, researchPackageItems.localRef],
  });
  const flags = await db.query.qaFlags.findMany({ where: eq(qaFlags.packageId, packageId) });
  const decisions = await db.query.packageDecisions.findMany({
    where: eq(packageDecisions.packageId, packageId),
    orderBy: [desc(packageDecisions.createdAt)],
  });
  const bySection = (s: string) => items.filter((i) => i.section === s);
  return {
    package: pkg,
    sections: {
      entity: bySection('entity'),
      time: bySection('time'),
      relationship: bySection('relationship'),
      claim: bySection('claim'),
      source: bySection('source'),
      media: bySection('media'),
      question: bySection('question'),
      next_entity: bySection('next_entity'),
    },
    flags,
    decisions,
  };
}

export async function getEntityProof(db: Db, slug: string) {
  const entity = await db.query.entities.findFirst({ where: eq(entities.slug, slug) });
  if (!entity) return undefined;
  const [aliases, externalIds, classifications, timeAssocsRaw, outRels, inRels, entityClaims] =
    await Promise.all([
      db.query.entityAliases.findMany({ where: eq(entityAliases.entityId, entity.id) }),
      db.query.entityExternalIds.findMany({ where: eq(entityExternalIds.entityId, entity.id) }),
      db.query.entityClassifications.findMany({ where: eq(entityClassifications.entityId, entity.id) }),
      db.query.entityTimeAssociations.findMany({ where: eq(entityTimeAssociations.entityId, entity.id) }),
      db.query.relationships.findMany({ where: eq(relationships.sourceEntityId, entity.id) }),
      db.query.relationships.findMany({ where: eq(relationships.targetEntityId, entity.id) }),
      db.query.claims.findMany({ where: and(eq(claims.subjectType, 'entity'), eq(claims.subjectId, entity.id)) }),
    ]);
  // resolve period + neighbour labels
  const periodIds = timeAssocsRaw.map((t) => t.periodId);
  const periodRows = periodIds.length ? await db.query.periods.findMany({ where: inArray(periods.id, periodIds) }) : [];
  const periodMap = new Map(periodRows.map((p) => [p.id, p]));
  const timeAssocs = timeAssocsRaw.map((t) => ({ ...t, period: periodMap.get(t.periodId) }));
  const neighbourIds = [...new Set([...outRels.map((r) => r.targetEntityId), ...inRels.map((r) => r.sourceEntityId)])];
  const neighbours = neighbourIds.length ? await db.query.entities.findMany({ where: inArray(entities.id, neighbourIds) }) : [];
  const neighbourMap = new Map(neighbours.map((e) => [e.id, e]));
  // claim sources
  const claimIds = entityClaims.map((c) => c.id);
  const links = claimIds.length ? await db.query.claimSources.findMany({ where: inArray(claimSources.claimId, claimIds) }) : [];
  const srcIds = [...new Set(links.map((l) => l.sourceId))];
  const srcRows = srcIds.length ? await db.query.sources.findMany({ where: inArray(sources.id, srcIds) }) : [];
  const srcMap = new Map(srcRows.map((s) => [s.id, s]));
  const claimsWithSources = entityClaims.map((c) => ({
    ...c,
    sources: links.filter((l) => l.claimId === c.id).map((l) => ({ ...srcMap.get(l.sourceId)!, quotation: l.quotation, locator: l.locator })),
  }));
  // provenance: the package that promoted this entity
  const provenancePackage = await db.query.researchPackages.findFirst({ where: eq(researchPackages.promotedEntityId, entity.id) });
  return {
    entity,
    aliases,
    externalIds,
    classifications,
    timeAssocs,
    outRels: outRels.map((r) => ({ ...r, target: neighbourMap.get(r.targetEntityId) })),
    inRels: inRels.map((r) => ({ ...r, source: neighbourMap.get(r.sourceEntityId) })),
    claims: claimsWithSources,
    provenancePackage,
  };
}
