/**
 * Regression tests for the Cycle 8A correction pass (Codex audit): atomic
 * replay-safe decisions, held-item identity, relationship typing, manual
 * capture dedup/skip, QA target validation, no-silent-drop promotion, and
 * registry endpoint-kind / acyclic enforcement.
 */
import { describe, it, expect } from 'vitest';
import { freshMigratedDb } from '../../db/testing/setup';
import { createEntity } from '../../db/repositories/entities';
import { createClaim } from '../../db/repositories/claims';
import { createPeriod } from '../../db/repositories/periods';
import { addRelationship } from '../../db/repositories/relationships';
import { relationships } from '../../db/schema';
import { addTimeAssociation, registerRelationshipType } from '../../db/repositories/graph-ext';
import { createJob } from '../../db/repositories/research';
import { runIntegrityAudit } from '../../db/queries/audit';
import { getPackageDetail } from '../../db/queries/crm';
import { submitPackage } from './submit';
import { decidePackage } from './decision';
import { recordQa } from './qa';
import { captureManualJob } from './capture';

type Env = Record<string, unknown>;
const central = { ref: 'central', role: 'central' as const, slug: 'root-node', label: 'Root Node', kind: 'concept' as const, classifications: ['concept'] };
const envelope = (over: Env = {}): Env => ({ schemaVersion: 1, entities: [central], ...over });

async function stage(db: Awaited<ReturnType<typeof freshMigratedDb>>['db'], env: Env, dedupe = Math.random().toString(36).slice(2)) {
  const job = await createJob(db, { centralTitle: 'X', origin: 'manual', dedupeKey: dedupe, status: 'claimed' });
  const { package: pkg } = await submitPackage(db, job.id, env);
  return { job, pkg };
}

describe('atomic, replay-safe decisions', () => {
  it('replaying approval after promotion creates no duplicate canonical records', async () => {
    const { db } = await freshMigratedDb();
    const { pkg } = await stage(db, envelope({
      chronology: [{ ref: 't1', entityRef: 'central', role: 'existence', startYear: 1700, precision: 'approximate', confidence: 50 }],
      sources: [{ ref: 's1', title: 'A Source', type: 'book' }],
      claims: [{ ref: 'c1', subjectRef: 'central', subjectSection: 'entity', text: 'a claim', assertionClass: 'recorded_fact', verification: 'verified', sourceLinks: [{ sourceRef: 's1' }] }],
    }));
    const first = await decidePackage(db, pkg.id, { decision: 'approve' });
    expect(first.replayed).toBe(false);
    const counts = async () => ({
      e: (await db.query.entities.findMany()).length,
      p: (await db.query.periods.findMany()).length,
      c: (await db.query.claims.findMany()).length,
      s: (await db.query.sources.findMany()).length,
    });
    const before = await counts();
    const replay = await decidePackage(db, pkg.id, { decision: 'approve' });
    expect(replay.replayed).toBe(true);
    expect(replay.promotion?.alreadyPromoted).toBe(true);
    expect(await counts()).toEqual(before);
  });

  it('rejects a conflicting second final decision', async () => {
    const { db } = await freshMigratedDb();
    const { pkg } = await stage(db, envelope());
    await decidePackage(db, pkg.id, { decision: 'approve' });
    await expect(decidePackage(db, pkg.id, { decision: 'reject', reason: 'nope' })).rejects.toThrow(/conflicting decision/i);
  });

  it('rolls back decision+items+canon+frontier+status on promotion failure, then retry succeeds', async () => {
    const { db } = await freshMigratedDb();
    // An accepted relationship with an UNREGISTERED type fails promotion.
    const { pkg } = await stage(db, envelope({
      entities: [central, { ref: 'other', role: 'connected', slug: 'other-node', label: 'Other', kind: 'concept', classifications: ['concept'] }],
      connections: [{ ref: 'rel-bad', sourceRef: 'central', targetRef: 'other', typeKey: 'no_such_type', assertionClass: 'recorded_fact' }],
      nextEntities: [{ ref: 'n1', title: 'Neighbour', reason: 'later' }],
    }));
    await expect(decidePackage(db, pkg.id, { decision: 'approve' })).rejects.toThrow(/unregistered type/i);
    // Nothing partial: no decision, no canon, no frontier jobs, status intact.
    expect((await db.query.packageDecisions.findMany()).length).toBe(0);
    expect((await db.query.entities.findMany()).length).toBe(0);
    expect((await db.query.researchJobs.findMany()).filter((j) => j.origin === 'frontier').length).toBe(0);
    const items = (await db.query.researchPackageItems.findMany());
    expect(items.every((i) => i.decision === 'pending')).toBe(true);
    const pkgNow = await db.query.researchPackages.findFirst();
    expect(pkgNow!.status).toBe('submitted');
    // Retry, holding the bad relationship -> succeeds.
    const retry = await decidePackage(db, pkg.id, { decision: 'approve_with_holds', heldItems: [{ section: 'relationship', localRef: 'rel-bad' }] });
    expect(retry.finalStatus).toBe('promoted');
    expect((await db.query.packageDecisions.findMany()).length).toBe(1);
  });
});

