/**
 * Cycle 8B correction pass v4 — permanent adversarial tests for kernel
 * boundaries, migration compatibility and lifecycle enforcement. Written to
 * FAIL against tip c62e477 and PASS after the v4 correction.
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshMigratedDb } from '../../db/testing/setup';
import { entities, researchJobs, researchPackageItems, researchPackages, researchRuns } from '../../db/schema';
import { createEntity } from '../../db/repositories/entities';
import { createJob } from '../../db/repositories/research';
import { createRun } from './run';
import { claimNextJob } from './queue';
import { failJob, releaseJob } from './queue-admin';
import { submitPackage } from './submit';
import { decidePackage } from './decision';
import { editPackageItemFields, correctCanonicalMatch, searchCanonicalMatchTargets } from './edit';
import { stageSubmittedPackage } from './fixtures/staging';

type DB = Awaited<ReturnType<typeof freshMigratedDb>>['db'];
const runOf = async (db: DB, id: string) => (await db.query.researchRuns.findFirst({ where: eq(researchRuns.id, id) }))!;
const expire = (db: DB, jobId: string) =>
  db.update(researchJobs).set({ leaseExpiresAt: new Date(Date.now() - 60_000) }).where(eq(researchJobs.id, jobId));
async function claimed(db: DB, runId: string, worker: string, title = 'X') {
  await createJob(db, { centralTitle: title, origin: 'manual', dedupeKey: `${title}-${Math.random()}`, status: 'queued' });
  const c = await claimNextJob(db, runId, { worker });
  return c.job!;
}
const heldEnvelope = () => ({
  schemaVersion: 1 as const,
  entities: [
    { ref: 'central', role: 'central' as const, slug: 'held-subject', label: 'Held Subject', kind: 'invention' as const, classifications: ['invention'] },
    { ref: 'other', role: 'connected' as const, slug: 'held-other', label: 'Other Maker', kind: 'person' as const, classifications: ['person'] },
  ],
  connections: [{ ref: 'rel-1', sourceRef: 'central', targetRef: 'other', typeKey: 'developed_by', held: true }],
  sources: [{ ref: 'src-1', title: 'A cited source' }],
  claims: [{ ref: 'claim-1', subjectRef: 'central', subjectSection: 'entity' as const, text: 'A held claim', held: true, sourceLinks: [{ sourceRef: 'src-1' }] }],
  media: [{ ref: 'media-1', subjectRef: 'central', mediaType: 'image' as const, alt: 'held image', held: true }],
});

/* 1 — batchLimit=1 expired-lease recovery ------------------------------ */
describe('1. batchLimit=1 expired-lease recovery', () => {
  it('A. a run AT its batch limit can reclaim its OWN expired job', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 1 });
    const job = await claimed(db, run.id, 'w1');
    expect((await runOf(db, run.id)).claimedCount).toBe(1);
    await expire(db, job.id);
    const reclaim = await claimNextJob(db, run.id, { worker: 'w1' });
    expect(reclaim.job!.id).toBe(job.id);
    expect(reclaim.recovered).toBe(true);
  });
  it('B. a run at its limit CANNOT claim a different queued job while its lease is LIVE', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 1 });
    await claimed(db, run.id, 'w1', 'first'); // lease live
    await createJob(db, { centralTitle: 'second', origin: 'manual', dedupeKey: 'second', status: 'queued' });
    const res = await claimNextJob(db, run.id, { worker: 'w1' });
    expect(res.job).toBeNull();
    expect(res.reason).toBe('batch_limit_reached');
  });
  it('C. same-run reclaim is net-zero (claimedCount stays 1)', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 1 });
    const job = await claimed(db, run.id, 'w1');
    await expire(db, job.id);
    await claimNextJob(db, run.id, { worker: 'w1' });
    expect((await runOf(db, run.id)).claimedCount).toBe(1);
  });
  it('D. cross-run reclaim repairs BOTH counters', async () => {
    const { db } = await freshMigratedDb();
    const runA = await createRun(db, { batchLimit: 1 });
    const job = await claimed(db, runA.id, 'wa');
    await expire(db, job.id);
    const runB = await createRun(db, { batchLimit: 1 });
    const res = await claimNextJob(db, runB.id, { worker: 'wb' });
    expect(res.job!.id).toBe(job.id);
    expect((await runOf(db, runA.id)).claimedCount).toBe(0);
    expect((await runOf(db, runB.id)).claimedCount).toBe(1);
  });
});

