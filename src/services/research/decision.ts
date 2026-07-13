/**
 * Human package decision — ONE final decision per package, even though
 * individual flagged items may be held/excluded. The per-item `decision`
 * (accepted/held/rejected) set here is AUTHORITATIVE for promotion; held and
 * rejected candidates stay in staging with their evidence (never deleted).
 *
 * approve                -> accept every item (reviewer overrides QA holds)
 * approve_with_holds     -> accept all except reviewer holds ∪ QA-held items
 * return                 -> back to the queue as a returned_correction job
 * merge                  -> point at an existing canonical entity (no dup)
 * reject                 -> reject all items; nothing enters canon
 *
 * approve / approve_with_holds trigger transactional promotion (a separate
 * atomic step: if it fails it rolls back entirely and the approval can retry).
 */
import { eq } from 'drizzle-orm';
import {
  packageDecisions,
  researchJobs,
  researchPackageItems,
  researchPackages,
  type PackageDecision,
} from '../../db/schema';
import type { Db } from '../../db/repositories/types';
import { findEntityBySlug } from '../../db/repositories/entities';
import { createJob, nextJobSequence } from '../../db/repositories/research';
import { normalizeText } from '../../db/repositories/graph-ext';
import { humanDecisionSchema, type HumanDecisionInput } from '../../db/validation/research';
import { assertTransition, PACKAGE_TRANSITIONS } from './state-machine';
import { promotePackage, type PromotionResult } from './promotion';
import { recordJobOutcome } from './run';

export interface DecisionResult {
  decision: PackageDecision;
  finalStatus: string;
  promotion?: PromotionResult;
}

export async function decidePackage(
  db: Db,
  packageId: string,
  rawDecision: unknown,
): Promise<DecisionResult> {
  const input: HumanDecisionInput = humanDecisionSchema.parse(rawDecision);

  const finalStatus = await db.transaction(async (tx) => {
    const pkg = await tx.query.researchPackages.findFirst({
      where: eq(researchPackages.id, packageId),
    });
    if (!pkg) throw new Error(`package ${packageId} not found`);

    // Move into review from submitted/qa_complete/qa_pending if needed.
    if (pkg.status === 'submitted' || pkg.status === 'qa_pending' || pkg.status === 'qa_complete') {
      assertTransition(PACKAGE_TRANSITIONS, pkg.status, 'in_review', 'package');
      await tx.update(researchPackages).set({ status: 'in_review', updatedAt: new Date() }).where(eq(researchPackages.id, packageId));
    }

    const items = (await tx.query.researchPackageItems.findMany()).filter((i) => i.packageId === packageId);
    let mergeTargetId: string | undefined;
    if (input.decision === 'merge' && input.mergeTargetSlug) {
      const target = await findEntityBySlug(tx, input.mergeTargetSlug);
      if (!target) throw new Error(`merge target "${input.mergeTargetSlug}" not found`);
      mergeTargetId = target.id;
    }

    // Record the immutable decision snapshot.
    const [decision] = await tx
      .insert(packageDecisions)
      .values({
        packageId,
        decision: input.decision,
        reviewer: input.reviewer,
        instructions: input.instructions,
        reason: input.reason,
        mergeTargetEntityId: mergeTargetId,
        heldItemRefs: input.heldItemRefs,
        decisionSnapshot: { ...input } as unknown as Record<string, unknown>,
      })
      .returning();

    // Apply per-item decisions.
    const heldSet = new Set(input.heldItemRefs);
    const setItem = async (id: string, d: 'accepted' | 'held' | 'rejected') =>
      tx.update(researchPackageItems).set({ decision: d, decidedAt: new Date() }).where(eq(researchPackageItems.id, id));

    let next: string = pkg.status;
    if (input.decision === 'approve') {
      for (const it of items) await setItem(it.id, 'accepted');
      next = 'approved';
    } else if (input.decision === 'approve_with_holds') {
      for (const it of items) {
        const excluded = heldSet.has(it.localRef) || it.held;
        await setItem(it.id, excluded ? 'held' : 'accepted');
      }
      next = 'approved_with_holds';
    } else if (input.decision === 'reject') {
      for (const it of items) await setItem(it.id, 'rejected');
      next = 'rejected';
    } else if (input.decision === 'return') {
      next = 'returned';
    } else if (input.decision === 'merge') {
      next = 'merged';
    }

    assertTransition(PACKAGE_TRANSITIONS, 'in_review', next as never, 'package');
    await tx.update(researchPackages).set({ status: next as never, promotedEntityId: mergeTargetId ?? undefined, updatedAt: new Date() }).where(eq(researchPackages.id, packageId));

    // Job + run bookkeeping for the non-promotion paths.
    const job = await tx.query.researchJobs.findFirst({ where: eq(researchJobs.id, pkg.jobId) });
    if (job) {
      if (input.decision === 'return') {
        await tx.update(researchJobs).set({ status: 'returned', updatedAt: new Date() }).where(eq(researchJobs.id, job.id));
        // Queue a fresh returned_correction job (human-priority).
        const seq = await nextJobSequence(tx);
        await createJob(tx, {
          centralTitle: job.centralTitle,
          centralUrl: job.centralUrl,
          focusNote: input.instructions,
          origin: 'returned_correction',
          priority: 100,
          sequence: seq,
          parentEntityId: job.matchEntityId ?? undefined,
          parentContext: `correction of package ${packageId}`,
          dedupeKey: `return:${normalizeText(job.centralTitle)}:${seq}`,
          status: 'queued',
        });
        if (job.claimedByRunId) await recordJobOutcome(tx, job.claimedByRunId, 'returned');
      } else if (input.decision === 'reject') {
        await tx.update(researchJobs).set({ status: 'failed', updatedAt: new Date() }).where(eq(researchJobs.id, job.id));
        if (job.claimedByRunId) await recordJobOutcome(tx, job.claimedByRunId, 'failed');
      } else if (input.decision === 'merge') {
        await tx.update(researchJobs).set({ status: 'completed', updatedAt: new Date() }).where(eq(researchJobs.id, job.id));
        if (job.claimedByRunId) await recordJobOutcome(tx, job.claimedByRunId, 'completed');
      }
      // approve / approve_with_holds -> promotion completes the job.
    }
    void decision;
    return next as string;
  });

  const decisionRow = (await db.query.packageDecisions.findMany()).filter((d) => d.packageId === packageId).sort((a, b) => (b.createdAt.getTime() - a.createdAt.getTime()))[0];

  let promotion: PromotionResult | undefined;
  if (finalStatus === 'approved' || finalStatus === 'approved_with_holds') {
    promotion = await promotePackage(db, packageId);
  }
  return { decision: decisionRow, finalStatus, promotion };
}
