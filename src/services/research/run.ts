/**
 * Run lifecycle. A run is started with a positive batch limit and continues
 * until (a) it has claimed its batch limit AND all claimed jobs have settled,
 * or (b) an operator stops it. Stopping is SAFE: it blocks new claims
 * immediately (the queue selector checks stopRequested) while letting any
 * in-flight job finish; the run settles to `stopped` once nothing is in flight.
 */
import { and, count, eq, inArray } from 'drizzle-orm';
import { researchJobs, researchRuns, type ResearchRun } from '../../db/schema';
import type { Db } from '../../db/repositories/types';
import { createRunSchema, type CreateRunInput } from '../../db/validation/research';
import { DEFAULT_QUEUE_CONFIG } from './config';
import { assertTransition, RUN_TRANSITIONS } from './state-machine';

export async function createRun(db: Db, input: CreateRunInput): Promise<ResearchRun> {
  const parsed = createRunSchema.parse(input);
  const [row] = await db
    .insert(researchRuns)
    .values({
      batchLimit: parsed.batchLimit,
      operator: parsed.operator,
      status: 'active',
      configSnapshot: {
        leaseMs: DEFAULT_QUEUE_CONFIG.leaseMs,
        originPriority: DEFAULT_QUEUE_CONFIG.originPriority,
      },
    })
    .returning();
  return row;
}

async function inFlightCount(db: Db, runId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(researchJobs)
    .where(
      and(
        eq(researchJobs.claimedByRunId, runId),
        inArray(researchJobs.status, ['claimed', 'researching']),
      ),
    );
  return row?.n ?? 0;
}

/** Request a safe stop: blocks new claims now; settles to stopped when idle. */
export async function requestStop(db: Db, runId: string): Promise<ResearchRun | undefined> {
  const run = await db.query.researchRuns.findFirst({ where: eq(researchRuns.id, runId) });
  if (!run) return undefined;
  if (run.status === 'stopped' || run.status === 'completed' || run.status === 'failed') return run;
  assertTransition(RUN_TRANSITIONS, run.status, 'stopping', 'run');
  const [row] = await db
    .update(researchRuns)
    .set({ status: 'stopping', stopRequested: true, updatedAt: new Date() })
    .where(eq(researchRuns.id, runId))
    .returning();
  return settleRun(db, runId).then((settled) => settled ?? row);
}

/**
 * Recompute run status after a job outcome. Returns the (possibly updated)
 * run. Never forces an illegal transition.
 */
export async function settleRun(db: Db, runId: string): Promise<ResearchRun | undefined> {
  const run = await db.query.researchRuns.findFirst({ where: eq(researchRuns.id, runId) });
  if (!run) return undefined;
  if (run.status === 'stopped' || run.status === 'completed' || run.status === 'failed') return run;
  const flying = await inFlightCount(db, runId);
  let next: ResearchRun['status'] = run.status;
  let stoppedAt = run.stoppedAt;
  let completedAt = run.completedAt;

  if (run.stopRequested) {
    if (flying === 0) {
      next = 'stopped';
      stoppedAt = new Date();
    }
  } else if (run.claimedCount >= run.batchLimit && flying === 0) {
    next = 'completed';
    completedAt = new Date();
  }
  if (next === run.status) return run;
  assertTransition(RUN_TRANSITIONS, run.status, next, 'run');
  const [row] = await db
    .update(researchRuns)
    .set({ status: next, stoppedAt, completedAt, updatedAt: new Date() })
    .where(eq(researchRuns.id, runId))
    .returning();
  return row;
}

/** Bump a run outcome counter and settle. */
export async function recordJobOutcome(
  db: Db,
  runId: string,
  outcome: 'completed' | 'failed' | 'returned',
): Promise<void> {
  const run = await db.query.researchRuns.findFirst({ where: eq(researchRuns.id, runId) });
  if (!run) return;
  const patch =
    outcome === 'completed'
      ? { completedCount: run.completedCount + 1 }
      : outcome === 'failed'
        ? { failedCount: run.failedCount + 1 }
        : { returnedCount: run.returnedCount + 1 };
  await db.update(researchRuns).set({ ...patch, updatedAt: new Date() }).where(eq(researchRuns.id, runId));
  await settleRun(db, runId);
}
