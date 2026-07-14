/**
 * Repositories for the Cycle 8A research-staging tables. Thin, typed data
 * access only — the queue/run kernel, resolver and promotion logic live in
 * src/services/research/*. No raw SQL leaks outside this layer.
 */
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  packageDecisions,
  qaFlags,
  qaResults,
  researchJobs,
  researchPackageItems,
  researchPackages,
  researchRuns,
  type NewPackageDecision,
  type NewQaFlag,
  type NewQaResult,
  type NewResearchJob,
  type NewResearchPackage,
  type NewResearchPackageItem,
  type NewResearchRun,
  type PackageDecision,
  type QaFlag,
  type QaResult,
  type ResearchJob,
  type ResearchPackage,
  type ResearchPackageItem,
  type ResearchRun,
} from '../schema';
import type { Db } from './types';

/* ---- runs ---- */
export async function createRun(db: Db, input: NewResearchRun): Promise<ResearchRun> {
  const [row] = await db.insert(researchRuns).values(input).returning();
  return row;
}
export async function getRun(db: Db, id: string): Promise<ResearchRun | undefined> {
  return db.query.researchRuns.findFirst({ where: eq(researchRuns.id, id) });
}
export async function updateRun(
  db: Db,
  id: string,
  patch: Partial<Omit<NewResearchRun, 'id'>>,
): Promise<ResearchRun | undefined> {
  const [row] = await db
    .update(researchRuns)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(researchRuns.id, id))
    .returning();
  return row;
}
export async function listRuns(db: Db, limit = 20): Promise<ResearchRun[]> {
  return db.query.researchRuns.findMany({ orderBy: [desc(researchRuns.startedAt)], limit });
}

/* ---- jobs ---- */
export async function nextJobSequence(db: Db): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`coalesce(max(${researchJobs.sequence}), 0)` })
    .from(researchJobs);
  return (row?.value ?? 0) + 1;
}
export async function createJob(
  db: Db,
  input: Omit<NewResearchJob, 'sequence'> & { sequence?: number },
): Promise<ResearchJob> {
  const sequence = input.sequence ?? (await nextJobSequence(db));
  const [row] = await db.insert(researchJobs).values({ ...input, sequence }).returning();
  return row;
}
export async function getJob(db: Db, id: string): Promise<ResearchJob | undefined> {
  return db.query.researchJobs.findFirst({ where: eq(researchJobs.id, id) });
}
export async function updateJob(
  db: Db,
  id: string,
  patch: Partial<Omit<NewResearchJob, 'id'>>,
): Promise<ResearchJob | undefined> {
  const [row] = await db
    .update(researchJobs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(researchJobs.id, id))
    .returning();
  return row;
}
/** All jobs still eligible to be worked (queued or recoverable). Ordered for
 * the kernel: origin-priority is applied in the selector, not here. */
export async function listOpenJobs(db: Db): Promise<ResearchJob[]> {
  return db.query.researchJobs.findMany({
    where: inArray(researchJobs.status, ['queued', 'claimed', 'researching']),
    orderBy: [asc(researchJobs.priority), asc(researchJobs.sequence)],
  });
}
export async function listJobsByRun(db: Db, runId: string): Promise<ResearchJob[]> {
  return db.query.researchJobs.findMany({
    where: eq(researchJobs.claimedByRunId, runId),
    orderBy: [asc(researchJobs.sequence)],
  });
}
export async function listRecentJobs(db: Db, limit = 50): Promise<ResearchJob[]> {
  return db.query.researchJobs.findMany({
    orderBy: [asc(researchJobs.priority), asc(researchJobs.sequence)],
    limit,
  });
}
export async function findOpenJobByDedupeKey(
  db: Db,
  dedupeKey: string,
): Promise<ResearchJob | undefined> {
  return db.query.researchJobs.findFirst({
    where: and(
      eq(researchJobs.dedupeKey, dedupeKey),
      inArray(researchJobs.status, ['queued', 'claimed', 'researching', 'submitted']),
    ),
  });
}
export async function countJobsByStatus(db: Db): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: researchJobs.status, n: count() })
    .from(researchJobs)
    .groupBy(researchJobs.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}
