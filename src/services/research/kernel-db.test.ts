/** DB-backed kernel tests: claim/lease/double-claim/batch-limit/stop, resolver
 * states, submit idempotency, and transactional promotion rollback. */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshMigratedDb } from '../../db/testing/setup';
import { researchJobs } from '../../db/schema';
import { createEntity } from '../../db/repositories/entities';
import { createClaim } from '../../db/repositories/claims';
import { addExternalId, addTimeAssociation } from '../../db/repositories/graph-ext';
import { createPeriod } from '../../db/repositories/periods';
import { createJob } from '../../db/repositories/research';
import { createRun, requestStop } from './run';
import { claimNextJob, recoverExpiredLeases } from './queue';
import { deterministicDiscoveryAdapter } from './discovery';
import { resolveEntity } from './resolver';
import { submitPackage } from './submit';
import { decidePackage } from './decision';

async function seedJobs(db: Awaited<ReturnType<typeof freshMigratedDb>>['db'], n: number, origin: 'manual' | 'frontier' = 'manual') {
  for (let i = 0; i < n; i++) {
    await createJob(db, { centralTitle: `job-${i}`, origin, dedupeKey: `job-${i}`, status: 'queued' });
  }
}

describe('run + queue kernel (DB)', () => {
  it('never claims more than the batch limit', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 2 });
    await seedJobs(db, 3);
    const a = await claimNextJob(db, run.id);
    const b = await claimNextJob(db, run.id);
    const c = await claimNextJob(db, run.id);
    expect(a.job).toBeTruthy();
    expect(b.job).toBeTruthy();
    expect(c.job).toBeNull();
    expect(c.reason).toBe('batch_limit_reached');
  });

  it('a stopped run cannot claim new work and settles safely', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    await seedJobs(db, 2);
    await requestStop(db, run.id);
    const res = await claimNextJob(db, run.id);
    expect(res.job).toBeNull();
    expect(res.reason).toBe('stopped');
    // no jobs were in flight, so the run settles to stopped immediately
    const settled = await db.query.researchRuns.findMany();
    expect(settled[0].status).toBe('stopped');
    expect(settled[0].stopRequested).toBe(true);
  });

  it('does not claim the same job twice', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    await seedJobs(db, 1);
    const a = await claimNextJob(db, run.id);
    const b = await claimNextJob(db, run.id);
    expect(a.job).toBeTruthy();
    expect(b.job).toBeNull(); // the only job is now claimed with a live lease
  });

  it('recovers an abandoned lease and re-claims it', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    await seedJobs(db, 1);
    const a = await claimNextJob(db, run.id);
    // expire the lease
    await db.update(researchJobs).set({ leaseExpiresAt: new Date(Date.now() - 60_000) }).where(eq(researchJobs.id, a.job!.id));
    const recovered = await recoverExpiredLeases(db, new Date());
    expect(recovered).toBe(1);
    const again = await claimNextJob(db, run.id);
    expect(again.job?.id).toBe(a.job!.id);
  });

  it('prefers human > frontier and only opens random discovery when empty', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    await createJob(db, { centralTitle: 'front', origin: 'frontier', dedupeKey: 'front', status: 'queued' });
    await createJob(db, { centralTitle: 'man', origin: 'manual', dedupeKey: 'man', status: 'queued' });
    const first = await claimNextJob(db, run.id, {
      discovery: deterministicDiscoveryAdapter([{ title: 'Random Seed' }]),
    });
    expect(first.job?.origin).toBe('manual');
    const second = await claimNextJob(db, run.id, {
      discovery: deterministicDiscoveryAdapter([{ title: 'Random Seed' }]),
    });
    expect(second.job?.origin).toBe('frontier');
    const third = await claimNextJob(db, run.id, {
      discovery: deterministicDiscoveryAdapter([{ title: 'Random Seed' }]),
    });
    expect(third.job?.origin).toBe('random_discovery');
    expect(third.fromDiscovery).toBe(true);
  });
});

