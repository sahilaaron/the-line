/**
 * Cycle 8 FINAL (v5) — permanent adversarial tests for the five locked
 * workstreams. Written to FAIL against tip ca51047 and PASS after v5.
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshMigratedDb } from '../../db/testing/setup';
import { researchJobs, researchPackageItems, researchPackages, researchRuns, researchPackageItemRevisions } from '../../db/schema';
import { createJob } from '../../db/repositories/research';
import { createRun } from './run';
import { claimNextJob, recoverExpiredLeases } from './queue';
import { heartbeatJob, releaseJob, failJob } from './queue-admin';
import { submitPackage } from './submit';
import { decidePackage } from './decision';
import { recordQa } from './qa';
import { setItemHold, clearAgentHold, confirmAgentHoldAsHuman } from './edit';
import { stageClaimedJob, stageSubmittedPackage } from './fixtures/staging';

type DB = Awaited<ReturnType<typeof freshMigratedDb>>['db'];
const runOf = async (db: DB, id: string) => (await db.query.researchRuns.findFirst({ where: eq(researchRuns.id, id) }))!;
const jobOf = async (db: DB, id: string) => (await db.query.researchJobs.findFirst({ where: eq(researchJobs.id, id) }))!;
const expire = (db: DB, jobId: string) =>
  db.update(researchJobs).set({ leaseExpiresAt: new Date(Date.now() - 60_000) }).where(eq(researchJobs.id, jobId));
const minimal = (slug: string) => ({ schemaVersion: 1 as const, entities: [{ ref: 'central', role: 'central' as const, slug, label: slug, kind: 'concept' as const, classifications: ['concept'] }] });
const heldEnvelope = () => ({
  schemaVersion: 1 as const,
  entities: [
    { ref: 'central', role: 'central' as const, slug: `held-${Math.random().toString(36).slice(2)}`, label: 'Held Subject', kind: 'invention' as const, classifications: ['invention'] },
    { ref: 'other', role: 'connected' as const, slug: `other-${Math.random().toString(36).slice(2)}`, label: 'Other', kind: 'person' as const, classifications: ['person'] },
  ],
  connections: [{ ref: 'rel-1', sourceRef: 'central', targetRef: 'other', typeKey: 'developed_by', held: true }],
  sources: [{ ref: 'src-1', title: 'A source' }],
  claims: [{ ref: 'claim-1', subjectRef: 'central', subjectSection: 'entity' as const, text: 'held claim', sourceLinks: [{ sourceRef: 'src-1' }] }],
});
const relItem = async (db: DB, pkgId: string) =>
  (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.packageId, pkgId) })).find((i) => i.section === 'relationship')!;

/* 1 — trusted bypass removed ------------------------------------------ */
describe('1. no forgeable trusted bypass', () => {
  it('a forged { trusted: true } runtime object cannot submit for an unclaimed queued job', async () => {
    const { db } = await freshMigratedDb();
    const job = await createJob(db, { centralTitle: 'Q', origin: 'manual', dedupeKey: 'q', status: 'queued' });
    const forged = { trusted: true, worker: 'attacker', leaseToken: 'anything' } as unknown as { worker: string; leaseToken: string };
    await expect(submitPackage(db, job.id, minimal('q-subject'), forged)).rejects.toThrow(/claimed\/researching/);
    expect((await db.query.researchPackages.findMany({ where: eq(researchPackages.jobId, job.id) })).length).toBe(0);
  });
});

/* 2 — authenticated replays ------------------------------------------- */
describe('2. authenticated idempotent replays', () => {
  it('same worker + same token replays; different worker, no worker, stale token, different content all reject', async () => {
    const { db } = await freshMigratedDb();
    const { job, worker, leaseToken } = await stageClaimedJob(db, { title: 'R', worker: 'w1' });
    const env = minimal('replay-subject');
    const first = await submitPackage(db, job.id, env, { worker, leaseToken });
    expect(first.created).toBe(true);
    // authentic replay
    const replay = await submitPackage(db, job.id, env, { worker, leaseToken });
    expect(replay.created).toBe(false);
    expect(replay.package.id).toBe(first.package.id);
    // different worker
    await expect(submitPackage(db, job.id, env, { worker: 'someone-else', leaseToken })).rejects.toThrow(/replay rejected/);
    // no worker
    await expect(submitPackage(db, job.id, env, { worker: '', leaseToken })).rejects.toThrow(/worker/);
    // stale/different token
    await expect(submitPackage(db, job.id, env, { worker, leaseToken: 'stale-token' })).rejects.toThrow(/replay rejected/);
    // different content
    await expect(submitPackage(db, job.id, minimal('changed'), { worker, leaseToken })).rejects.toThrow(/one package per job/);
  });
});

