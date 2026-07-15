/**
 * Package submission. Validates the envelope against the authoritative Zod
 * contract, writes the immutable envelope snapshot plus normalized, reviewable
 * candidate rows, and runs the resolver over each proposed entity so the
 * reviewer sees existing-vs-new at a glance.
 *
 * Lifecycle (Cycle 8B v4): only a CLAIMED/RESEARCHING job whose lease is LIVE
 * may create a package, and the submitter must be the exact owning worker. This
 * closes the queue: a queued/returned/failed/cancelled/completed job, an expired
 * lease, or a non-owner cannot create a package. Re-submitting IDENTICAL content
 * is idempotent (returns the existing package). A DIFFERENT-content second
 * submission is rejected — ONE package per job (a correction is a NEW job); this
 * is also enforced at the database level by a UNIQUE(job_id) constraint.
 * Seed/demo helpers pass { trusted: true } to use an explicit internal path;
 * the production service is never weakened for fixtures.
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

export async function submitPackage(
  db: Db,
  jobId: string,
  rawEnvelope: unknown,
  opts: { submittedBy?: string; worker?: string; trusted?: boolean; now?: Date } = {},
): Promise<SubmitResult> {
  const envelope: ResearchPackageEnvelope = researchPackageEnvelopeSchema.parse(rawEnvelope);
  const submissionHash = stableHash(envelope);
  const central = envelope.entities.find((e) => e.role === 'central')!;
  const now = opts.now ?? new Date();

  return db.transaction(async (tx) => {
    const job = await tx.query.researchJobs.findFirst({ where: eq(researchJobs.id, jobId) });
    if (!job) throw new Error(`job ${jobId} not found`);

    // Idempotency + one-package-per-job. Checked first so an identical replay is
    // a harmless no-op for the owner; a DIFFERENT-content resubmission is rejected.
    const existing = await tx.query.researchPackages.findFirst({
      where: eq(researchPackages.jobId, jobId),
    });
    if (existing) {
      if (existing.submissionHash === submissionHash) return { package: existing, created: false };
      throw new Error(`job ${jobId} already has package ${existing.id}; one package per job — submit a correction as a new job`);
    }

    // Production lifecycle enforcement for NEW package creation. Trusted internal
    // callers (seed/demo) bypass this explicitly.
    if (!opts.trusted) {
      if (job.status !== 'claimed' && job.status !== 'researching') {
        throw new Error(`job ${jobId} is ${job.status}; only a claimed/researching job may submit a package`);
      }
      if (!opts.worker) throw new Error(`submit requires the owning worker identity (--worker <your-name>)`);
      const owner = job.claimedByWorker ?? job.workerLock?.split(':')[0] ?? null;
      if (owner !== opts.worker) throw new Error(`job ${jobId} lease is owned by "${owner ?? 'none'}", not "${opts.worker}"`);
      if (!job.leaseExpiresAt || job.leaseExpiresAt.getTime() <= now.getTime()) {
        throw new Error(`job ${jobId} lease has expired; reclaim the job before submitting`);
      }
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
        submittedBy: opts.submittedBy,
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
    // at submission only agentHeld can be set, so held === agentHeld here. This
    // satisfies research_package_items_held_consistent without fabricating QA or
    // human provenance.
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

    // Advance the job: claimed/researching -> submitted. Guarded conditional
    // update so a concurrent terminal op (e.g. another worker reclaiming) can
    // never race this transition.
    if (job.status === 'claimed' || job.status === 'researching') {
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
        .where(and(eq(researchJobs.id, jobId), inArray(researchJobs.status, ['claimed', 'researching'])))
        .returning({ id: researchJobs.id });
      if (advanced.length === 0) throw new Error(`job ${jobId} changed state concurrently; submission aborted`);
    }

    return { package: pkg, created: true };
  });
}
