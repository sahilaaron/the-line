/**
 * QA ingestion. Accepts the QA contract a FUTURE external Perplexity/Grok
 * workflow would produce (no provider is integrated in this cycle), records
 * the result + item-level flags, and applies holds: any flag that is not a
 * clean `pass` marks its targeted package item `held` so the reviewer sees it
 * excluded by default. The package advances to qa_complete.
 */
import { and, eq } from 'drizzle-orm';
import {
  qaFlags,
  qaResults,
  researchPackageItems,
  researchPackages,
  type QaResult,
} from '../../db/schema';
import type { Db } from '../../db/repositories/types';
import { qaContractSchema, type QaContract } from '../../db/validation/research';
import { assertTransition, PACKAGE_TRANSITIONS } from './state-machine';

export interface QaOutcome {
  result: QaResult;
  heldRefs: string[];
}

export async function recordQa(db: Db, packageId: string, rawContract: unknown): Promise<QaOutcome> {
  const contract: QaContract = qaContractSchema.parse(rawContract);
  return db.transaction(async (tx) => {
    const pkg = await tx.query.researchPackages.findFirst({
      where: eq(researchPackages.id, packageId),
    });
    if (!pkg) throw new Error(`package ${packageId} not found`);

    // Validate flag targets: a targeted flag must identify a real item in
    // this package. Package-level flags (no target) are preserved.
    const items = (await tx.query.researchPackageItems.findMany()).filter((i) => i.packageId === packageId);
    const itemKeys = new Set(items.map((i) => `${i.section} ${i.localRef}`));
    for (const flag of contract.flags) {
      if (flag.targetSection || flag.targetRef) {
        if (!flag.targetSection || !flag.targetRef) {
          throw new Error('a QA flag target needs BOTH targetSection and targetRef (or neither for a package-level flag)');
        }
        if (!itemKeys.has(`${flag.targetSection} ${flag.targetRef}`)) {
          throw new Error(`QA flag targets "${flag.targetSection}/${flag.targetRef}" which is not an item in package ${packageId}`);
        }
      }
    }

    const [result] = await tx
      .insert(qaResults)
      .values({
        packageId,
        recommendation: contract.recommendation,
        summary: contract.summary,
        toolName: contract.toolName,
        model: contract.model,
        qaRunRef: contract.qaRunRef,
      })
      .returning();

    const heldRefs: string[] = [];
    for (const flag of contract.flags) {
      await tx.insert(qaFlags).values({
        qaResultId: result.id,
        packageId,
        targetSection: flag.targetSection,
        targetRef: flag.targetRef,
        severity: flag.severity,
        category: flag.category,
        explanation: flag.explanation,
        correctiveSource: flag.correctiveSource,
        state: flag.state,
      });
      // A non-pass flag on a specific item holds that item by default.
      if (flag.state !== 'pass' && flag.targetSection && flag.targetRef) {
        const [held] = await tx
          .update(researchPackageItems)
          .set({ held: true })
          .where(
            and(
              eq(researchPackageItems.packageId, packageId),
              eq(researchPackageItems.section, flag.targetSection),
              eq(researchPackageItems.localRef, flag.targetRef),
            ),
          )
          .returning({ ref: researchPackageItems.localRef });
        if (held) heldRefs.push(held.ref);
      }
    }

    if (pkg.status === 'submitted' || pkg.status === 'qa_pending') {
      assertTransition(PACKAGE_TRANSITIONS, pkg.status, 'qa_complete', 'package');
      await tx
        .update(researchPackages)
        .set({ status: 'qa_complete', updatedAt: new Date() })
        .where(eq(researchPackages.id, packageId));
    }

    return { result, heldRefs };
  });
}