describe('resolver states (DB)', () => {
  it('matches by external id (strongest signal)', async () => {
    const { db } = await freshMigratedDb();
    const e = await createEntity(db, { slug: 'ada', kind: 'person', label: 'Ada Lovelace' });
    await addExternalId(db, { entityId: e.id, scheme: 'wikidata', value: 'Q7259' });
    const res = await resolveEntity(db, { slug: 'different-slug', label: 'Different', externalIds: [{ scheme: 'wikidata', value: 'Q7259' }] });
    expect(res.matchedBy).toBe('external_id');
    expect(res.entity?.id).toBe(e.id);
  });

  it('returns absent when nothing matches', async () => {
    const { db } = await freshMigratedDb();
    const res = await resolveEntity(db, { slug: 'nobody', label: 'Nobody At All' });
    expect(res.status).toBe('absent');
  });

  it('flags ambiguous duplicates (never silently merges)', async () => {
    const { db } = await freshMigratedDb();
    await createEntity(db, { slug: 'foo-1', kind: 'concept', label: 'Foo Bar' });
    await createEntity(db, { slug: 'foo-2', kind: 'concept', label: 'Foo Bar' });
    const res = await resolveEntity(db, { label: 'Foo Bar' });
    expect(res.status).toBe('ambiguous_duplicate');
    expect(res.candidateIds?.length).toBe(2);
  });

  it('distinguishes canonical_complete from canonical_incomplete by depth', async () => {
    const { db } = await freshMigratedDb();
    const thin = await createEntity(db, { slug: 'thin', kind: 'concept', label: 'Thin' });
    expect((await resolveEntity(db, { slug: 'thin' })).status).toBe('canonical_incomplete');
    const deep = await createEntity(db, { slug: 'deep', kind: 'concept', label: 'Deep' });
    const period = await createPeriod(db, { label: 'p', startYear: 1700 });
    await addTimeAssociation(db, { entityId: deep.id, periodId: period.id, role: 'existence' });
    await createClaim(db, { text: 'c1', subjectType: 'entity', subjectId: deep.id });
    await createClaim(db, { text: 'c2', subjectType: 'entity', subjectId: deep.id });
    expect((await resolveEntity(db, { slug: 'deep' })).status).toBe('canonical_complete');
  });
});

describe('submit idempotency + promotion rollback (DB)', () => {
  const minimalEnvelope = (slug: string) => ({
    schemaVersion: 1 as const,
    entities: [{ ref: 'central', role: 'central' as const, slug, label: slug, kind: 'concept' as const, classifications: ['concept'] }],
  });

  it('re-submitting identical content is idempotent (no duplicate package)', async () => {
    const { db } = await freshMigratedDb();
    const job = await createJob(db, { centralTitle: 'Thing', origin: 'manual', dedupeKey: 'thing', status: 'claimed' });
    const first = await submitPackage(db, job.id, minimalEnvelope('thing'));
    const second = await submitPackage(db, job.id, minimalEnvelope('thing'));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.package.id).toBe(first.package.id);
  });

  it('rolls back the ENTIRE promotion when an accepted entity is ambiguous', async () => {
    const { db } = await freshMigratedDb();
    // two existing entities that collide on normalized label
    await createEntity(db, { slug: 'clash-1', kind: 'concept', label: 'Clash Name' });
    await createEntity(db, { slug: 'clash-2', kind: 'concept', label: 'Clash Name' });
    const before = (await db.query.entities.findMany()).length;
    const job = await createJob(db, { centralTitle: 'Root', origin: 'manual', dedupeKey: 'root', status: 'claimed' });
    const envelope = {
      schemaVersion: 1 as const,
      entities: [
        { ref: 'central', role: 'central' as const, slug: 'root-node', label: 'Root Node', kind: 'concept' as const, classifications: ['concept'] },
        { ref: 'amb', role: 'connected' as const, slug: 'ambiguous-new', label: 'Clash Name', kind: 'concept' as const, classifications: ['concept'] },
      ],
    };
    const { package: pkg } = await submitPackage(db, job.id, envelope);
    await expect(decidePackage(db, pkg.id, { decision: 'approve' })).rejects.toThrow(/ambiguous/i);
    // nothing partially promoted: root-node was NOT created
    expect((await db.query.entities.findMany()).length).toBe(before);
  });
});
