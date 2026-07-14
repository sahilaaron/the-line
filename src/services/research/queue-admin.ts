/**
 * Cycle 8B — queue management + honest CoWork agent lease commands. All go
 * through repositories/services (no raw SQL in UI/CLI). Atomic claims + lease
 * recovery are preserved so multiple CoWork agents can never hold one job.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { researchJobs, researchRuns, type ResearchJob, type ResearchRun } from '../../db/schema';
import type { Db } from '../../db/repositories/types';
import { getJob, nextJobSequence } from '../../db/repositories/research';
import { DEFAULT_QUEUE_CONFIG } from './config';
import { settleRun } from './run';
import { claimNextJob, type ClaimOptions, type ClaimResult } from './queue';

/** Exact worker ownership (never prefix-matched): 'agent-1' must not operate a
 * lease owned by 'agent-10'. */
function assertOwner(job: ResearchJob, worker: string) {
  const owner = job.claimedByWorker ?? job.workerLock?.split(':')[0] ?? null;
  if (owner !== worker) throw new Error(`job ${job.id} lease is owned by "${owner ?? 'none'}", not "${worker}"`);
}

function assertQueued(job: ResearchJob) {
  if (job.status !== 'queued') throw new Error(`job ${job.id} is ${job.status}; only a queued (Awaiting Agent(s)) job can be edited/cancelled`);
}

export async function editJobPriority(db: Db, jobId: string, priority: number): Promise<ResearchJob> {
  if (!Number.isInteger(priority) || priority < 0 || priority > 100) throw new Error('priority must be an integer 0..100');
  const job = await getJob(db, jobId);
  if (!job) throw new Error(`job ${jobId} not found`);
  assertQueued(job);
  const [row] = await db.update(researchJobs).set({ priority, updatedAt: new Date() }).where(eq(researchJobs.id, jobId)).returning();
  return row;
}

export async function editJobFocusNote(db: Db, jobId: string, focusNote: string | null): Promise<ResearchJob> {
  const job = await getJob(db, jobId);
  if (!job) throw new Error(`job ${jobId} not found`);
  assertQueued(job);
  const [row] = await db.update(researchJobs).set({ focusNote, updatedAt: new Date() }).where(eq(researchJobs.id, jobId)).returning();
  return row;
}

export async function cancelJob(db: Db, jobId: string): Promise<ResearchJob> {
  const job = await getJob(db, jobId);
  if (!job) throw new Error(`job ${jobId} not found`);
  assertQueued(job);
  const [row] = await db.update(researchJobs).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(researchJobs.id, jobId)).returning();
  return row;
}

/** Requeue eligible failed/released work with a fresh queue position. */
export async function requeueJob(db: Db, jobId: string): Promise<ResearchJob> {
  const job = await getJob(db, jobId);
  if (!job) throw new Error(`job ${jobId} not found`);
  if (!['failed', 'returned', 'cancelled'].includes(job.status)) {
    throw new Error(`job ${jobId} is ${job.status}; only failed/returned/cancelled jobs can be requeued`);
  }
  const sequence = await nextJobSequence(db);
  const [row] = await db.update(researchJobs)
    .set({ status: 'queued', sequence, workerLock: null, leaseExpiresAt: null, claimedByRunId: null, lastError: null, updatedAt: new Date() })
    .where(eq(researchJobs.id, jobId)).returning();
  return row;
}

/* ---- agent lease commands (begin / heartbeat / release / fail) ---- */
export async function beginJob(db: Db, jobId: string, worker: string): Promise<ResearchJob> {
  const job = await getJob(db, jobId);
  if (!job) throw new Error(`job ${jobId} not found`);
  if (job.status !== 'claimed') throw new Error(`job ${jobId} is ${job.status}; begin requires a claimed job`);
  assertOwner(job, worker);
  const [row] = await db.update(researchJobs)
    .set({ status: 'researching', leaseExpiresAt: new Date(Date.now() + DEFAULT_QUEUE_CONFIG.leaseMs), updatedAt: new Date() })
    .where(eq(researchJobs.id, jobId)).returning();
  return row;
}

