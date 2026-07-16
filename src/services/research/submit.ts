/**
 * Package submission. Validates the envelope against the authoritative Zod
 * contract, writes the immutable envelope snapshot plus normalized, reviewable
 * candidate rows, and runs the resolver over each proposed entity so the
 * reviewer sees existing-vs-new at a glance.
 *
 * Lifecycle (Cycle 8B v5): submission ALWAYS enforces the real queue lifecycle —
 * there is no trusted/internal bypass. A package is created only for a
 * CLAIMED/RESEARCHING job whose lease is LIVE, by the exact owning worker,
 * presenting the current lease-generation token (`workerLock`). A
 * queued/returned/failed/cancelled/completed job, an expired lease, a non-owner,
 * or a stale token cannot create a package.
 *
 * Idempotent replay is AUTHENTICATED: an identical re-submission returns the
 * existing package only when the caller presents the SAME worker AND the SAME
 * lease token recorded at the original submission. A different/absent worker or
 * a stale token is rejected. A DIFFERENT-content resubmission is rejected — ONE
 * package per job, also enforced by a UNIQUE(job_id) constraint. Authorization
 * is NEVER inferred from envelope contents.
 *
 * The final job transition is guarded on the exact observed lease generation, so
 * a lease reclaimed during normalization/resolution rolls the whole submission
 * back.
 */
import { and, eq, inArray } from 'drizzle-orm';
import {
  researchJobs,
  researchPackageItems,
  researchPackages,
  type ResearchPackage,
} from '../../db/schema';
import type { Db } from '../../db/repositories/types';
import {
  researchPackageEnvelopeSchema,
  type ResearchPackageEnvelope,
} from '../../db/validation/research';
import { stableHash } from './hash';
import { resolveEntity } from './resolver';
import { assertTransition, JOB_TRANSITIONS } from './state-machine';

export interface SubmitResult {
  package: ResearchPackage;
  created: boolean;
}

export interface SubmitOptions {
  /** The owning worker (must equal the job's claimedByWorker). Required. */
  worker: string;
  /** The lease-generation token returned by the claim (the job's workerLock at
   * claim time). Required — a stale token is rejected. */
  leaseToken: string;
  now?: Date;
}

