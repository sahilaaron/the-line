/**
 * Cycle 8 final — expired-lease enforcement. An expired lease is no longer owned
 * by the worker even before recoverExpiredLeases reclaims it: the original
 * worker + token must NOT be able to begin, heartbeat, release or fail it. The
 * live-lease condition lives in the same guarded UPDATE as the ownership guard.
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshMigratedDb } from '../../db/testing/setup';
import { researchJobs, researchRuns } from '../../db/schema';
import { beginJob, heartbeatJob, releaseJob, failJob } from './queue-admin';
import { stageClaimedJob } from './fixtures/staging';

type DB = Awaited<ReturnType<typeof freshMigratedDb>>['db'];
const runOf = async (db: DB, id: string) => (await db.query.researchRuns.findFirst({ where: eq(researchRuns.id, id) }))!;
const expire = (db: DB, jobId: string) =>
  db.update(researchJobs).set({ leaseExpiresAt: new Date(Date.now() - 60_000) }).where(eq(researchJobs.id, jobId));

describe('expired lease enforcement', () => {
  it('1. an expired token cannot begin', async () => {
    const { db } = await freshMigratedDb();
    const { job, worker, leaseToken } = await stageClaimedJob(db);
    await expire(db, job.id);
    await expect(beginJob(db, job.id, worker, leaseToken)).rejects.toThrow(/rejected/);
    expect((await db.query.researchJobs.findFirst({ where: eq(researchJobs.id, job.id) }))!.status).toBe('claimed');
  });

  it('2. an expired token cannot heartbeat', async () => {
    const { db } = await freshMigratedDb();
    const { job, worker, leaseToken } = await stageClaimedJob(db);
    await expire(db, job.id);
    await expect(heartbeatJob(db, job.id, worker, leaseToken)).rejects.toThrow(/rejected/);
    // the lease was not extended (still expired)
    const after = (await db.query.researchJobs.findFirst({ where: eq(researchJobs.id, job.id) }))!;
    expect(after.leaseExpiresAt!.getTime()).toBeLessThan(Date.now());
  });

  it('3. an expired token cannot release, and claimedCount is unchanged', async () => {
    const { db } = await freshMigratedDb();
    const { runId, job, worker, leaseToken } = await stageClaimedJob(db);
    expect((await runOf(db, runId)).claimedCount).toBe(1);
    await expire(db, job.id);
    await expect(releaseJob(db, job.id, worker, leaseToken)).rejects.toThrow(/rejected/);
    expect((await runOf(db, runId)).claimedCount).toBe(1);
    expect((await db.query.researchJobs.findFirst({ where: eq(researchJobs.id, job.id) }))!.status).not.toBe('queued');
  });

  it('4. an expired token cannot fail, and failedCount is unchanged', async () => {
    const { db } = await freshMigratedDb();
    const { runId, job, worker, leaseToken } = await stageClaimedJob(db);
    expect((await runOf(db, runId)).failedCount).toBe(0);
    await expire(db, job.id);
    await expect(failJob(db, job.id, 'boom', worker, leaseToken)).rejects.toThrow(/rejected/);
    expect((await runOf(db, runId)).failedCount).toBe(0);
    expect((await db.query.researchJobs.findFirst({ where: eq(researchJobs.id, job.id) }))!.status).not.toBe('failed');
  });

  it('5. a live current token still succeeds for begin, heartbeat, release and fail', async () => {
    const { db } = await freshMigratedDb();
    // begin + heartbeat on one live claim
    const a = await stageClaimedJob(db, { title: 'A' });
    expect((await beginJob(db, a.job.id, a.worker, a.leaseToken)).status).toBe('researching');
    expect((await heartbeatJob(db, a.job.id, a.worker, a.leaseToken)).workerLock).toBe(a.leaseToken);
    // release on a second live claim
    const b = await stageClaimedJob(db, { title: 'B' });
    expect((await releaseJob(db, b.job.id, b.worker, b.leaseToken)).status).toBe('queued');
    // fail on a third live claim
    const c = await stageClaimedJob(db, { title: 'C' });
    expect((await failJob(db, c.job.id, 'no sources', c.worker, c.leaseToken)).status).toBe('failed');
  });
});