/* 4 — generation-safe leases ------------------------------------------ */
describe('4. generation-safe leases', () => {
  it('4.1 two concurrent claimers of a batchLimit=1 run: exactly one job claimed, claimedCount == 1', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 1 });
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    await createJob(db, { centralTitle: 'B', origin: 'manual', dedupeKey: 'b', status: 'queued' });
    const results = await Promise.allSettled([
      claimNextJob(db, run.id, { worker: 'c1' }),
      claimNextJob(db, run.id, { worker: 'c2' }),
    ]);
    const claimedJobs = results.filter((r) => r.status === 'fulfilled' && r.value.job).length;
    expect(claimedJobs).toBe(1);
    expect((await runOf(db, run.id)).claimedCount).toBe(1);
  });

  it('4.2/4.3/4.4 a stale token (after a same-worker reclaim) cannot heartbeat, release or fail the newer lease', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    const c1 = await claimNextJob(db, run.id, { worker: 'w1' });
    const token1 = c1.job!.workerLock!;
    await expire(db, c1.job!.id);
    const c2 = await claimNextJob(db, run.id, { worker: 'w1' }); // same-worker reclaim -> new token
    const token2 = c2.job!.workerLock!;
    expect(token2).not.toBe(token1);
    await expect(heartbeatJob(db, c1.job!.id, 'w1', token1)).rejects.toThrow(/rejected/);
    await expect(releaseJob(db, c1.job!.id, 'w1', token1)).rejects.toThrow(/rejected/);
    await expect(failJob(db, c1.job!.id, 'x', 'w1', token1)).rejects.toThrow(/rejected/);
    // the current token still works (4.9)
    expect((await heartbeatJob(db, c1.job!.id, 'w1', token2)).workerLock).toBe(token2);
  });

  it('4.5 a stale submit cannot create a package after ownership changes', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    const c1 = await claimNextJob(db, run.id, { worker: 'w1' });
    const token1 = c1.job!.workerLock!;
    await expire(db, c1.job!.id);
    const c2 = await claimNextJob(db, run.id, { worker: 'w2' }); // reclaimed by another worker
    expect(c2.job!.id).toBe(c1.job!.id);
    await expect(submitPackage(db, c1.job!.id, minimal('stale'), { worker: 'w1', leaseToken: token1 })).rejects.toThrow();
    expect((await db.query.researchPackages.findMany({ where: eq(researchPackages.jobId, c1.job!.id) })).length).toBe(0);
  });

  it('4.6 an expiry sweep does not queue a freshly RENEWED lease', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    const c1 = await claimNextJob(db, run.id, { worker: 'w1' });
    // Renew the LIVE lease (an expired lease can no longer be heartbeated).
    await heartbeatJob(db, c1.job!.id, 'w1', c1.job!.workerLock!);
    // A sweep must not recover a live (renewed) lease.
    expect(await recoverExpiredLeases(db)).toBe(0);
    expect((await jobOf(db, c1.job!.id)).status).not.toBe('queued');
    expect((await runOf(db, run.id)).claimedCount).toBe(1);
  });

  it('4.7 an expiry sweep does not queue a freshly RECLAIMED lease', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    const c1 = await claimNextJob(db, run.id, { worker: 'w1' });
    await expire(db, c1.job!.id);
    const c2 = await claimNextJob(db, run.id, { worker: 'w1' }); // reclaim (new lease)
    expect(await recoverExpiredLeases(db)).toBe(0);
    const j = await jobOf(db, c1.job!.id);
    expect(j.status).toBe('claimed');
    expect(j.workerLock).toBe(c2.job!.workerLock);
    expect((await runOf(db, run.id)).claimedCount).toBe(1);
  });

  it('4.10 concurrent terminal ops apply counters exactly once', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    const c = await claimNextJob(db, run.id, { worker: 'w1' });
    await Promise.allSettled([
      failJob(db, c.job!.id, 'a', 'w1', c.job!.workerLock!),
      failJob(db, c.job!.id, 'b', 'w1', c.job!.workerLock!),
    ]);
    expect((await runOf(db, run.id)).failedCount).toBe(1);
  });
});