describe('held-item identity is composite {section, localRef}', () => {
  it('holds identical refs in two sections independently', async () => {
    const { db } = await freshMigratedDb();
    const { pkg } = await stage(db, envelope({
      entities: [central, { ref: 'dup', role: 'connected', slug: 'dup-node', label: 'Dup', kind: 'concept', classifications: ['concept'] }],
      claims: [{ ref: 'dup', subjectRef: 'central', subjectSection: 'entity', text: 'claim dup', assertionClass: 'recorded_fact' }],
    }));
    // Hold only the CLAIM named "dup"; the ENTITY named "dup" must be accepted.
    await decidePackage(db, pkg.id, { decision: 'approve_with_holds', heldItems: [{ section: 'claim', localRef: 'dup' }] });
    const items = (await db.query.researchPackageItems.findMany()).filter((i) => i.packageId === pkg.id);
    expect(items.find((i) => i.section === 'entity' && i.localRef === 'dup')!.decision).toBe('accepted');
    expect(items.find((i) => i.section === 'claim' && i.localRef === 'dup')!.decision).toBe('held');
    // The accepted duplicate-named entity exists; the held claim did not promote.
    expect(await db.query.entities.findFirst({ where: (e, { eq }) => eq(e.slug, 'dup-node') })).toBeTruthy();
    expect((await db.query.claims.findMany()).length).toBe(0);
  });
});

describe('relationship typing is enforced', () => {
  it('rejects a relationship with neither type nor typeKey (repo guard + DB CHECK)', async () => {
    const { db } = await freshMigratedDb();
    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    const b = await createEntity(db, { slug: 'b', kind: 'concept', label: 'B' });
    // repo guard
    await expect(
      addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, type: null, typeKey: null }),
    ).rejects.toThrow(/type.*typeKey/i);
    // DB CHECK (bypass the repo guard with a raw insert)
    await expect(
      db.insert(relationships).values({ sourceEntityId: a.id, targetEntityId: b.id, type: null, typeKey: null }),
    ).rejects.toThrow();
  });

  it('accepted relationship whose target was HELD fails promotion (no silent skip)', async () => {
    const { db } = await freshMigratedDb();
    const { pkg } = await stage(db, envelope({
      entities: [central, { ref: 'tgt', role: 'connected', slug: 'target-node', label: 'Target', kind: 'concept', classifications: ['concept'] }],
      connections: [{ ref: 'rel-x', sourceRef: 'central', targetRef: 'tgt', typeKey: 'influenced', assertionClass: 'recorded_fact' }],
    }));
    // Hold the TARGET entity but leave the relationship accepted -> unresolved.
    await expect(
      decidePackage(db, pkg.id, { decision: 'approve_with_holds', heldItems: [{ section: 'entity', localRef: 'tgt' }] }),
    ).rejects.toThrow(/unresolved entity/i);
    // Rolled back entirely.
    expect((await db.query.entities.findMany()).length).toBe(0);
    expect((await db.query.packageDecisions.findMany()).length).toBe(0);
  });

  it('enforces registry allowed endpoint kinds during promotion', async () => {
    const { db } = await freshMigratedDb();
    await registerRelationshipType(db, {
      key: 'mentored', label: 'mentored', inverseLabel: 'was mentored by',
      allowedSourceKinds: ['person'], allowedTargetKinds: ['person'],
    });
    const { pkg } = await stage(db, envelope({
      entities: [central, { ref: 'p', role: 'connected', slug: 'a-person', label: 'A Person', kind: 'person', classifications: ['person'] }],
      // central is a `concept`, not a `person` -> disallowed source kind.
      connections: [{ ref: 'rel-m', sourceRef: 'central', targetRef: 'p', typeKey: 'mentored', assertionClass: 'recorded_fact' }],
    }));
    await expect(decidePackage(db, pkg.id, { decision: 'approve' })).rejects.toThrow(/not allowed for type/i);
  });

  it('audit flags a cycle in a registry-acyclic type (not only legacy constants)', async () => {
    const { db } = await freshMigratedDb();
    await registerRelationshipType(db, { key: 'contains_step', label: 'contains step', inverseLabel: 'step of', isAcyclic: true });
    const a = await createEntity(db, { slug: 'ca', kind: 'concept', label: 'CA' });
    const b = await createEntity(db, { slug: 'cb', kind: 'concept', label: 'CB' });
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, typeKey: 'contains_step' });
    await addRelationship(db, { sourceEntityId: b.id, targetEntityId: a.id, typeKey: 'contains_step' });
    const report = await runIntegrityAudit(db);
    expect(report.errors.some((e) => e.code === 'unexpected_cycle')).toBe(true);
  });
});

