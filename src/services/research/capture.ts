/**
 * Manual topic capture. Goes through a service boundary (never a raw insert in
 * the UI) so Sahil's operating rules hold:
 *  - resolve the canonical entity first; if it is already SUFFICIENTLY COMPLETE
 *    canonical, skip (don't queue redundant work) — a human may still force a
 *    refresh via a different path;
 *  - never create a duplicate active job for the same normalized topic, even
 *    under concurrent submissions (a partial unique index on dedupe_key backs
 *    the pre-check with a race-safe catch);
 *  - return a useful result: queued | already_queued | already_canonical.
 */
import { type Entity, type ResearchJob } from '../../db/schema';
import type { Db } from '../../db/repositories/types';
import { createJob, findOpenJobByDedupeKey } from '../../db/repositories/research';
import { normalizeText } from '../../db/repositories/graph-ext';
import { manualCaptureSchema, type ManualCaptureInput } from '../../db/validation/research';
import { resolveEntity } from './resolver';

export interface CaptureResult {
  status: 'queued' | 'already_queued' | 'already_canonical';
  job?: ResearchJob;
  entity?: Entity;
  matchStatus?: string;
}

export async function captureManualJob(db: Db, rawInput: unknown): Promise<CaptureResult> {
  const input: ManualCaptureInput = manualCaptureSchema.parse(rawInput);
  const title = input.title ?? input.url!;
  const dedupeKey = normalizeText(input.url ?? title);

  // 1) resolve canonical first — only a sufficiently-complete record is "known".
  const res = await resolveEntity(db, { label: title });
  if (res.status === 'canonical_complete' && res.entity) {
    return { status: 'already_canonical', entity: res.entity, matchStatus: res.status };
  }

  // 2) don't duplicate an active job for the same topic.
  const open = await findOpenJobByDedupeKey(db, dedupeKey);
  if (open) return { status: 'already_queued', job: open, matchStatus: res.status };

  // 3) queue it. The partial unique index makes concurrent duplicates safe.
  try {
    const job = await createJob(db, {
      centralTitle: title,
      centralUrl: input.url,
      focusNote: input.focusNote,
      origin: 'manual',
      priority: input.priority,
      dedupeKey,
      matchStatus: res.status,
      matchEntityId: res.entity?.id,
      status: 'queued',
    });
    return { status: 'queued', job, matchStatus: res.status };
  } catch {
    // A concurrent capture won the race — return the existing active job.
    const raced = await findOpenJobByDedupeKey(db, dedupeKey);
    if (raced) return { status: 'already_queued', job: raced, matchStatus: res.status };
    throw new Error(`failed to queue "${title}"`);
  }
}
