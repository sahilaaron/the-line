/**
 * The queue/run kernel. A DETERMINISTIC pure selector (selectNextJob) plus a
 * transactional claim (claimNextJob) that enforces every locked rule:
 *  - a run cannot claim more work than its batch limit;
 *  - a stopped/stopping run cannot claim new work;
 *  - a job cannot be claimed by two workers (status + lease guard);
 *  - abandoned locks are recovered via lease expiry;
 *  - manual/returned beats frontier beats random discovery;
 *  - deterministic ordering inside each priority group (priority desc, seq asc);
 *  - only when no queued/frontier work exists does random discovery open a seed.
 */
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, lt, or } from 'drizzle-orm';
import { researchJobs, researchRuns, type ResearchJob, type ResearchRun } from '../../db/schema';
import type { Db } from '../../db/repositories/types';
import { DEFAULT_QUEUE_CONFIG, type QueueConfig } from './config';
import type { DiscoveryAdapter } from './discovery';
import { noDiscoveryAdapter } from './discovery';
import { normalizeText } from '../../db/repositories/graph-ext';

/** Priority-group index for an origin (lower = handled first). */
export function originRank(origin: ResearchJob['origin'], config: QueueConfig = DEFAULT_QUEUE_CONFIG): number {
  const idx = config.originPriority.indexOf(origin as (typeof config.originPriority)[number]);
  return idx === -1 ? config.originPriority.length : idx;
}

/** Deterministic ordering: origin rank, then priority desc, then sequence asc. */
export function orderJobs(jobs: ResearchJob[], config: QueueConfig = DEFAULT_QUEUE_CONFIG): ResearchJob[] {
  return [...jobs].sort((a, b) => {
    const ra = originRank(a.origin, config);
    const rb = originRank(b.origin, config);
    if (ra !== rb) return ra - rb;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.sequence - b.sequence;
  });
}

/** True if this job is eligible to be (re)claimed right now. */
export function isClaimable(job: ResearchJob, now: Date): boolean {
  if (job.status === 'queued') return true;
  // recoverable: a stuck claim whose lease has expired
  if ((job.status === 'claimed' || job.status === 'researching') && job.leaseExpiresAt) {
    return job.leaseExpiresAt.getTime() <= now.getTime();
  }
  return false;
}

/** Pure selection: the single next job to claim, or null. */
export function selectNextJob(
  jobs: ResearchJob[],
  run: Pick<ResearchRun, 'status' | 'stopRequested' | 'batchLimit' | 'claimedCount'>,
  now: Date,
  config: QueueConfig = DEFAULT_QUEUE_CONFIG,
): ResearchJob | null {
  if (run.status !== 'active' || run.stopRequested) return null;
  if (run.claimedCount >= run.batchLimit) return null;
  const eligible = orderJobs(jobs.filter((j) => isClaimable(j, now)), config);
  return eligible[0] ?? null;
}

export interface ClaimResult {
  job: ResearchJob | null;
  reason?: 'stopped' | 'batch_limit_reached' | 'empty_queue';
  recovered?: boolean;
  fromDiscovery?: boolean;
}

export interface ClaimOptions {
  now?: Date;
  config?: QueueConfig;
  discovery?: DiscoveryAdapter;
  worker?: string;
}

/** Recover any expired leases back to `queued` (outside a claim, e.g. a sweep). */
export async function recoverExpiredLeases(db: Db, now: Date = new Date()): Promise<number> {
  // Recovering an abandoned lease FREES the batch slot it consumed (equivalent
  // to a release), so the run can claim replacement work. Done per-job inside a
  // transaction to keep the job status and the run counter consistent.
  const expired = await db.query.researchJobs.findMany({
    where: and(
      inArray(researchJobs.status, ['claimed', 'researching']),
      lt(researchJobs.leaseExpiresAt, now),
    ),
  });
  let recovered = 0;
  for (const job of expired) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(researchJobs)
        .set({ status: 'queued', workerLock: null, claimedByWorker: null, claimedByRunId: null, leaseExpiresAt: null, updatedAt: new Date() })
        .where(and(eq(researchJobs.id, job.id), inArray(researchJobs.status, ['claimed', 'researching'])))
        .returning({ id: researchJobs.id });
      if (!row) return; // someone else changed it — skip
      if (job.claimedByRunId) {
        const run = await tx.query.researchRuns.findFirst({ where: eq(researchRuns.id, job.claimedByRunId) });
        if (run) {
          await tx.update(researchRuns)
            .set({ claimedCount: Math.max(0, run.claimedCount - 1), updatedAt: new Date() })
            .where(eq(researchRuns.id, job.claimedByRunId));
        }
      }
      recovered += 1;
    });
  }
  return recovered;
}

/**
 * Claim the next job for a run, atomically. Applies queue priority; if no
 * queued/frontier work exists and the run permits it, obtains a random seed
 * from the injected discovery adapter and claims that instead.
 */
