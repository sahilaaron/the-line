/** Pure (no-DB) kernel tests: state machines, the deterministic queue
 * selector, and the research-package envelope validator. */
import { describe, it, expect } from 'vitest';
import {
  assertTransition,
  canTransition,
  JOB_TRANSITIONS,
  PACKAGE_TRANSITIONS,
  RUN_TRANSITIONS,
} from './state-machine';
import { orderJobs, selectNextJob, isClaimable } from './queue';
import type { ResearchJob } from '../../db/schema';
import { researchPackageEnvelopeSchema } from '../../db/validation/research';
import { relationshipCreateSchema } from '../../db/validation/relationship';
import { STEAM_ENGINE_ENVELOPE } from './fixtures/steam-engine';

const T0 = new Date('2026-07-14T00:00:00Z');
function job(p: Partial<ResearchJob>): ResearchJob {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    centralTitle: 'x',
    centralUrl: null,
    focusNote: null,
    origin: p.origin ?? 'manual',
    priority: p.priority ?? 0,
    sequence: p.sequence ?? 0,
    status: p.status ?? 'queued',
    claimedByRunId: null,
    workerLock: null,
    leaseExpiresAt: p.leaseExpiresAt ?? null,
    attemptCount: 0,
    lastError: null,
    matchStatus: null,
    matchEntityId: null,
    parentEntityId: null,
    parentContext: null,
    dedupeKey: p.dedupeKey ?? 'k',
    createdAt: T0,
    updatedAt: T0,
    ...p,
  } as ResearchJob;
}
const activeRun = { status: 'active' as const, stopRequested: false, batchLimit: 5, claimedCount: 0 };

describe('state machines', () => {
  it('allows documented transitions and rejects the rest', () => {
    expect(canTransition(RUN_TRANSITIONS, 'active', 'stopping')).toBe(true);
    expect(canTransition(RUN_TRANSITIONS, 'stopped', 'active')).toBe(false);
    expect(canTransition(JOB_TRANSITIONS, 'queued', 'claimed')).toBe(true);
    expect(canTransition(JOB_TRANSITIONS, 'completed', 'queued')).toBe(false);
    expect(canTransition(PACKAGE_TRANSITIONS, 'in_review', 'approved_with_holds')).toBe(true);
    expect(canTransition(PACKAGE_TRANSITIONS, 'promoted', 'approved')).toBe(false);
  });
  it('assertTransition throws on an illegal move but is a no-op on same-state', () => {
    expect(() => assertTransition(PACKAGE_TRANSITIONS, 'rejected', 'approved', 'package')).toThrow();
    expect(() => assertTransition(PACKAGE_TRANSITIONS, 'approved', 'approved', 'package')).not.toThrow();
  });
});

describe('queue selector (deterministic priority)', () => {
  it('orders human > frontier > random, then priority desc, then sequence asc', () => {
    const jobs = [
      job({ id: 'rand', origin: 'random_discovery', sequence: 1 }),
      job({ id: 'front', origin: 'frontier', sequence: 2 }),
      job({ id: 'man-lo', origin: 'manual', priority: 1, sequence: 3 }),
      job({ id: 'man-hi', origin: 'manual', priority: 9, sequence: 4 }),
      job({ id: 'ret', origin: 'returned_correction', priority: 9, sequence: 0 }),
    ];
    const ordered = orderJobs(jobs).map((j) => j.id);
    expect(ordered[0]).toBe('man-hi'); // manual, highest priority, lower seq than ret? ret is returned_correction rank 1
    // manual (rank 0) beats returned_correction (rank 1) beats frontier beats random
    expect(ordered).toEqual(['man-hi', 'man-lo', 'ret', 'front', 'rand']);
  });
  it('selectNextJob returns null for a stopped run and when the batch limit is reached', () => {
    const jobs = [job({ id: 'a' })];
    expect(selectNextJob(jobs, { ...activeRun, stopRequested: true }, T0)).toBeNull();
    expect(selectNextJob(jobs, { ...activeRun, claimedCount: 5 }, T0)).toBeNull();
    expect(selectNextJob(jobs, activeRun, T0)?.id).toBe('a');
  });
  it('treats an expired-lease claimed job as recoverable/claimable', () => {
    const stuck = job({ id: 's', status: 'claimed', leaseExpiresAt: new Date(T0.getTime() - 1000) });
    const fresh = job({ id: 'f', status: 'claimed', leaseExpiresAt: new Date(T0.getTime() + 1000) });
    expect(isClaimable(stuck, T0)).toBe(true);
    expect(isClaimable(fresh, T0)).toBe(false);
    expect(selectNextJob([fresh, stuck], activeRun, T0)?.id).toBe('s');
  });
});

describe('research-package envelope validator', () => {
  it('accepts the Steam Engine fixture envelope', () => {
    const parsed = researchPackageEnvelopeSchema.safeParse(STEAM_ENGINE_ENVELOPE);
    expect(parsed.success).toBe(true);
  });
  it('rejects a verified claim with no source', () => {
    const bad = {
      schemaVersion: 1,
      entities: [{ ref: 'central', role: 'central', slug: 'x', label: 'X', classifications: [] }],
      claims: [{ ref: 'c1', subjectRef: 'central', subjectSection: 'entity', text: 'unsourced', assertionClass: 'recorded_fact', verification: 'verified', sourceLinks: [] }],
    };
    expect(researchPackageEnvelopeSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects a verified claim that is a forecast (forecast cannot be a fact)', () => {
    const bad = {
      schemaVersion: 1,
      entities: [{ ref: 'central', role: 'central', slug: 'x', label: 'X', classifications: [] }],
      sources: [{ ref: 's1', title: 'S', type: 'book' }],
      claims: [{ ref: 'c1', subjectRef: 'central', subjectSection: 'entity', text: 'the future', assertionClass: 'forecast', verification: 'verified', sourceLinks: [{ sourceRef: 's1' }] }],
    };
    expect(researchPackageEnvelopeSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects a relationship referencing an unknown entity ref', () => {
    const bad = {
      schemaVersion: 1,
      entities: [{ ref: 'central', role: 'central', slug: 'x', label: 'X', classifications: [] }],
      connections: [{ ref: 'r1', sourceRef: 'central', targetRef: 'ghost', typeKey: 'influenced' }],
    };
    expect(researchPackageEnvelopeSchema.safeParse(bad).success).toBe(false);
  });
  it('requires exactly one central entity', () => {
    const bad = {
      schemaVersion: 1,
      entities: [
        { ref: 'a', role: 'central', slug: 'a', label: 'A', classifications: [] },
        { ref: 'b', role: 'central', slug: 'b', label: 'B', classifications: [] },
      ],
    };
    expect(researchPackageEnvelopeSchema.safeParse(bad).success).toBe(false);
  });
});

describe('relationship validation requires a type or a typeKey', () => {
  const base = { sourceEntityId: 'a', targetEntityId: 'b' };
  it('rejects neither type nor typeKey', () => {
    expect(relationshipCreateSchema.safeParse({ ...base }).success).toBe(false);
  });
  it('accepts a typeKey-only relationship', () => {
    expect(relationshipCreateSchema.safeParse({ ...base, typeKey: 'mentored' }).success).toBe(true);
  });
  it('accepts a legacy enum-type relationship', () => {
    expect(relationshipCreateSchema.safeParse({ ...base, type: 'influenced' }).success).toBe(true);
  });
});
