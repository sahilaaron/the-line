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
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
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
      // Guard on the EXACT expired lease generation observed by the sweep:
      // the same lock token AND the same (expired) lease timestamp. If the
      // worker renewed the lease (leaseExpiresAt changed) or another worker
      // reclaimed it (workerLock changed) after selection, this matches ZERO
      // rows and the run counter is left untouched. claimedByRunId is kept in
      // the flip so the freed slot can be decremented, then cleared.
      const [row] = await tx
        .update(researchJobs)
        .set({ status: 'queued', workerLock: null, claimedByWorker: null, leaseExpiresAt: null, updatedAt: new Date() })
        .where(and(
          eq(researchJobs.id, job.id),
          inArray(researchJobs.status, ['claimed', 'researching']),
          job.workerLock == null ? isNull(researchJobs.workerLock) : eq(researchJobs.workerLock, job.workerLock),
          job.leaseExpiresAt == null ? isNull(researchJobs.leaseExpiresAt) : eq(researchJobs.leaseExpiresAt, job.leaseExpiresAt),
          lt(researchJobs.leaseExpiresAt, now),
        ))
        .returning({ id: researchJobs.id, runId: researchJobs.claimedByRunId });
      if (!row) return; // renewed or reclaimed after the sweep selected it — skip
      const priorRunId = row.runId;
      await tx.update(researchJobs).set({ claimedByRunId: null }).where(eq(researchJobs.id, job.id));
      if (priorRunId) {
        await tx.update(researchRuns)
          .set({ claimedCount: sql`GREATEST(0, ${researchRuns.claimedCount} - 1)`, updatedAt: new Date() })
          .where(eq(researchRuns.id, priorRunId));
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
    // already consumed a slot for this job. Capture the prior owner so we can
    // release exactly that slot.
    const priorRunId = recovered ? chosen.claimedByRunId : null;
    const sameRunReclaim = priorRunId === runId;

    // Reserve a slot ATOMICALLY for anything that consumes one (a fresh claim,
    // a discovery seed, or a cross-run reclaim). The guarded conditional
    // increment (claimedCount < batchLimit) is the authoritative gate: two
    // concurrent claimers cannot oversubscribe the run. A same-run reclaim
    // consumes no new slot, so it is skipped.
    if (!sameRunReclaim) {
      const reserved = await tx
        .update(researchRuns)
        .set({ claimedCount: sql`${researchRuns.claimedCount} + 1`, updatedAt: new Date() })
        .where(and(eq(researchRuns.id, runId), lt(researchRuns.claimedCount, researchRuns.batchLimit)))
        .returning({ id: researchRuns.id });
      if (reserved.length === 0) return { job: null, reason: 'batch_limit_reached' as const };
    }

    // Claim the job. Guard against a racing claim via the status/lease
    // predicate; on failure the reservation above rolls back with the tx.
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
      // Someone else won the race between select and update — roll back.
      throw new Error('claim race: selected job was taken concurrently');
    }

    // A cross-run reclaim frees the FORMER run's slot exactly once.
    if (priorRunId && priorRunId !== runId) {
      await tx
        .update(researchRuns)
        .set({ claimedCount: sql`GREATEST(0, ${researchRuns.claimedCount} - 1)`, updatedAt: new Date() })
        .where(eq(researchRuns.id, priorRunId));
    }
    return { job: claimed, recovered, fromDiscovery };
  });
}
