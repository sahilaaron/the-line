/**
 * Cycle 8B — queue management + honest CoWork agent lease commands. All go
 * through repositories/services (no raw SQL in UI/CLI). Atomic claims + lease
 * recovery are preserved so multiple CoWork agents can never hold one job.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { researchJobs, researchRuns, type ResearchJob, type ResearchRun } from '../../db/schema';
import type { Db } from '../../db/repositories/types';
import { getJob, nextJobSequence } from '../../db/repositories/research';
import { DEFAULT_QUEUE_CONFIG } from './config';
import { settleRun } from './run';
import { claimNextJob, type ClaimOptions, type ClaimResult } from './queue';

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

/* ---- agent lease commands (begin / heartbeat / release / fail) ----
 *
 * Cycle 8B v5: worker name alone is NOT a sufficient lease identity — a reused
 * worker name after a reclaim must not let a STALE command mutate the NEWER
 * lease. Every lease mutation is a SINGLE guarded update conditioned on the
 * exact lease generation token (`workerLock`), the owning worker, and the
 * allowed status. A stale command matches ZERO rows and changes nothing. */

/** Explain why a guarded lease op matched no row (without leaking that a token
 * was wrong to a non-owner beyond what they already know). */
async function leaseRejected(exec: Db, jobId: string, op: string): Promise<never> {
  const job = await exec.query.researchJobs.findFirst({ where: eq(researchJobs.id, jobId) });
  if (!job) throw new Error(`job ${jobId} not found`);
  throw new Error(`job ${jobId}: ${op} rejected — the job is ${job.status} and not held under the supplied worker + lease token (the lease may have expired, been reclaimed, or already ended)`);
}

export async function beginJob(db: Db, jobId: string, worker: string, leaseToken: string): Promise<ResearchJob> {
  const [row] = await db.update(researchJobs)
    .set({ status: 'researching', leaseExpiresAt: new Date(Date.now() + DEFAULT_QUEUE_CONFIG.leaseMs), updatedAt: new Date() })
    .where(and(
      eq(researchJobs.id, jobId),
      eq(researchJobs.status, 'claimed'),
      eq(researchJobs.claimedByWorker, worker),
      eq(researchJobs.workerLock, leaseToken),
    ))
    .returning();
  if (!row) return leaseRejected(db, jobId, 'begin');
  return row;
}

export async function heartbeatJob(db: Db, jobId: string, worker: string, leaseToken: string): Promise<ResearchJob> {
  const [row] = await db.update(researchJobs)
    .set({ leaseExpiresAt: new Date(Date.now() + DEFAULT_QUEUE_CONFIG.leaseMs), updatedAt: new Date() })
    .where(and(
      eq(researchJobs.id, jobId),
      inArray(researchJobs.status, ['claimed', 'researching']),
      eq(researchJobs.claimedByWorker, worker),
      eq(researchJobs.workerLock, leaseToken),
    ))
    .returning();
  if (!row) return leaseRejected(db, jobId, 'heartbeat');
  return row;
}

/** Release a claimed job back to the queue. Verifies worker ownership and
 * FREES the batch slot it consumed (decrements claimedCount). Atomic. */
export async function releaseJob(db: Db, jobId: string, worker: string, leaseToken: string): Promise<ResearchJob> {
  return db.transaction(async (tx) => {
    // Guarded transition conditioned on the EXACT lease generation. A stale
    // release (old token after a reclaim) or a concurrent second release
    // matches 0 rows, so the atomic slot decrement runs EXACTLY once. The run
    // id is captured from the flipped row BEFORE it is cleared.
    const [row] = await tx.update(researchJobs)
      .set({ status: 'queued', workerLock: null, claimedByWorker: null, leaseExpiresAt: null, updatedAt: new Date() })
      .where(and(
        eq(researchJobs.id, jobId),
        inArray(researchJobs.status, ['claimed', 'researching']),
        eq(researchJobs.claimedByWorker, worker),
        eq(researchJobs.workerLock, leaseToken),
      ))
      .returning();
    if (!row) return leaseRejected(tx, jobId, 'release');
    const priorRunId = row.claimedByRunId;
    await tx.update(researchJobs).set({ claimedByRunId: null }).where(eq(researchJobs.id, jobId));
    if (priorRunId) {
      await tx.update(researchRuns)
        .set({ claimedCount: sql`GREATEST(0, ${researchRuns.claimedCount} - 1)`, updatedAt: new Date() })
        .where(eq(researchRuns.id, priorRunId));
    }
    return { ...row, claimedByRunId: null };
  });
}

/** Fail a claimed job. Verifies ownership, records the outcome EXACTLY ONCE
 * (idempotent — a repeat on an already-failed job is a no-op), and settles the
 * run. A failed attempt CONSUMES its batch slot (claimedCount is not restored). */
export async function failJob(db: Db, jobId: string, reason: string, worker: string, leaseToken: string): Promise<ResearchJob> {
  const runId = await db.transaction(async (tx) => {
    // Guarded transition conditioned on the EXACT lease generation. Only the one
    // call that flips claimed/researching -> failed under this token increments
    // failedCount. A stale fail (old token after a reclaim) or a concurrent
    // second fail matches 0 rows. An already-failed job is an idempotent no-op.
    const flipped = await tx.update(researchJobs)
      .set({ status: 'failed', lastError: reason, workerLock: null, claimedByWorker: null, leaseExpiresAt: null, updatedAt: new Date() })
      .where(and(
        eq(researchJobs.id, jobId),
        inArray(researchJobs.status, ['claimed', 'researching']),
        eq(researchJobs.claimedByWorker, worker),
        eq(researchJobs.workerLock, leaseToken),
      ))
      .returning({ id: researchJobs.id, runId: researchJobs.claimedByRunId });
    if (flipped.length === 0) {
      // Distinguish an idempotent no-op (already failed) from a stale/forbidden fail.
      const cur = await tx.query.researchJobs.findFirst({ where: eq(researchJobs.id, jobId) });
      if (!cur) throw new Error(`job ${jobId} not found`);
      if (cur.status === 'failed') return null; // idempotent — counter already applied once
      throw new Error(`job ${jobId}: fail rejected — the job is ${cur.status} and not held under the supplied worker + lease token`);
    }
    const rId = flipped[0].runId;
    if (rId) {
      await tx.update(researchRuns)
        .set({ failedCount: sql`${researchRuns.failedCount} + 1`, updatedAt: new Date() })
        .where(eq(researchRuns.id, rId));
      return rId;
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