export async function countOpenJobsByOrigin(db: Db): Promise<Record<string, number>> {
  const rows = await db
    .select({ origin: researchJobs.origin, n: count() })
    .from(researchJobs)
    .where(inArray(researchJobs.status, ['queued']))
    .groupBy(researchJobs.origin);
  return Object.fromEntries(rows.map((r) => [r.origin, r.n]));
}

/* ---- packages ---- */
export async function createPackage(db: Db, input: NewResearchPackage): Promise<ResearchPackage> {
  const [row] = await db.insert(researchPackages).values(input).returning();
  return row;
}
export async function getPackage(db: Db, id: string): Promise<ResearchPackage | undefined> {
  return db.query.researchPackages.findFirst({ where: eq(researchPackages.id, id) });
}
export async function findPackageByJobHash(
  db: Db,
  jobId: string,
  submissionHash: string,
): Promise<ResearchPackage | undefined> {
  return db.query.researchPackages.findFirst({
    where: and(
      eq(researchPackages.jobId, jobId),
      eq(researchPackages.submissionHash, submissionHash),
    ),
  });
}
export async function updatePackage(
  db: Db,
  id: string,
  patch: Partial<Omit<NewResearchPackage, 'id'>>,
): Promise<ResearchPackage | undefined> {
  const [row] = await db
    .update(researchPackages)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(researchPackages.id, id))
    .returning();
  return row;
}
export async function listPackagesByStatus(
  db: Db,
  statuses: ResearchPackage['status'][],
): Promise<ResearchPackage[]> {
  return db.query.researchPackages.findMany({
    where: inArray(researchPackages.status, statuses),
    orderBy: [desc(researchPackages.submittedAt)],
  });
}
export async function listRecentPackages(db: Db, limit = 25): Promise<ResearchPackage[]> {
  return db.query.researchPackages.findMany({
    orderBy: [desc(researchPackages.submittedAt)],
    limit,
  });
}

/* ---- package items ---- */
export async function addPackageItem(
  db: Db,
  input: NewResearchPackageItem,
): Promise<ResearchPackageItem> {
  const [row] = await db.insert(researchPackageItems).values(input).returning();
  return row;
}
export async function listPackageItems(db: Db, packageId: string): Promise<ResearchPackageItem[]> {
  return db.query.researchPackageItems.findMany({
    where: eq(researchPackageItems.packageId, packageId),
    orderBy: [asc(researchPackageItems.section), asc(researchPackageItems.localRef)],
  });
}
export async function updatePackageItem(
  db: Db,
  id: string,
  patch: Partial<Omit<NewResearchPackageItem, 'id'>>,
): Promise<ResearchPackageItem | undefined> {
  const [row] = await db
    .update(researchPackageItems)
    .set(patch)
    .where(eq(researchPackageItems.id, id))
    .returning();
  return row;
}

/* ---- QA ---- */
export async function createQaResult(db: Db, input: NewQaResult): Promise<QaResult> {
  const [row] = await db.insert(qaResults).values(input).returning();
  return row;
}
export async function addQaFlag(db: Db, input: NewQaFlag): Promise<QaFlag> {
  const [row] = await db.insert(qaFlags).values(input).returning();
  return row;
}
export async function listQaResults(db: Db, packageId: string): Promise<QaResult[]> {
  return db.query.qaResults.findMany({ where: eq(qaResults.packageId, packageId) });
}
export async function listQaFlags(db: Db, packageId: string): Promise<QaFlag[]> {
  return db.query.qaFlags.findMany({ where: eq(qaFlags.packageId, packageId) });
}

/* ---- decisions ---- */
export async function createDecision(db: Db, input: NewPackageDecision): Promise<PackageDecision> {
  const [row] = await db.insert(packageDecisions).values(input).returning();
  return row;
}
export async function listDecisions(db: Db, packageId: string): Promise<PackageDecision[]> {
  return db.query.packageDecisions.findMany({
    where: eq(packageDecisions.packageId, packageId),
    orderBy: [desc(packageDecisions.createdAt)],
  });
}