describe('manual capture dedup + resolver skip', () => {
  it('repeated capture does not duplicate work', async () => {
    const { db } = await freshMigratedDb();
    const first = await captureManualJob(db, { title: 'Spinning jenny' });
    const second = await captureManualJob(db, { title: 'Spinning jenny' });
    expect(first.status).toBe('queued');
    expect(second.status).toBe('already_queued');
    expect((await db.query.researchJobs.findMany()).length).toBe(1);
  });

  it('concurrent capture of the same topic yields exactly one active job', async () => {
    const { db } = await freshMigratedDb();
    const results = await Promise.allSettled([
      captureManualJob(db, { title: 'Power loom' }),
      captureManualJob(db, { title: 'Power loom' }),
      captureManualJob(db, { title: 'Power loom' }),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const active = (await db.query.researchJobs.findMany()).filter((j) => j.dedupeKey === 'power loom');
    expect(active.length).toBe(1);
  });

  it('skips capture of an already sufficiently-complete canonical entity', async () => {
    const { db } = await freshMigratedDb();
    const e = await createEntity(db, { slug: 'watt-e', kind: 'person', label: 'Complete Person' });
    const period = await createPeriod(db, { label: 'p', startYear: 1736 });
    await addTimeAssociation(db, { entityId: e.id, periodId: period.id, role: 'existence' });
    await createClaim(db, { text: 'c1', subjectType: 'entity', subjectId: e.id });
    await createClaim(db, { text: 'c2', subjectType: 'entity', subjectId: e.id });
    const res = await captureManualJob(db, { title: 'Complete Person' });
    expect(res.status).toBe('already_canonical');
    expect((await db.query.researchJobs.findMany()).length).toBe(0);
  });
});

describe('QA flag target validation', () => {
  it('rejects a flag targeting a non-existent item; preserves package-level flags', async () => {
    const { db } = await freshMigratedDb();
    const { pkg } = await stage(db, envelope());
    await expect(
      recordQa(db, pkg.id, { recommendation: 'hold', flags: [{ targetSection: 'relationship', targetRef: 'ghost', explanation: 'x', state: 'hold' }] }),
    ).rejects.toThrow(/not an item in package/i);
    // package-level flag (no target) is accepted
    const ok = await recordQa(db, pkg.id, { recommendation: 'pass', flags: [{ explanation: 'overall fine', state: 'pass' }] });
    expect(ok.result.recommendation).toBe('pass');
  });
});

describe('semantic decision fingerprint replay (item 1)', () => {
  it('a DIFFERENT mark_duplicate target is a conflict; the SAME target is an idempotent replay', async () => {
    const { db } = await freshMigratedDb();
    await createEntity(db, { slug: 'target-a', kind: 'concept', label: 'Target A' });
    await createEntity(db, { slug: 'target-b', kind: 'concept', label: 'Target B' });
    const { pkg } = await stage(db, envelope());
    await decidePackage(db, pkg.id, { decision: 'mark_duplicate', duplicateOfSlug: 'target-a' });
    await expect(decidePackage(db, pkg.id, { decision: 'mark_duplicate', duplicateOfSlug: 'target-b' })).rejects.toThrow(/conflicting/i);
    const replay = await decidePackage(db, pkg.id, { decision: 'mark_duplicate', duplicateOfSlug: 'target-a' });
    expect(replay.replayed).toBe(true);
  });

  it('different return instructions are a conflict', async () => {
    const { db } = await freshMigratedDb();
    const { pkg } = await stage(db, envelope());
    await decidePackage(db, pkg.id, { decision: 'return', instructions: 'fix the dates' });
    await expect(decidePackage(db, pkg.id, { decision: 'return', instructions: 'fix the sources' })).rejects.toThrow(/conflicting/i);
    const replay = await decidePackage(db, pkg.id, { decision: 'return', instructions: 'fix the dates' });
    expect(replay.replayed).toBe(true);
  });

  it('different rejection reason is a conflict', async () => {
    const { db } = await freshMigratedDb();
    const { pkg } = await stage(db, envelope());
    await decidePackage(db, pkg.id, { decision: 'reject', reason: 'unsourced' });
    await expect(decidePackage(db, pkg.id, { decision: 'reject', reason: 'duplicate' })).rejects.toThrow(/conflicting/i);
  });

  it('reordered identical heldItems remains an idempotent replay', async () => {
    const { db } = await freshMigratedDb();
    const { pkg } = await stage(db, envelope({
      entities: [central,
        { ref: 'x', role: 'connected', slug: 'x-node', label: 'X', kind: 'concept', classifications: ['concept'] },
        { ref: 'y', role: 'connected', slug: 'y-node', label: 'Y', kind: 'concept', classifications: ['concept'] }],
    }));
    await decidePackage(db, pkg.id, { decision: 'approve_with_holds', heldItems: [{ section: 'entity', localRef: 'x' }, { section: 'entity', localRef: 'y' }] });
    const replay = await decidePackage(db, pkg.id, { decision: 'approve_with_holds', heldItems: [{ section: 'entity', localRef: 'y' }, { section: 'entity', localRef: 'x' }] });
    expect(replay.replayed).toBe(true);
  });
});

describe('held-item identity validation (item 2)', () => {
  it('a ghost held item fails and rolls back everything', async () => {
    const { db } = await freshMigratedDb();
    const { pkg } = await stage(db, envelope());
    await expect(
      decidePackage(db, pkg.id, { decision: 'approve_with_holds', heldItems: [{ section: 'relationship', localRef: 'ghost' }] }),
    ).rejects.toThrow(/not an item in package/i);
    expect((await db.query.packageDecisions.findMany()).length).toBe(0);
    expect((await db.query.entities.findMany()).length).toBe(0);
    const pkgNow = await db.query.researchPackages.findFirst();
    expect(pkgNow!.status).toBe('submitted');
  });
});

describe('registry duplicate auditing (item 3)', () => {
  it('two distinct registry types between the same entities are NOT duplicates', async () => {
    const { db } = await freshMigratedDb();
    await registerRelationshipType(db, { key: 'rt_a', label: 'rt a', inverseLabel: 'rt a of' });
    await registerRelationshipType(db, { key: 'rt_b', label: 'rt b', inverseLabel: 'rt b of' });
    const a = await createEntity(db, { slug: 'ea', kind: 'concept', label: 'EA' });
    const b = await createEntity(db, { slug: 'eb', kind: 'concept', label: 'EB' });
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, typeKey: 'rt_a' });
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, typeKey: 'rt_b' });
    const report = await runIntegrityAudit(db);
    expect(report.errors.filter((e) => e.code === 'duplicate_relationship').length).toBe(0);
  });

  it('the same EFFECTIVE registry relationship (type vs typeKey) is a duplicate', async () => {
    const { db } = await freshMigratedDb();
    const a = await createEntity(db, { slug: 'fa', kind: 'concept', label: 'FA' });
    const b = await createEntity(db, { slug: 'fb', kind: 'concept', label: 'FB' });
    // one legacy enum-typed, one registry-typed — same effective type 'part_of'.
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, type: 'part_of' });
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, typeKey: 'part_of' });
    const report = await runIntegrityAudit(db);
    expect(report.errors.some((e) => e.code === 'duplicate_relationship')).toBe(true);
  });

  it('detects a reversed SYMMETRIC duplicate', async () => {
    const { db } = await freshMigratedDb();
    await registerRelationshipType(db, { key: 'rt_sym', label: 'sym', inverseLabel: 'sym', directionality: 'symmetric' });
    const a = await createEntity(db, { slug: 'ga', kind: 'concept', label: 'GA' });
    const b = await createEntity(db, { slug: 'gb', kind: 'concept', label: 'GB' });
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, typeKey: 'rt_sym' });
    await addRelationship(db, { sourceEntityId: b.id, targetEntityId: a.id, typeKey: 'rt_sym' });
    const report = await runIntegrityAudit(db);
    expect(report.errors.some((e) => e.code === 'duplicate_relationship')).toBe(true);
  });
});

describe('mark_duplicate CRM terminal state (item 4)', () => {
  it('renders a terminal marked_duplicate state with the duplicate target', async () => {
    const { db } = await freshMigratedDb();
    await createEntity(db, { slug: 'canonical-orig', kind: 'concept', label: 'Canonical Original' });
    const { pkg } = await stage(db, envelope());
    await decidePackage(db, pkg.id, { decision: 'mark_duplicate', reviewer: 'Sahil', duplicateOfSlug: 'canonical-orig' });
    const detail = await getPackageDetail(db, pkg.id);
    expect(detail!.package.status).toBe('marked_duplicate');
    expect(detail!.decisions[0].decision).toBe('mark_duplicate');
    expect((detail!.decisions[0].decisionSnapshot as { duplicateOfSlug?: string }).duplicateOfSlug).toBe('canonical-orig');
    // the duplicate's own central entity must NOT have been promoted
    expect(await db.query.entities.findFirst({ where: (e, { eq }) => eq(e.slug, 'root-node') })).toBeUndefined();
  });
});