export async function heartbeatJob(db: Db, jobId: string, worker: string): Promise<ResearchJob> {
  const job = await getJob(db, jobId);
  if (!job) throw new Error(`job ${jobId} not found`);
  if (!['claimed', 'researching'].includes(job.status)) throw new Error(`job ${jobId} is ${job.status}; heartbeat requires a claimed/researching job`);
  assertOwner(job, worker);
  const [row] = await db.update(researchJobs)
    .set({ leaseExpiresAt: new Date(Date.now() + DEFAULT_QUEUE_CONFIG.leaseMs), updatedAt: new Date() })
    .where(eq(researchJobs.id, jobId)).returning();
  return row;
}

/** Release a claimed job back to the queue. Verifies worker ownership and
 * FREES the batch slot it consumed (decrements claimedCount). Atomic. */
export async function releaseJob(db: Db, jobId: string, worker: string): Promise<ResearchJob> {
  return db.transaction(async (tx) => {
    const job = await tx.query.researchJobs.findFirst({ where: eq(researchJobs.id, jobId) });
    if (!job) throw new Error(`job ${jobId} not found`);
    if (!['claimed', 'researching'].includes(job.status)) throw new Error(`job ${jobId} is ${job.status}; release requires a claimed/researching job`);
    assertOwner(job, worker);
    const [row] = await tx.update(researchJobs)
      .set({ status: 'queued', workerLock: null, claimedByWorker: null, leaseExpiresAt: null, claimedByRunId: null, updatedAt: new Date() })
      .where(eq(researchJobs.id, jobId)).returning();
    if (job.claimedByRunId) {
      const run = await tx.query.researchRuns.findFirst({ where: eq(researchRuns.id, job.claimedByRunId) });
      if (run) await tx.update(researchRuns).set({ claimedCount: Math.max(0, run.claimedCount - 1), updatedAt: new Date() }).where(eq(researchRuns.id, job.claimedByRunId));
    }
    return row;
  });
}

/** Fail a claimed job. Verifies ownership, records the outcome EXACTLY ONCE
 * (idempotent — a repeat on an already-failed job is a no-op), and settles the
 * run. A failed attempt CONSUMES its batch slot (claimedCount is not restored). */
export async function failJob(db: Db, jobId: string, reason: string, worker: string): Promise<ResearchJob> {
  const runId = await db.transaction(async (tx) => {
    const job = await tx.query.researchJobs.findFirst({ where: eq(researchJobs.id, jobId) });
    if (!job) throw new Error(`job ${jobId} not found`);
    if (job.status === 'failed') return null; // idempotent no-op
    if (!['claimed', 'researching'].includes(job.status)) throw new Error(`job ${jobId} is ${job.status}; fail requires a claimed/researching job`);
    assertOwner(job, worker);
    await tx.update(researchJobs)
      .set({ status: 'failed', lastError: reason, workerLock: null, claimedByWorker: null, leaseExpiresAt: null, updatedAt: new Date() })
      .where(eq(researchJobs.id, jobId));
    if (job.claimedByRunId) {
      const run = await tx.query.researchRuns.findFirst({ where: eq(researchRuns.id, job.claimedByRunId) });
      if (run) await tx.update(researchRuns).set({ failedCount: run.failedCount + 1, updatedAt: new Date() }).where(eq(researchRuns.id, job.claimedByRunId));
      return job.claimedByRunId;
    }
    return null;
  });
  if (runId) await settleRun(db, runId);
  return (await getJob(db, jobId))!;
}

/* ---- active runs + safe claim-next ---- */
export async function activeRuns(db: Db): Promise<ResearchRun[]> {
  return db.query.researchRuns.findMany({ where: inArray(researchRuns.status, ['active', 'stopping']) });
}

export interface ClaimNextActiveResult extends ClaimResult {
  runId?: string;
  ambiguousRunIds?: string[];
}

/** Claim the next job for THE single active run. Fails safely (listing the
 * choices) when more than one active run makes the target ambiguous. */
export async function claimNextForActiveRun(db: Db, opts: ClaimOptions = {}): Promise<ClaimNextActiveResult> {
  const runs = (await activeRuns(db)).filter((r) => r.status === 'active');
  if (runs.length === 0) return { job: null, reason: 'stopped', ambiguousRunIds: [] };
  if (runs.length > 1) {
    return { job: null, ambiguousRunIds: runs.map((r) => r.id) };
  }
  const res = await claimNextJob(db, runs[0].id, opts);
  return { ...res, runId: runs[0].id };
}

void and;