/* 2 — held envelope submission ---------------------------------------- */
describe('2. held package-envelope submission', () => {
  it('a held relationship/claim/media is insertable with AGENT provenance', async () => {
    const { db } = await freshMigratedDb();
    const { result } = await stageSubmittedPackage(db, heldEnvelope());
    const pkg = result.package;
    const items = await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.packageId, pkg.id) });
    for (const ref of ['rel-1', 'claim-1', 'media-1']) {
      const it = items.find((i) => i.localRef === ref)!;
      expect(it.held, `${ref} held`).toBe(true);
      expect(it.agentHeld, `${ref} agentHeld`).toBe(true);
      expect(it.humanHeld).toBe(false);
      expect(it.qaHeld).toBe(false);
    }
  });
  it('an initially-held candidate is EXCLUDED from promotion', async () => {
    const { db } = await freshMigratedDb();
    const { result } = await stageSubmittedPackage(db, heldEnvelope());
    const pkg = result.package;
    await decidePackage(db, pkg.id, { decision: 'approve_with_holds', heldItems: [] });
    const rels = await db.query.relationships.findMany();
    expect(rels.length).toBe(0); // the held developed_by relationship was not promoted
  });
});

/* 3 — submission lifecycle -------------------------------------------- */
describe('3. job submission lifecycle', () => {
  const env = { schemaVersion: 1 as const, entities: [{ ref: 'central', role: 'central' as const, slug: 'life-subject', label: 'Life Subject', kind: 'concept' as const, classifications: ['concept'] }] };
  it('a queued (unclaimed) job cannot submit', async () => {
    const { db } = await freshMigratedDb();
    const job = await createJob(db, { centralTitle: 'Q', origin: 'manual', dedupeKey: 'q', status: 'queued' });
    await expect(submitPackage(db, job.id, env, { worker: 'w1', leaseToken: 'x' })).rejects.toThrow(/claimed\/researching/);
  });
  it('a wrong worker cannot submit', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    const job = await claimed(db, run.id, 'w1');
    await expect(submitPackage(db, job.id, env, { worker: 'w2', leaseToken: job.workerLock! })).rejects.toThrow(/owned by/);
  });
  it('an expired lease cannot submit', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    const job = await claimed(db, run.id, 'w1');
    await expire(db, job.id);
    await expect(submitPackage(db, job.id, env, { worker: 'w1', leaseToken: job.workerLock! })).rejects.toThrow(/lease has expired/);
  });
  it('the live owning worker can submit; identical replay is idempotent', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    const job = await claimed(db, run.id, 'w1');
    const tok = job.workerLock!;
    const first = await submitPackage(db, job.id, env, { worker: 'w1', leaseToken: tok });
    expect(first.created).toBe(true);
    const replay = await submitPackage(db, job.id, env, { worker: 'w1', leaseToken: tok });
    expect(replay.created).toBe(false);
    expect(replay.package.id).toBe(first.package.id);
  });
  it('a different-content second submission is rejected (one package per job)', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    const job = await claimed(db, run.id, 'w1');
    await submitPackage(db, job.id, env, { worker: 'w1', leaseToken: job.workerLock! });
    const env2 = { ...env, entities: [{ ...env.entities[0], label: 'Life Subject EDITED' }] };
    await expect(submitPackage(db, job.id, env2, { worker: 'w1', leaseToken: job.workerLock! })).rejects.toThrow(/one package per job/);
    expect((await db.query.researchPackages.findMany({ where: eq(researchPackages.jobId, job.id) })).length).toBe(1);
  });
});

/* 4 — canonical matching hardening ------------------------------------ */
describe('4. canonical matching hardening', () => {
  async function stage(db: DB, candidateKind: string) {
    const env = { schemaVersion: 1 as const, entities: [{ ref: 'central', role: 'central' as const, slug: `cand-${Math.random().toString(36).slice(2)}`, label: 'Candidate', kind: candidateKind as never, classifications: [candidateKind] }] };
    const { result } = await stageSubmittedPackage(db, env);
    const pkg = result.package;
    const item = (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.packageId, pkg.id) })).find((i) => i.section === 'entity')!;
    return item;
  }
  it('a synthetic target is rejected (even via a direct/forged service call)', async () => {
    const { db } = await freshMigratedDb();
    const synth = await createEntity(db, { slug: 'synth-target', kind: 'invention', label: 'Synthetic Target', isSynthetic: true });
    const item = await stage(db, 'invention');
    await expect(correctCanonicalMatch(db, item.id, synth.id, 'canonical_incomplete', 'Sahil')).rejects.toThrow(/synthetic/);
  });
  it('an incompatible kind is rejected (invention candidate → person target)', async () => {
    const { db } = await freshMigratedDb();
    const person = await createEntity(db, { slug: 'a-person', kind: 'person', label: 'A Person' });
    const item = await stage(db, 'invention');
    await expect(correctCanonicalMatch(db, item.id, person.id, 'canonical_incomplete', 'Sahil')).rejects.toThrow(/incompatible kinds/);
  });
  it('a compatible target is accepted and the status is derived from the target', async () => {
    const { db } = await freshMigratedDb();
    const tech = await createEntity(db, { slug: 'a-tech', kind: 'technology', label: 'A Technology', graphStatus: 'canonical_complete' });
    const item = await stage(db, 'invention'); // invention↔technology family
    const res = await correctCanonicalMatch(db, item.id, tech.id, null, 'Sahil');
    expect(res.item.matchEntityId).toBe(tech.id);
    expect(res.item.matchStatus).toBe('canonical_complete'); // derived from target state
  });
  it('a supplied status that disagrees with the target state is rejected', async () => {
    const { db } = await freshMigratedDb();
    const tech = await createEntity(db, { slug: 'a-tech2', kind: 'technology', label: 'Tech 2', graphStatus: 'canonical_incomplete' });
    const item = await stage(db, 'invention');
    await expect(correctCanonicalMatch(db, item.id, tech.id, 'canonical_complete', 'Sahil')).rejects.toThrow(/derived from the target/);
  });
  it('the target search excludes synthetic and incompatible kinds', async () => {
    const { db } = await freshMigratedDb();
    await createEntity(db, { slug: 'good-inv', kind: 'invention', label: 'Good Invention' });
    await createEntity(db, { slug: 'synth-inv', kind: 'invention', label: 'Synthetic Invention', isSynthetic: true });
    await createEntity(db, { slug: 'a-person2', kind: 'person', label: 'Person Two' });
    const targets = await searchCanonicalMatchTargets(db, { candidateKind: 'invention' });
    const slugs = targets.map((t) => t.slug);
    expect(slugs).toContain('good-inv');
    expect(slugs).not.toContain('synth-inv');
    expect(slugs).not.toContain('a-person2');
  });
});

