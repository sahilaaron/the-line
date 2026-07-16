/**
 * Test-only staging helpers. These use ONLY the public production path (create
 * run -> claim a job -> submit with the claim's worker + lease token). They are
 * NOT a lifecycle bypass — they exercise exactly what a real agent does, so
 * tests stay honest after the v5 removal of the trusted submission option.
 */
import { createRun } from '../run';
import { claimNextJob } from '../queue';
import { submitPackage, type SubmitResult } from '../submit';
import { createJob } from '../../../db/repositories/research';
import type { Db } from '../../../db/repositories/types';
import type { ResearchJob } from '../../../db/schema';

export interface StagedClaim {
  runId: string;
  job: ResearchJob;
  worker: string;
  leaseToken: string;
}

/** Create a run, queue a job, and claim it — returning the live lease identity. */
export async function stageClaimedJob(
  db: Db,
  opts: { title?: string; worker?: string; batchLimit?: number; origin?: ResearchJob['origin'] } = {},
): Promise<StagedClaim> {
  const worker = opts.worker ?? 'w1';
  const run = await createRun(db, { batchLimit: opts.batchLimit ?? 10 });
  await createJob(db, {
    centralTitle: opts.title ?? 'Staged',
    origin: opts.origin ?? 'manual',
    dedupeKey: `stage-${Math.random().toString(36).slice(2)}`,
    status: 'queued',
  });
  const claim = await claimNextJob(db, run.id, { worker });
  if (!claim.job) throw new Error(`stageClaimedJob: claim failed (${claim.reason})`);
  return { runId: run.id, job: claim.job, worker, leaseToken: claim.job.workerLock! };
}

/** Stage a claimed job AND submit a package through the real path. */
export async function stageSubmittedPackage(
  db: Db,
  envelope: unknown,
  opts: { title?: string; worker?: string; batchLimit?: number } = {},
): Promise<StagedClaim & { result: SubmitResult }> {
  const staged = await stageClaimedJob(db, opts);
  const result = await submitPackage(db, staged.job.id, envelope, { worker: staged.worker, leaseToken: staged.leaseToken });
  return { ...staged, result };
}
