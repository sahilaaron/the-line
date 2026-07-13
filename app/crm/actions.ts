'use server';
/**
 * CRM server actions. INTERNAL/local tooling only — there is no authentication
 * in this cycle (documented non-goal). Every mutation goes through the kernel
 * services so state transitions and promotion stay auditable.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDevDb } from '@/src/db/client/dev';
import { createJob } from '@/src/db/repositories/research';
import { normalizeText } from '@/src/db/repositories/graph-ext';
import { createRun, requestStop } from '@/src/services/research/run';
import { decidePackage } from '@/src/services/research/decision';
import { manualCaptureSchema, createRunSchema } from '@/src/db/validation/research';

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
  const input = manualCaptureSchema.parse({
    title: (formData.get('title') as string) || undefined,
    url: (formData.get('url') as string) || undefined,
    focusNote: (formData.get('focusNote') as string) || undefined,
    priority: Number(formData.get('priority') ?? 0),
  });
  const key = normalizeText(input.url ?? input.title ?? '');
  await createJob(db, {
    centralTitle: input.title ?? input.url ?? 'Untitled',
    centralUrl: input.url,
    focusNote: input.focusNote,
    origin: 'manual',
    priority: input.priority,
    dedupeKey: key,
    status: 'queued',
  });
  revalidatePath('/crm');
  revalidatePath('/crm/queue');
}

export async function decisionAction(formData: FormData) {
  const db = getDevDb();
  const packageId = String(formData.get('packageId') ?? '');
  const decision = String(formData.get('decision') ?? '') as
    | 'approve'
    | 'approve_with_holds'
    | 'return'
    | 'merge'
    | 'reject';
  const heldItemRefs = formData.getAll('held').map(String);
  await decidePackage(db, packageId, {
    decision,
    reviewer: 'Sahil',
    heldItemRefs,
    instructions: (formData.get('instructions') as string) || undefined,
    reason: (formData.get('reason') as string) || undefined,
    mergeTargetSlug: (formData.get('mergeTargetSlug') as string) || undefined,
  });
  revalidatePath('/crm');
  revalidatePath(`/crm/packages/${packageId}`);
  const promoted = await db.query.researchPackages.findFirst();
  void promoted;
  redirect(`/crm/packages/${packageId}`);
}
