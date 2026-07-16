/**
 * Cycle 8B correction pass — permanent adversarial regression tests for the six
 * backend failures Codex found, plus queue ownership. Each fails against
 * 7c63d93 and passes after the correction.
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshMigratedDb } from '../../db/testing/setup';
import { entities, researchJobs, researchPackageItemRevisions, researchPackageItems, researchPackages, researchRuns } from '../../db/schema';
import { createJob } from '../../db/repositories/research';
import { createRun } from './run';
import { claimNextJob, recoverExpiredLeases } from './queue';
import { releaseJob, failJob, beginJob } from './queue-admin';
import { recordQa } from './qa';
import { decidePackage } from './decision';
import { editPackageItemFields, setItemHold, rejectPackageItem } from './edit';
import { STEAM_ENGINE_ENVELOPE, STEAM_ENGINE_QA, seedSteamEngineExistingCanon } from './fixtures/steam-engine';
import { stageSubmittedPackage } from './fixtures/staging';

type DB = Awaited<ReturnType<typeof freshMigratedDb>>['db'];
const runOf = async (db: DB, id: string) => (await db.query.researchRuns.findFirst({ where: eq(researchRuns.id, id) }))!;
const jobOf = async (db: DB, id: string) => (await db.query.researchJobs.findFirst({ where: eq(researchJobs.id, id) }))!;

async function stageSteam(db: DB, withQa = true) {
  await seedSteamEngineExistingCanon(db);
  const { result } = await stageSubmittedPackage(db, STEAM_ENGINE_ENVELOPE, { title: 'Steam engine' });
  const pkg = result.package;
  if (withQa) await recordQa(db, pkg.id, STEAM_ENGINE_QA);
  return pkg;
}
const item = async (db: DB, pkgId: string, section: string, ref: string) =>
  (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.packageId, pkgId) })).find((i) => i.section === section && i.localRef === ref)!;

describe('1. release restores batch capacity', () => {
  it('releasing a claimed job frees the slot and it can be claimed again', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 1 });
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    const claim = await claimNextJob(db, run.id, { worker: 'w1' });
    expect((await runOf(db, run.id)).claimedCount).toBe(1);
    const released = await releaseJob(db, claim.job!.id, 'w1', claim.job!.workerLock!);
    expect(released.status).toBe('queued');
    expect(released.leaseExpiresAt).toBeNull();
    expect(released.claimedByRunId).toBeNull();
    expect((await runOf(db, run.id)).claimedCount).toBe(0);
    const reclaim = await claimNextJob(db, run.id, { worker: 'w1' });
    expect(reclaim.job).toBeTruthy();
  });
  it('recovering an expired lease also restores capacity', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 1 });
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    const claim = await claimNextJob(db, run.id, { worker: 'w1' });
    await db.update(researchJobs).set({ leaseExpiresAt: new Date(Date.now() - 60_000) }).where(eq(researchJobs.id, claim.job!.id));
    expect(await recoverExpiredLeases(db)).toBe(1);
    expect((await runOf(db, run.id)).claimedCount).toBe(0);
    expect((await claimNextJob(db, run.id, { worker: 'w1' })).job).toBeTruthy();
  });
});

describe('2. failing a job records + settles once', () => {
  it('fail increments failedCount once, settles the run, and is idempotent', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 1 });
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    const claim = await claimNextJob(db, run.id, { worker: 'w1' });
    await failJob(db, claim.job!.id, 'no sources', 'w1', claim.job!.workerLock!);
    let r = await runOf(db, run.id);
    expect((await jobOf(db, claim.job!.id)).status).toBe('failed');
    expect(r.failedCount).toBe(1);
    expect(r.status).toBe('completed'); // batch consumed by the failed attempt
    // idempotent replay
    await failJob(db, claim.job!.id, 'no sources', 'w1', claim.job!.workerLock!);
    r = await runOf(db, run.id);
    expect(r.failedCount).toBe(1);
  });
});

describe('3. explicit item rejection survives approval', () => {
  it('a rejected relationship stays rejected and is never promoted', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteam(db, true);
    const relGlasgow = await item(db, pkg.id, 'relationship', 'rel-glasgow');
    await rejectPackageItem(db, relGlasgow.id, 'Sahil');
    await recordQa(db, pkg.id, STEAM_ENGINE_QA); // re-QA after the (non-material) reject is fine
    await decidePackage(db, pkg.id, { decision: 'approve_with_holds', heldItems: [{ section: 'relationship', localRef: 'rel-newcomen' }] });
    const after = await item(db, pkg.id, 'relationship', 'rel-glasgow');
    expect(after.decision).toBe('rejected');
    // rel-glasgow is watt->glasgow (associated_with); it must NOT be in canon
    const rels = await db.query.relationships.findMany();
    expect(rels.some((r) => r.typeKey === 'associated_with')).toBe(false);
  });
});

describe('4. candidate edits are atomic', () => {
  it('a failing audit insert rolls the whole edit back', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteam(db, true);
    const glasgow = await item(db, pkg.id, 'entity', 'glasgow');
    const beforeLabel = (glasgow.payload as { label: string }).label;
    // editor '' violates the revision CHECK -> the whole transaction rolls back
    await expect(editPackageItemFields(db, glasgow.id, { label: 'Rolled Back' }, '')).rejects.toThrow();
    const after = await item(db, pkg.id, 'entity', 'glasgow');
    expect((after.payload as { label: string }).label).toBe(beforeLabel); // unchanged
    expect((await db.select().from(researchPackageItemRevisions)).length).toBe(0); // no partial audit
    expect((await db.query.researchPackages.findFirst({ where: eq(researchPackages.id, pkg.id) }))!.status).toBe('qa_complete'); // QA not invalidated
  });
});

describe('5. obsolete QA holds cleared; human holds preserved', () => {
  it('a QA rerun that passes clears the QA hold but keeps a human hold', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteam(db, true); // QA flags rel-newcomen -> QA hold
    const relNewcomen = await item(db, pkg.id, 'relationship', 'rel-newcomen');
    expect(relNewcomen.held).toBe(true);
    expect(relNewcomen.qaHeld).toBe(true);
    expect(relNewcomen.humanHeld).toBe(false);
    // human holds a different edge
    const relGlasgow = await item(db, pkg.id, 'relationship', 'rel-glasgow');
    await setItemHold(db, relGlasgow.id, true, 'Sahil');
    expect((await item(db, pkg.id, 'relationship', 'rel-glasgow')).humanHeld).toBe(true);
    // rerun QA WITHOUT the rel-newcomen flag (a clean pass)
    await recordQa(db, pkg.id, { recommendation: 'pass', flags: [] });
    expect((await item(db, pkg.id, 'relationship', 'rel-newcomen')).held).toBe(false); // QA hold cleared
    expect((await item(db, pkg.id, 'relationship', 'rel-glasgow')).held).toBe(true); // human hold kept
    expect((await item(db, pkg.id, 'relationship', 'rel-glasgow')).humanHeld).toBe(true);
    expect((await item(db, pkg.id, 'relationship', 'rel-glasgow')).qaHeld).toBe(false);
  });
});

describe('6. classification preserves canonical kind', () => {
  it.each([['technology'], ['discovery'], ['movement'], ['publication'], ['product'], ['law_policy']])(
    'a %s candidate promotes as that kind (not a legacy kind)',
    async (cls) => {
      const { db } = await freshMigratedDb();
      const slug = `${cls.replace(/_/g, '-')}-subject`;
      const env = {
        schemaVersion: 1 as const,
        entities: [{ ref: 'central', role: 'central' as const, slug, label: `${cls} subject`, classifications: [cls] }],
      };
      const { result } = await stageSubmittedPackage(db, env, { title: cls });
      const pkg = result.package;
      await decidePackage(db, pkg.id, { decision: 'approve' });
      const ent = (await db.select().from(entities)).find((e) => e.slug === slug)!;
      expect(ent.kind).toBe(cls);
    },
  );
});

describe('queue ownership (exact worker identity + lease token)', () => {
  it('agent-1 cannot operate a lease owned by agent-10', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 5 });
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    const claim = await claimNextJob(db, run.id, { worker: 'agent-10' });
    const jid = claim.job!.id;
    const tok = claim.job!.workerLock!;
    // wrong worker (even with the real token) is rejected
    await expect(releaseJob(db, jid, 'agent-1', tok)).rejects.toThrow(/rejected/i);
    await expect(failJob(db, jid, 'x', 'agent-1', tok)).rejects.toThrow(/rejected/i);
    await expect(beginJob(db, jid, 'agent-1', tok)).rejects.toThrow(/rejected/i);
    // right worker but a stale/forged token is rejected
    await expect(beginJob(db, jid, 'agent-10', 'stale-token')).rejects.toThrow(/rejected/i);
    // the true owner with the current token works
    expect((await beginJob(db, jid, 'agent-10', tok)).status).toBe('researching');
  });
});
