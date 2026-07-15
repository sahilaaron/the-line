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
  redirect(`/crm/packages/${packageId}`);
}

/* ---- Cycle 8B: Research Studio candidate-edit actions ---- */
import {
  editPackageItemFields,
  changeRelationshipType,
  changeRelationshipEndpoints,
  setItemHold,
  rejectPackageItem,
  correctCanonicalMatch,
  searchCanonicalMatchTargets,
  clearAgentHold,
  confirmAgentHoldAsHuman,
  type MatchTarget,
} from '@/src/services/research/edit';

const REVALIDATE = (pkgId: string) => {
  revalidatePath(`/crm/packages/${pkgId}`);
  revalidatePath('/crm');
};

// Fields whose value is numeric in the package contract (dates, weights) — the
// form submits strings, so coerce before validation.
const NUMERIC_FIELDS = new Set(['startYear', 'endYear', 'confidence', 'strength']);

export async function editItemFieldsAction(formData: FormData) {
  const db = getDevDb();
  const pkgId = String(formData.get('packageId') ?? '');
  const itemId = String(formData.get('itemId') ?? '');
  const field = String(formData.get('field') ?? '');
  const raw = String(formData.get('value') ?? '');
  if (itemId && field) {
    const value: unknown = NUMERIC_FIELDS.has(field) ? Number(raw) : raw;
    await editPackageItemFields(db, itemId, { [field]: value }, 'Sahil');
  }
  REVALIDATE(pkgId);
}

export async function changeRelTypeAction(formData: FormData) {
  const db = getDevDb();
  const pkgId = String(formData.get('packageId') ?? '');
  const itemId = String(formData.get('itemId') ?? '');
  const typeKey = String(formData.get('typeKey') ?? '');
  if (itemId && typeKey) await changeRelationshipType(db, itemId, typeKey, 'Sahil');
  REVALIDATE(pkgId);
}

export async function changeRelEndpointsAction(formData: FormData) {
  const db = getDevDb();
  const pkgId = String(formData.get('packageId') ?? '');
  const itemId = String(formData.get('itemId') ?? '');
  const sourceRef = String(formData.get('sourceRef') ?? '');
  const targetRef = String(formData.get('targetRef') ?? '');
  if (itemId && sourceRef && targetRef) await changeRelationshipEndpoints(db, itemId, sourceRef, targetRef, 'Sahil');
  REVALIDATE(pkgId);
}

export async function holdItemAction(formData: FormData) {
  const db = getDevDb();
  const pkgId = String(formData.get('packageId') ?? '');
  const itemId = String(formData.get('itemId') ?? '');
  const held = String(formData.get('held') ?? 'true') === 'true';
  if (itemId) await setItemHold(db, itemId, held, 'Sahil');
  REVALIDATE(pkgId);
}

export async function rejectItemAction(formData: FormData) {
  const db = getDevDb();
  const pkgId = String(formData.get('packageId') ?? '');
  const itemId = String(formData.get('itemId') ?? '');
  if (itemId) await rejectPackageItem(db, itemId, 'Sahil');
  REVALIDATE(pkgId);
}

export async function correctMatchAction(formData: FormData) {
  const db = getDevDb();
  const pkgId = String(formData.get('packageId') ?? '');
  const itemId = String(formData.get('itemId') ?? '');
  // A real canonical entity id (from the picker) or empty to clear. The service
  // validates status/id coherence and entity existence and throws on mismatch,
  // so a status that asserts a link can never silently clear a real match.
  const matchEntityId = (formData.get('matchEntityId') as string) || null;
  const matchStatus = (formData.get('matchStatus') as string) || null;
  if (itemId) await correctCanonicalMatch(db, itemId, matchEntityId, matchStatus, 'Sahil');
  REVALIDATE(pkgId);
}

/** Server-side canonical match-target search (scales; excludes synthetic;
 * kind-filtered). Returned to the client picker; the server remains the final
 * authority in correctCanonicalMatch. */
export async function searchMatchTargetsAction(term: string, candidateKind: string): Promise<MatchTarget[]> {
  const db = getDevDb();
  return searchCanonicalMatchTargets(db, { term, candidateKind, limit: 25 });
}

export async function clearAgentHoldAction(formData: FormData) {
  const db = getDevDb();
  const pkgId = String(formData.get('packageId') ?? '');
  const itemId = String(formData.get('itemId') ?? '');
  if (itemId) await clearAgentHold(db, itemId, 'Sahil');
  REVALIDATE(pkgId);
}

export async function confirmAgentHoldAction(formData: FormData) {
  const db = getDevDb();
  const pkgId = String(formData.get('packageId') ?? '');
  const itemId = String(formData.get('itemId') ?? '');
  if (itemId) await confirmAgentHoldAsHuman(db, itemId, 'Sahil');
  REVALIDATE(pkgId);
}

/* ---- Cycle 8B: honest queue management actions ---- */
import { editJobPriority, editJobFocusNote, cancelJob, requeueJob } from '@/src/services/research/queue-admin';

export async function editPriorityAction(formData: FormData) {
  const db = getDevDb();
  const jobId = String(formData.get('jobId') ?? '');
  const priority = Number(formData.get('priority') ?? 0);
  if (jobId) await editJobPriority(db, jobId, priority);
  revalidatePath('/crm/queue');
  revalidatePath('/crm');
}
export async function editFocusNoteAction(formData: FormData) {
  const db = getDevDb();
  const jobId = String(formData.get('jobId') ?? '');
  const focusNote = (formData.get('focusNote') as string) || null;
  if (jobId) await editJobFocusNote(db, jobId, focusNote);
  revalidatePath('/crm/queue');
  revalidatePath('/crm');
}
export async function cancelJobAction(formData: FormData) {
  const db = getDevDb();
  const jobId = String(formData.get('jobId') ?? '');
  if (jobId) await cancelJob(db, jobId);
  revalidatePath('/crm/queue');
  revalidatePath('/crm');
}
export async function requeueJobAction(formData: FormData) {
  const db = getDevDb();
  const jobId = String(formData.get('jobId') ?? '');
  if (jobId) await requeueJob(db, jobId);
  revalidatePath('/crm/queue');
  revalidatePath('/crm');
}
