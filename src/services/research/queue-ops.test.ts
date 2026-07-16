/** Cycle 8B — honest CoWork queue: display states + queue admin + agent leases. */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshMigratedDb } from '../../db/testing/setup';
import { researchJobs, type ResearchJob } from '../../db/schema';
import { createRun } from './run';
import { createJob } from '../../db/repositories/research';
import { claimNextJob } from './queue';
import { jobDisplayState, activeAgentCount, AWAITING_AGENTS } from './display-state';
import { editJobPriority, editJobFocusNote, cancelJob, requeueJob, beginJob, heartbeatJob, releaseJob, failJob, claimNextForActiveRun } from './queue-admin';

const T = new Date('2026-07-20T00:00:00Z');
const mk = (p: Partial<ResearchJob>): ResearchJob => ({ status: 'queued', leaseExpiresAt: null, ...p } as ResearchJob);

describe('honest display states', () => {
  it('an unclaimed queued job is exactly "Awaiting Agent(s)"', () => {
    expect(jobDisplayState(mk({ status: 'queued' }), undefined, T)).toBe(AWAITING_AGENTS);
    expect(AWAITING_AGENTS).toBe('Awaiting Agent(s)');
  });
  it('a claimed job with a live lease reads Claimed; an expired lease reads Awaiting Agent(s)', () => {
    expect(jobDisplayState(mk({ status: 'claimed', leaseExpiresAt: new Date(T.getTime() + 1000) }), undefined, T)).toBe('Claimed');
    expect(jobDisplayState(mk({ status: 'claimed', leaseExpiresAt: new Date(T.getTime() - 1000) }), undefined, T)).toBe(AWAITING_AGENTS);
  });
  it('submitted disambiguates Awaiting QA vs Ready for review', () => {
    expect(jobDisplayState(mk({ status: 'submitted' }), 'qa_pending', T)).toBe('Awaiting QA');
    expect(jobDisplayState(mk({ status: 'submitted' }), 'qa_complete', T)).toBe('Ready for review');
  });
  it('active agent count comes from unexpired claimed/researching leases', () => {
    const jobs = [
      mk({ status: 'claimed', leaseExpiresAt: new Date(T.getTime() + 1000) }),
      mk({ status: 'researching', leaseExpiresAt: new Date(T.getTime() + 1000) }),
      mk({ status: 'claimed', leaseExpiresAt: new Date(T.getTime() - 1000) }),
      mk({ status: 'queued' }),
    ];
    expect(activeAgentCount(jobs, T)).toBe(2);
  });
});

describe('queue admin', () => {
  it('edits priority / focus note only on a queued job; cancels; requeues', async () => {
    const { db } = await freshMigratedDb();
    const job = await createJob(db, { centralTitle: 'Toothpaste', origin: 'manual', dedupeKey: 'toothpaste', status: 'queued' });
    expect((await editJobPriority(db, job.id, 80)).priority).toBe(80);
    expect((await editJobFocusNote(db, job.id, 'focus on fluoride era')).focusNote).toBe('focus on fluoride era');
    const cancelled = await cancelJob(db, job.id);
    expect(cancelled.status).toBe('cancelled');
    const requeued = await requeueJob(db, job.id);
    expect(requeued.status).toBe('queued');
    // cannot edit priority once claimed
    const run = await createRun(db, { batchLimit: 5 });
    await claimNextJob(db, run.id);
    await expect(editJobPriority(db, job.id, 10)).rejects.toThrow(/only a queued/i);
  });

  it('begin -> heartbeat extends the lease; release returns to queue; fail records error', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    await createJob(db, { centralTitle: 'X', origin: 'manual', dedupeKey: 'x', status: 'queued' });
    const claim = await claimNextJob(db, run.id, { worker: 'agentA' });
    const jid = claim.job!.id;
    const tok = claim.job!.workerLock!;
    const begun = await beginJob(db, jid, 'agentA', tok);
    expect(begun.status).toBe('researching');
    const before = (await db.query.researchJobs.findFirst({ where: eq(researchJobs.id, jid) }))!.leaseExpiresAt!;
    const beat = await heartbeatJob(db, jid, 'agentA', tok);
    expect(beat.leaseExpiresAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    const released = await releaseJob(db, jid, 'agentA', tok);
    expect(released.status).toBe('queued');
    // re-claim + fail
    const c2 = await claimNextJob(db, run.id, { worker: 'agentB' });
    const failed = await failJob(db, c2.job!.id, 'source unavailable', 'agentB', c2.job!.workerLock!);
    expect(failed.status).toBe('failed');
    expect(failed.lastError).toBe('source unavailable');
  });

  it('claim-next-active fails safely when more than one active run exists', async () => {
    const { db } = await freshMigratedDb();
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    const r1 = await createRun(db, { batchLimit: 5 });
    const single = await claimNextForActiveRun(db, { worker: 'a' });
    expect(single.runId).toBe(r1.id);
    expect(single.job).toBeTruthy();
    await createRun(db, { batchLimit: 5 }); // now two active runs
    const ambiguous = await claimNextForActiveRun(db, { worker: 'a' });
    expect(ambiguous.job).toBeNull();
    expect(ambiguous.ambiguousRunIds!.length).toBe(2);
  });

  it('two agents cannot both claim the same single job (atomic)', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    await createJob(db, { centralTitle: 'only', origin: 'manual', dedupeKey: 'only', status: 'queued' });
    const a = await claimNextJob(db, run.id, { worker: 'A' });
    const b = await claimNextJob(db, run.id, { worker: 'B' });
    expect(a.job).toBeTruthy();
    expect(b.job).toBeNull();
  });
});