export async function claimNextJob(db: Db, runId: string, opts: ClaimOptions = {}): Promise<ClaimResult> {
  const now = opts.now ?? new Date();
  const config = opts.config ?? DEFAULT_QUEUE_CONFIG;
  const discovery = opts.discovery ?? noDiscoveryAdapter;
  const token = `${opts.worker ?? 'worker'}:${randomUUID()}`;

  return db.transaction(async (tx) => {
    const run = await tx.query.researchRuns.findFirst({ where: eq(researchRuns.id, runId) });
    if (!run) throw new Error(`run ${runId} not found`);
    if (run.status !== 'active' || run.stopRequested) return { job: null, reason: 'stopped' as const };
    const atLimit = run.claimedCount >= run.batchLimit;

    // candidate pool: queued + recoverable-expired-lease jobs
    const pool = await tx.query.researchJobs.findMany({
      where: or(
        eq(researchJobs.status, 'queued'),
        and(
          inArray(researchJobs.status, ['claimed', 'researching']),
          lt(researchJobs.leaseExpiresAt, now),
        ),
      ),
    });
    // Deterministic ordering; then apply capacity. A run AT its batch limit may
    // still RECLAIM its OWN expired in-flight job (that job already holds a slot,
    // so reclaiming it is net-zero) but may NOT consume a new slot for a
    // different queued job or a fresh discovery seed. The capacity check must
    // therefore come AFTER selection, restricted to same-run reclaims when full.
    const eligible = orderJobs(pool.filter((j) => isClaimable(j, now)), config);
    const isSameRunReclaim = (j: ResearchJob) => j.status !== 'queued' && j.claimedByRunId === runId;
    let candidates = eligible;
    if (atLimit) {
      candidates = eligible.filter(isSameRunReclaim);
      if (candidates.length === 0) return { job: null, reason: 'batch_limit_reached' as const };
    }
    let chosen: ResearchJob | null = candidates[0] ?? null;
    let fromDiscovery = false;
    const recovered = chosen != null && chosen.status !== 'queued';

    // No queued/frontier work: try injected random discovery (consumes a slot,
    // so only when NOT at the batch limit — guaranteed here since at-limit runs
    // with no same-run reclaim already returned above).
    if (!chosen) {
      const seed = await discovery.nextSeed();
      if (!seed) return { job: null, reason: 'empty_queue' as const };
      const dedupeKey = normalizeText(seed.url ?? seed.title);
      const existing = await tx.query.researchJobs.findFirst({
        where: and(
          eq(researchJobs.dedupeKey, dedupeKey),
          inArray(researchJobs.status, ['queued', 'claimed', 'researching', 'submitted', 'completed']),
        ),
      });
      if (existing) {
        // Already known/queued — do not open a duplicate; nothing to claim now.
        return { job: null, reason: 'empty_queue' as const };
      }
      const nextSeq =
        (await tx.query.researchJobs.findMany({ columns: { sequence: true } })).reduce(
          (m, r) => Math.max(m, r.sequence),
          0,
        ) + 1;
      const [created] = await tx
        .insert(researchJobs)
        .values({
          centralTitle: seed.title,
          centralUrl: seed.url,
          origin: 'random_discovery',
          sequence: nextSeq,
          dedupeKey,
          status: 'queued',
        })
        .returning();
      chosen = created;
      fromDiscovery = true;
    }

    // Reclaiming an expired lease is NOT a second batch item: the prior run
    // already consumed a slot for this job. Capture the prior owner BEFORE the
    // update so we can release exactly that slot.
    const priorRunId = recovered ? chosen.claimedByRunId : null;

    // Claim it: guard against a racing claim via the status/lease predicate.
    const [claimed] = await tx
      .update(researchJobs)
      .set({
        status: 'claimed',
        claimedByRunId: runId,
        workerLock: token,
        claimedByWorker: opts.worker ?? 'worker',
        leaseExpiresAt: new Date(now.getTime() + config.leaseMs),
        attemptCount: chosen.attemptCount + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(researchJobs.id, chosen.id),
          // still claimable: queued, or an expired-lease recovery
          or(
            eq(researchJobs.status, 'queued'),
            and(
              inArray(researchJobs.status, ['claimed', 'researching']),
              lt(researchJobs.leaseExpiresAt, now),
            ),
          ),
        ),
      )
      .returning();
    if (!claimed) {
      // Someone else won the race between select and update.
      return { job: null, reason: 'empty_queue' as const };
    }

    // Counter bookkeeping. Consume exactly one slot for the NEW claim; if this
    // was an expired-lease reclaim, first RELEASE the prior run's slot so the
    // recovered job is never double-counted:
    //  - same run reclaiming its own expired job -> net claimedCount unchanged;
    //  - a different run reclaiming -> old run -1, new run +1.
    if (priorRunId && priorRunId !== runId) {
      const priorRun = await tx.query.researchRuns.findFirst({ where: eq(researchRuns.id, priorRunId) });
      if (priorRun) {
        await tx
          .update(researchRuns)
          .set({ claimedCount: Math.max(0, priorRun.claimedCount - 1), updatedAt: new Date() })
          .where(eq(researchRuns.id, priorRunId));
      }
    }
    if (priorRunId === runId) {
      // Same-run reclaim: the slot this job already holds is retained (net 0).
      await tx.update(researchRuns).set({ updatedAt: new Date() }).where(eq(researchRuns.id, runId));
    } else {
      await tx
        .update(researchRuns)
        .set({ claimedCount: run.claimedCount + 1, updatedAt: new Date() })
        .where(eq(researchRuns.id, runId));
    }
    return { job: claimed, recovered, fromDiscovery };
  });
}
