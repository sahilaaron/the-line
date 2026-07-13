'use server';
/**
 * CRM server actions. INTERNAL/local tooling only — there is no authentication
 * in this cycle (documented non-goal). Every mutation goes through the kernel
 * services so state transitions and promotion stay auditable.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDevDb } from '@/src/db/client/dev';
import { createRun, requestStop } from '@/src/services/research/run';
import { captureManualJob } from '@/src/services/research/capture';
import { decidePackage } from '@/src/services/research/decision';
import { createRunSchema } from '@/src/db/validation/research';

export async function createRunAction(formData: FormData) {
  const db = getDevDb();
  const parsed = createRunSchema.parse({ batchLimit: Number(formData.get('batchLimit') ?? 0), operator: 'Sahil' });
  await createRun(db, parsed);
  revalidatePath('/crm');
  revalidatePath('/crm/queue');
}

export async function stopRunAction(formData: FormData) {
  const db = getDevDb();
  const runId = String(formData.get('runId') ?? '');
  if (runId) await requestStop(db, runId);
  revalidatePath('/crm');
  revalidatePath('/crm/queue');
}

export async function manualCaptureAction(formData: FormData) {
  const db = getDevDb();
  const result = await captureManualJob(db, {
    title: (formData.get('title') as string) || undefined,
    url: (formData.get('url') as string) || undefined,
    focusNote: (formData.get('focusNote') as string) || undefined,
    priority: Number(formData.get('priority') ?? 0),
  });
  revalidatePath('/crm');
  revalidatePath('/crm/queue');
  redirect(`/crm?captured=${result.status}`);
}

export async function decisionAction(formData: FormData) {
  const db = getDevDb();
  const packageId = String(formData.get('packageId') ?? '');
  const decision = String(formData.get('decision') ?? '') as
    | 'approve'
    | 'approve_with_holds'
    | 'return'
    | 'mark_duplicate'
    | 'reject';
  // Checkbox values are "section:localRef" (refs are only unique within a section).
  const heldItems = formData.getAll('held').map(String).map((v) => {
    const idx = v.indexOf(':');
    return { section: v.slice(0, idx), localRef: v.slice(idx + 1) };
  });
  await decidePackage(db, packageId, {
    decision,
    reviewer: 'Sahil',
    heldItems,
    instructions: (formData.get('instructions') as string) || undefined,
    reason: (formData.get('reason') as string) || undefined,
    duplicateOfSlug: (formData.get('duplicateOfSlug') as string) || undefined,
  });
  revalidatePath('/crm');
  revalidatePath(`/crm/packages/${packageId}`);
  const promoted = await db.query.researchPackages.findFirst();
  void promoted;
  redirect(`/crm/packages/${packageId}`);
}
