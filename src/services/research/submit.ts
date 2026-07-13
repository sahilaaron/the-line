/**
 * Package submission. Validates the envelope against the authoritative Zod
 * contract, writes the immutable envelope snapshot plus normalized, reviewable
 * candidate rows, and runs the resolver over each proposed entity so the
 * reviewer sees existing-vs-new at a glance. Idempotent: re-submitting the same
 * content for the same job returns the existing package unchanged.
 */
import { eq } from 'drizzle-orm';
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
  opts: { submittedBy?: string } = {},
): Promise<SubmitResult> {
  const envelope: ResearchPackageEnvelope = researchPackageEnvelopeSchema.parse(rawEnvelope);
  const submissionHash = stableHash(envelope);
  const central = envelope.entities.find((e) => e.role === 'central')!;

  return db.transaction(async (tx) => {
    const job = await tx.query.researchJobs.findFirst({ where: eq(researchJobs.id, jobId) });
    if (!job) throw new Error(`job ${jobId} not found`);

    // idempotency: same job + same content -> return existing package
    const existing = await tx.query.researchPackages.findFirst({
      where: eq(researchPackages.jobId, jobId),
    });
    if (existing && existing.submissionHash === submissionHash) {
      return { package: existing, created: false };
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
    const push = (section: (typeof researchPackageItems.$inferInsert)['section'], items: { ref: string; held?: boolean }[]) => {
      for (const it of items) {
        rows.push({
          packageId: pkg.id,
          section,
          localRef: it.ref,
          payload: it as unknown as Record<string, unknown>,
          held: it.held ?? false,
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

    // Advance the job: claimed/researching -> submitted.
    if (job.status === 'claimed' || job.status === 'researching') {
      assertTransition(JOB_TRANSITIONS, job.status, 'submitted', 'job');
      await tx
        .update(researchJobs)
        .set({
          status: 'submitted',
          matchStatus: centralMatchStatus,
          matchEntityId: centralMatchEntityId,
          leaseExpiresAt: null,
          workerLock: null,
          updatedAt: new Date(),
        })
        .where(eq(researchJobs.id, jobId));
    }

    return { package: pkg, created: true };
  });
}