/* 5 — human resolution of agent holds --------------------------------- */
describe('5. human resolution of agent holds', () => {
  it('5.1 agent-only hold -> clear -> effective held false (and promotable)', async () => {
    const { db } = await freshMigratedDb();
    const { result } = await stageSubmittedPackage(db, heldEnvelope());
    const rel = await relItem(db, result.package.id);
    expect(rel.agentHeld).toBe(true);
    await clearAgentHold(db, rel.id, 'Sahil');
    const after = (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.id, rel.id) }))[0];
    expect(after.agentHeld).toBe(false);
    expect(after.held).toBe(false);
    // promotable: approve_with_holds now promotes the (no-longer-held) relationship
    await decidePackage(db, result.package.id, { decision: 'approve_with_holds', heldItems: [] });
    expect((await db.query.relationships.findMany()).length).toBe(1);
  });

  it('5.2 agent-only hold -> confirm -> humanHeld true, agentHeld false, excluded from promotion', async () => {
    const { db } = await freshMigratedDb();
    const { result } = await stageSubmittedPackage(db, heldEnvelope());
    const rel = await relItem(db, result.package.id);
    await confirmAgentHoldAsHuman(db, rel.id, 'Sahil');
    const after = (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.id, rel.id) }))[0];
    expect(after.humanHeld).toBe(true);
    expect(after.agentHeld).toBe(false);
    expect(after.held).toBe(true);
    await decidePackage(db, result.package.id, { decision: 'approve_with_holds', heldItems: [] });
    expect((await db.query.relationships.findMany()).length).toBe(0); // stays held
  });

  it('5.3 agent + QA hold -> clear agent -> QA hold remains effective', async () => {
    const { db } = await freshMigratedDb();
    const { result } = await stageSubmittedPackage(db, heldEnvelope());
    const rel = await relItem(db, result.package.id);
    await recordQa(db, result.package.id, { recommendation: 'hold', flags: [{ targetSection: 'relationship', targetRef: 'rel-1', severity: 'major', explanation: 'QA concern', state: 'hold' }] });
    const withQa = (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.id, rel.id) }))[0];
    expect(withQa.qaHeld).toBe(true);
    await clearAgentHold(db, rel.id, 'Sahil');
    const after = (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.id, rel.id) }))[0];
    expect(after.agentHeld).toBe(false);
    expect(after.qaHeld).toBe(true);
    expect(after.held).toBe(true); // still held by QA
  });

  it('5.4 agent + human hold -> clear agent -> human hold remains effective', async () => {
    const { db } = await freshMigratedDb();
    const { result } = await stageSubmittedPackage(db, heldEnvelope());
    const rel = await relItem(db, result.package.id);
    await setItemHold(db, rel.id, true, 'Sahil'); // add human hold on top of agent
    await clearAgentHold(db, rel.id, 'Sahil');
    const after = (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.id, rel.id) }))[0];
    expect(after.agentHeld).toBe(false);
    expect(after.humanHeld).toBe(true);
    expect(after.held).toBe(true);
  });

  it('5.5 a finalized package rejects both resolution actions', async () => {
    const { db } = await freshMigratedDb();
    const { result } = await stageSubmittedPackage(db, heldEnvelope());
    const rel = await relItem(db, result.package.id);
    await decidePackage(db, result.package.id, { decision: 'reject', reason: 'not needed' });
    await expect(clearAgentHold(db, rel.id, 'Sahil')).rejects.toThrow(/before a final decision|is rejected/);
    await expect(confirmAgentHoldAsHuman(db, rel.id, 'Sahil')).rejects.toThrow(/before a final decision|is rejected/);
  });

  it('5.6 both actions append a revision recording prior and resulting hold sources', async () => {
    const { db } = await freshMigratedDb();
    const { result } = await stageSubmittedPackage(db, heldEnvelope());
    const rel = await relItem(db, result.package.id);
    await clearAgentHold(db, rel.id, 'Sahil', 'reviewed and cleared');
    const revs = await db.query.researchPackageItemRevisions.findMany({ where: eq(researchPackageItemRevisions.itemId, rel.id) });
    const rev = revs.find((r) => r.editKind === 'clear_agent_hold')!;
    expect(rev).toBeTruthy();
    expect(rev.editor).toBe('Sahil');
    expect((rev.beforeValue as { agentHeld?: boolean }).agentHeld).toBe(true);
    expect((rev.afterValue as { agentHeld?: boolean }).agentHeld).toBe(false);
    void researchPackageItemRevisions;
  });
});
