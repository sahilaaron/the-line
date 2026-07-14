/**
 * Human package decision — exactly ONE final decision per package (enforced by
 * a unique constraint AND this service). The per-item `decision`
 * (accepted/held/rejected) set here is AUTHORITATIVE for promotion; held and
 * rejected candidates stay in staging with their evidence (never deleted).
 *
 *   approve             -> accept every item (reviewer overrides QA holds)
 *   approve_with_holds  -> accept all except reviewer holds + QA-held items
 *   return              -> back to the queue as a returned_correction job
 *   mark_duplicate      -> record that the subject duplicates an existing
 *                          canonical entity (NOT a deep merge/reparent)
 *   reject              -> reject all items; nothing enters canon
 *
 * Atomicity: the decision, per-item decisions, canonical writes, frontier jobs
 * and final `promoted` status all run in ONE transaction (promotion executes
 * INSIDE it via promoteWithinTx). A promotion failure rolls the whole thing
 * back — the package stays reviewable and the same decision can be retried.
 *
 * Replay safety: an identical decision replayed after success is a harmless
 * no-op returning the existing result; a conflicting second decision is
 * rejected.
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
import { humanDecisionSchema, type HumanDecisionInput, type HeldItem } from '../../db/validation/research';
import { assertTransition, PACKAGE_TRANSITIONS } from './state-machine';
import { promoteWithinTx, type PromotionResult } from './promotion';
import { recordJobOutcome } from './run';

export interface DecisionResult {
  decision: PackageDecision;
  finalStatus: string;
  promotion?: PromotionResult;
  /** True when this call was an idempotent replay of an existing decision. */
  replayed: boolean;
}

const heldKey = (h: { section: string; localRef: string }) => `${h.section} ${h.localRef}`;

/**
 * Canonical fingerprint of ALL semantically relevant decision fields, so a
 * replay is a no-op only when it is EXACTLY the same decision. Any changed
 * field (decision, reviewer, instructions, reason, resolved duplicate target,
 * or the composite held-item SET regardless of order) makes it a conflicting
 * final decision.
 */
function decisionFingerprint(d: {
  decision: string;
  reviewer?: string | null;
  instructions?: string | null;
  reason?: string | null;
  duplicateTargetId?: string | null;
  heldItems: HeldItem[];
}): string {
  const held = d.heldItems.map(heldKey).sort();
  return JSON.stringify({
    decision: d.decision,
    reviewer: d.reviewer ?? null,
    instructions: d.instructions ?? null,
    reason: d.reason ?? null,
    duplicateTargetId: d.duplicateTargetId ?? null,
    held,
  });
}