export async function submitPackage(
  db: Db,
  jobId: string,
  rawEnvelope: unknown,
  opts: SubmitOptions,
): Promise<SubmitResult> {
  const envelope: ResearchPackageEnvelope = researchPackageEnvelopeSchema.parse(rawEnvelope);
  const submissionHash = stableHash(envelope);
  const central = envelope.entities.find((e) => e.role === 'central')!;
  const now = opts.now ?? new Date();
  const worker = opts.worker;
  const leaseToken = opts.leaseToken;
  if (!worker) throw new Error('submit requires the owning worker identity (--worker <your-name>)');
  if (!leaseToken) throw new Error('submit requires the lease token from the claim (--lease-token <token>)');

  return db.transaction(async (tx) => {
    const job = await tx.query.researchJobs.findFirst({ where: eq(researchJobs.id, jobId) });
    if (!job) throw new Error(`job ${jobId} not found`);

    // Idempotency + one-package-per-job. An identical replay is authenticated
    // against the ORIGINAL submission identity (worker + lease token) rather
    // than trusted blindly; a different-content resubmission is rejected.
    const existing = await tx.query.researchPackages.findFirst({
      where: eq(researchPackages.jobId, jobId),
    });
    if (existing) {
      if (existing.submissionHash !== submissionHash) {
        throw new Error(`job ${jobId} already has package ${existing.id}; one package per job — submit a correction as a new job`);
      }
      if (existing.submittedBy !== worker) {
        throw new Error(`replay rejected — package ${existing.id} was submitted by "${existing.submittedBy ?? 'unknown'}", not "${worker}"`);
      }
      if (existing.submissionLeaseToken !== leaseToken) {
        throw new Error(`replay rejected — the supplied lease token does not match the original submission lease for package ${existing.id}`);
      }
      return { package: existing, created: false };
    }

    // Production lifecycle enforcement for NEW package creation — always.
    if (job.status !== 'claimed' && job.status !== 'researching') {
      throw new Error(`job ${jobId} is ${job.status}; only a claimed/researching job may submit a package`);
    }
    if (job.claimedByWorker !== worker) {
      throw new Error(`job ${jobId} lease is owned by "${job.claimedByWorker ?? 'none'}", not "${worker}"`);
    }
    if (job.workerLock !== leaseToken) {
      throw new Error(`job ${jobId}: the supplied lease token does not match the current lease (it may have been reclaimed)`);
    }
    if (!job.leaseExpiresAt || job.leaseExpiresAt.getTime() <= now.getTime()) {
      throw new Error(`job ${jobId} lease has expired; reclaim the job before submitting`);
    }

    const [pkg] = await tx
      .insert(researchPackages)
      .values({
        jobId,
        runId: job.claimedByRunId ?? undefined,
        centralLabel: central.label,
        centralSlug: central.slug,
        status: 'submitted',
        schemaVersion: envelope.schemaVersion,
        envelope: envelope as unknown as Record<string, unknown>,
        submissionHash,
        submittedBy: worker,
        submissionLeaseToken: leaseToken,
      })
      .returning();

    // Normalized candidate rows, one per section item.
    const rows: (typeof researchPackageItems.$inferInsert)[] = [];
    let centralMatchStatus: string | undefined;
    let centralMatchEntityId: string | undefined;

    for (const e of envelope.entities) {
      const res = await resolveEntity(tx, {
        slug: e.slug,
        label: e.label,
        aliases: e.aliases.map((a) => a.alias),
        externalIds: e.externalIds,
      });
      if (e.role === 'central') {
        centralMatchStatus = res.status;
        centralMatchEntityId = res.entity?.id;
      }
      rows.push({
        packageId: pkg.id,
        section: 'entity',
        localRef: e.ref,
        payload: e as unknown as Record<string, unknown>,
        matchEntityId: res.entity?.id,
        matchStatus: res.status,
        isSynthetic: e.isSynthetic,
      });
    }
    // Envelope-proposed holds carry AGENT provenance (proposed by the research
    // agent before QA/human review). Effective `held` = the OR of all sources;
    // at submission only agentHeld can be set, so held === agentHeld here.
    const push = (section: (typeof researchPackageItems.$inferInsert)['section'], items: { ref: string; held?: boolean }[]) => {
      for (const it of items) {
        const held = it.held ?? false;
        rows.push({
          packageId: pkg.id,
          section,
          localRef: it.ref,
          payload: it as unknown as Record<string, unknown>,
          held,
          agentHeld: held,
        });
      }
    };
    push('time', envelope.chronology);
    push('relationship', envelope.connections);
    push('source', envelope.sources);
    push('claim', envelope.claims);
    push('media', envelope.media);
    push('question', envelope.questions);
    push('next_entity', envelope.nextEntities);

    if (rows.length) await tx.insert(researchPackageItems).values(rows);

    // Advance the job: claimed/researching -> submitted, GUARDED on the exact
    // observed lease generation (id + status + owning worker + lease token). If
    // the lease was reclaimed during normalization/resolution the guard matches
    // 0 rows and the whole submission rolls back.
    assertTransition(JOB_TRANSITIONS, job.status, 'submitted', 'job');
    const advanced = await tx
      .update(researchJobs)
      .set({
        status: 'submitted',
        matchStatus: centralMatchStatus,
        matchEntityId: centralMatchEntityId,
        leaseExpiresAt: null,
        workerLock: null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(researchJobs.id, jobId),
        inArray(researchJobs.status, ['claimed', 'researching']),
        eq(researchJobs.claimedByWorker, worker),
        eq(researchJobs.workerLock, leaseToken),
      ))
      .returning({ id: researchJobs.id });
    if (advanced.length === 0) throw new Error(`job ${jobId}: lease changed during submission; submission rolled back`);

    return { package: pkg, created: true };
  });
}