/* 5 — generic edit bypass --------------------------------------------- */
describe('5. generic edit validation bypass', () => {
  async function relItem(db: DB) {
    const { result } = await stageSubmittedPackage(db, heldEnvelope());
    const pkg = result.package;
    return (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.packageId, pkg.id) })).find((i) => i.section === 'relationship')!;
  }
  it('the generic editor rejects protected relationship fields', async () => {
    const { db } = await freshMigratedDb();
    const rel = await relItem(db);
    await expect(editPackageItemFields(db, rel.id, { typeKey: 'improved_by' }, 'Sahil')).rejects.toThrow(/generic editor/);
    await expect(editPackageItemFields(db, rel.id, { sourceRef: 'other' }, 'Sahil')).rejects.toThrow(/generic editor/);
    await expect(editPackageItemFields(db, rel.id, { targetRef: 'central' }, 'Sahil')).rejects.toThrow(/generic editor/);
    await expect(editPackageItemFields(db, rel.id, { held: false }, 'Sahil')).rejects.toThrow(/generic editor/);
  });
  it('the generic editor rejects protected canonical-match fields on entities', async () => {
    const { db } = await freshMigratedDb();
    const { result } = await stageSubmittedPackage(db, heldEnvelope());
    const pkg = result.package;
    const ent = (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.packageId, pkg.id) })).find((i) => i.section === 'entity')!;
    await expect(editPackageItemFields(db, ent.id, { matchEntityId: 'x' }, 'Sahil')).rejects.toThrow(/generic editor/);
    await expect(editPackageItemFields(db, ent.id, { isSynthetic: true }, 'Sahil')).rejects.toThrow(/generic editor/);
  });
});

/* 6 — concurrency idempotence ----------------------------------------- */
describe('6. concurrent terminal ops are idempotent', () => {
  it('two concurrent fails increment failedCount at most once', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    const job = await claimed(db, run.id, 'w1');
    await Promise.allSettled([failJob(db, job.id, 'a', 'w1', job.workerLock!), failJob(db, job.id, 'b', 'w1', job.workerLock!)]);
    expect((await runOf(db, run.id)).failedCount).toBe(1);
    expect((await db.query.researchJobs.findFirst({ where: eq(researchJobs.id, job.id) }))!.status).toBe('failed');
  });
  it('two concurrent releases decrement claimedCount at most once', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    const job = await claimed(db, run.id, 'w1');
    expect((await runOf(db, run.id)).claimedCount).toBe(1);
    await Promise.allSettled([releaseJob(db, job.id, 'w1', job.workerLock!), releaseJob(db, job.id, 'w1', job.workerLock!)]);
    expect((await runOf(db, run.id)).claimedCount).toBe(0);
  });
  it('two concurrent submissions create exactly one package', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    const job = await claimed(db, run.id, 'w1');
    const env = { schemaVersion: 1 as const, entities: [{ ref: 'central', role: 'central' as const, slug: 'conc-subject', label: 'Conc', kind: 'concept' as const, classifications: ['concept'] }] };
    await Promise.allSettled([submitPackage(db, job.id, env, { worker: 'w1', leaseToken: job.workerLock! }), submitPackage(db, job.id, env, { worker: 'w1', leaseToken: job.workerLock! })]);
    const pkgs = await db.query.researchPackages.findMany({ where: eq(researchPackages.jobId, job.id) });
    expect(pkgs.length).toBe(1);
    void entities;
  });
});