export async function decidePackage(
  db: Db,
  packageId: string,
  rawDecision: unknown,
): Promise<DecisionResult> {
  const input: HumanDecisionInput = humanDecisionSchema.parse(rawDecision);

  return db.transaction(async (tx) => {
    const pkg = await tx.query.researchPackages.findFirst({ where: eq(researchPackages.id, packageId) });
    if (!pkg) throw new Error(`package ${packageId} not found`);

    // Resolve the duplicate target up front — needed for both the fingerprint
    // and the first-decision path.
    let duplicateOfId: string | undefined;
    if (input.decision === 'mark_duplicate' && input.duplicateOfSlug) {
      const target = await findEntityBySlug(tx, input.duplicateOfSlug);
      if (!target) throw new Error(`mark_duplicate target "${input.duplicateOfSlug}" not found`);
      duplicateOfId = target.id;
    }
    const inputFingerprint = decisionFingerprint({
      decision: input.decision,
      reviewer: input.reviewer,
      instructions: input.instructions,
      reason: input.reason,
      duplicateTargetId: duplicateOfId,
      heldItems: input.heldItems,
    });

    // --- replay / conflict guard: at most one final decision per package ---
    const existing = (await tx.query.packageDecisions.findMany()).filter((d) => d.packageId === packageId);
    if (existing.length > 0) {
      const prev = existing[0];
      const prevFingerprint = decisionFingerprint({
        decision: prev.decision,
        reviewer: prev.reviewer,
        instructions: prev.instructions,
        reason: prev.reason,
        duplicateTargetId: prev.mergeTargetEntityId,
        heldItems: (prev.heldItems ?? []) as HeldItem[],
      });
      if (prevFingerprint !== inputFingerprint) {
        throw new Error(`package ${packageId} already has a final decision (${prev.decision}); a conflicting decision is rejected`);
      }
      // Exact semantic replay. For approve*, ensure promotion completed (retry
      // a previously-failed promotion); otherwise it's a no-op.
      let promotion: PromotionResult | undefined;
      if (input.decision === 'approve' || input.decision === 'approve_with_holds') {
        promotion = await promoteWithinTx(tx, packageId); // no-op if already promoted
      }
      const fresh = await tx.query.researchPackages.findFirst({ where: eq(researchPackages.id, packageId) });
      return { decision: prev, finalStatus: fresh!.status, promotion, replayed: true };
    }

    // --- first (and only) decision path ---
    if (pkg.status === 'submitted' || pkg.status === 'qa_pending' || pkg.status === 'qa_complete') {
      assertTransition(PACKAGE_TRANSITIONS, pkg.status, 'in_review', 'package');
      await tx.update(researchPackages).set({ status: 'in_review', updatedAt: new Date() }).where(eq(researchPackages.id, packageId));
    } else if (pkg.status !== 'in_review') {
      throw new Error(`package ${packageId} is ${pkg.status}; a first human decision is only valid from submitted/qa/in_review`);
    }

    const items = (await tx.query.researchPackageItems.findMany()).filter((i) => i.packageId === packageId);

    // Every held identity must name a real item in THIS package (duplicates and
    // malformed identities are already rejected by the validator).
    if (input.decision === 'approve_with_holds') {
      const itemKeys = new Set(items.map((i) => heldKey({ section: i.section, localRef: i.localRef })));
      for (const h of input.heldItems) {
        if (!itemKeys.has(heldKey(h))) {
          throw new Error(`held item "${h.section}/${h.localRef}" is not an item in package ${packageId}`);
        }
      }
    }

    // Record the immutable decision snapshot (unique constraint enforces one).
    const [decision] = await tx
      .insert(packageDecisions)
      .values({
        packageId,
        decision: input.decision,
        reviewer: input.reviewer,
        instructions: input.instructions,
        reason: input.reason,
        mergeTargetEntityId: duplicateOfId,
        heldItems: input.heldItems,
        decisionSnapshot: { ...input } as unknown as Record<string, unknown>,
      })
      .returning();

    // Apply per-item decisions.
    const heldSet = new Set(input.heldItems.map(heldKey));
    const setItem = (id: string, d: 'accepted' | 'held' | 'rejected') =>
      tx.update(researchPackageItems).set({ decision: d, decidedAt: new Date() }).where(eq(researchPackageItems.id, id));

    let next: string = 'in_review';
    if (input.decision === 'approve') {
      for (const it of items) await setItem(it.id, 'accepted');
      next = 'approved';
    } else if (input.decision === 'approve_with_holds') {
      for (const it of items) {
        const excluded = heldSet.has(heldKey({ section: it.section, localRef: it.localRef })) || it.held;
        await setItem(it.id, excluded ? 'held' : 'accepted');
      }
      next = 'approved_with_holds';
    } else if (input.decision === 'reject') {
      for (const it of items) await setItem(it.id, 'rejected');
      next = 'rejected';
    } else if (input.decision === 'return') {
      next = 'returned';
    } else if (input.decision === 'mark_duplicate') {
      next = 'marked_duplicate';
    }

    assertTransition(PACKAGE_TRANSITIONS, 'in_review', next as never, 'package');
    await tx
      .update(researchPackages)
      .set({ status: next as never, promotedEntityId: duplicateOfId ?? undefined, updatedAt: new Date() })
      .where(eq(researchPackages.id, packageId));

    // Job + run bookkeeping for the non-promotion paths.
    const job = await tx.query.researchJobs.findFirst({ where: eq(researchJobs.id, pkg.jobId) });
    if (job) {
      if (input.decision === 'return') {
        await tx.update(researchJobs).set({ status: 'returned', updatedAt: new Date() }).where(eq(researchJobs.id, job.id));
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
      } else if (input.decision === 'mark_duplicate') {
        await tx.update(researchJobs).set({ status: 'completed', updatedAt: new Date() }).where(eq(researchJobs.id, job.id));
        if (job.claimedByRunId) await recordJobOutcome(tx, job.claimedByRunId, 'completed');
      }
    }

    // approve / approve_with_holds -> promotion runs in THIS transaction.
    let promotion: PromotionResult | undefined;
    if (next === 'approved' || next === 'approved_with_holds') {
      promotion = await promoteWithinTx(tx, packageId);
    }
    const fresh = await tx.query.researchPackages.findFirst({ where: eq(researchPackages.id, packageId) });
    return { decision, finalStatus: fresh!.status, promotion, replayed: false };
  });
}
