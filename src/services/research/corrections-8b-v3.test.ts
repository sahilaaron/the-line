/**
 * Cycle 8B correction pass v3 — permanent adversarial regression tests for the
 * independently-reproduced failures. Each is written to FAIL against tip
 * 16b6cce and PASS after the v3 correction.
 *
 *  A. every generated agent lease command carries one consistent worker identity
 *  B. same-run expired-lease reclaim does not increase claimedCount
 *  C. cross-run expired-lease reclaim repairs BOTH run counters
 *  D. a human unhold cannot remove a simultaneous CURRENT QA hold
 *  E. a passing re-QA clears the graph's CURRENT qa_flagged while keeping history
 *  F. an edge carries accurate human/QA hold provenance onto the graph model
 *  G. canonical-match editing requires a valid canonical entity + controlled status
 *  H. synthetic graph items are unavailable without explicit developer mode
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshMigratedDb } from '../../db/testing/setup';
import { entities, researchJobs, researchPackageItems, researchRuns, qaResults } from '../../db/schema';
import { createJob } from '../../db/repositories/research';
import { createEntity } from '../../db/repositories/entities';
import { createRun } from './run';
import { claimNextJob } from './queue';
import { submitPackage } from './submit';
import { recordQa } from './qa';
import { setItemHold, correctCanonicalMatch } from './edit';
import { projectPackageGraph } from './graph-projection';
import { researchAgentPrompt } from './prompts';
import { STEAM_ENGINE_ENVELOPE, STEAM_ENGINE_QA, seedSteamEngineExistingCanon } from './fixtures/steam-engine';

type DB = Awaited<ReturnType<typeof freshMigratedDb>>['db'];
const runOf = async (db: DB, id: string) => (await db.query.researchRuns.findFirst({ where: eq(researchRuns.id, id) }))!;
const item = async (db: DB, pkgId: string, section: string, ref: string) =>
  (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.packageId, pkgId) })).find((i) => i.section === section && i.localRef === ref)!;
async function stageSteam(db: DB, withQa = true) {
  await seedSteamEngineExistingCanon(db);
  const job = await createJob(db, { centralTitle: 'Steam engine', origin: 'manual', dedupeKey: `se-${Math.random()}`, status: 'claimed' });
  const { package: pkg } = await submitPackage(db, job.id, STEAM_ENGINE_ENVELOPE, { trusted: true });
  if (withQa) await recordQa(db, pkg.id, STEAM_ENGINE_QA);
  return pkg;
}
const expireLease = (db: DB, jobId: string) =>
  db.update(researchJobs).set({ leaseExpiresAt: new Date(Date.now() - 60_000) }).where(eq(researchJobs.id, jobId));

/* A ---------------------------------------------------------------- */
describe('A. agent prompt worker identity', () => {
  it('every lease command carries --worker with one consistent placeholder', () => {
    const prompt = researchAgentPrompt('run-xyz', 3);
    const leaseCmds = ['claim-next-active', 'claim --run', 'begin --job', 'heartbeat --job', 'release --job', 'fail --job'];
    for (const cmd of leaseCmds) {
      const line = prompt.split('\n').find((l) => l.includes(`research:agent -- ${cmd}`));
      expect(line, `command line for "${cmd}"`).toBeTruthy();
      expect(line, `"${cmd}" must pass --worker`).toContain('--worker <your-name>');
    }
    // no lease command uses a hardcoded default like "cowork"
    expect(prompt).not.toContain('--worker cowork');
  });
});

/* B ---------------------------------------------------------------- */
describe('B. same-run expired-lease reclaim', () => {
  it('reclaiming the run\'s own expired job does not increase claimedCount', async () => {
    const { db } = await freshMigratedDb();
    const run = await createRun(db, { batchLimit: 2 });
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    const claim = await claimNextJob(db, run.id, { worker: 'w1' });
    expect((await runOf(db, run.id)).claimedCount).toBe(1);
    await expireLease(db, claim.job!.id);
    const reclaim = await claimNextJob(db, run.id, { worker: 'w1' });
    expect(reclaim.job!.id).toBe(claim.job!.id); // same job recovered
    expect(reclaim.recovered).toBe(true);
    // NOT 2: a recovered job is not a second batch item.
    expect((await runOf(db, run.id)).claimedCount).toBe(1);
  });
});

/* C ---------------------------------------------------------------- */
describe('C. cross-run expired-lease reclaim', () => {
  it('a different run reclaiming repairs both run counters', async () => {
    const { db } = await freshMigratedDb();
    const runA = await createRun(db, { batchLimit: 2 });
    await createJob(db, { centralTitle: 'A', origin: 'manual', dedupeKey: 'a', status: 'queued' });
    const claim = await claimNextJob(db, runA.id, { worker: 'wa' });
    expect((await runOf(db, runA.id)).claimedCount).toBe(1);
    await expireLease(db, claim.job!.id);
    const runB = await createRun(db, { batchLimit: 2 });
    const reclaim = await claimNextJob(db, runB.id, { worker: 'wb' });
    expect(reclaim.job!.id).toBe(claim.job!.id);
    expect(reclaim.recovered).toBe(true);
    expect((await runOf(db, runA.id)).claimedCount).toBe(0); // old run released
    expect((await runOf(db, runB.id)).claimedCount).toBe(1); // new run consumed
    const job = await db.query.researchJobs.findFirst({ where: eq(researchJobs.id, claim.job!.id) });
    expect(job!.claimedByRunId).toBe(runB.id);
  });
});

/* D ---------------------------------------------------------------- */
describe('D. human unhold cannot remove a current QA hold', () => {
  it('an item held by BOTH human and QA stays held after the human unholds', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteam(db, true); // QA holds rel-newcomen
    const rel = await item(db, pkg.id, 'relationship', 'rel-newcomen');
    expect(rel.qaHeld).toBe(true);
    // human ALSO holds the same item
    await setItemHold(db, rel.id, true, 'Sahil');
    let after = await item(db, pkg.id, 'relationship', 'rel-newcomen');
    expect(after.humanHeld).toBe(true);
    expect(after.qaHeld).toBe(true);
    expect(after.held).toBe(true);
    // human REMOVES their hold — the current QA hold must remain
    await setItemHold(db, rel.id, false, 'Sahil');
    after = await item(db, pkg.id, 'relationship', 'rel-newcomen');
    expect(after.humanHeld).toBe(false);
    expect(after.qaHeld).toBe(true);
    expect(after.held).toBe(true); // still held by QA
  });
});

/* E ---------------------------------------------------------------- */
describe('E. graph current QA flags come only from the latest QA result', () => {
  it('a passing re-QA clears the graph qa_flagged state but keeps QA history', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteam(db, true); // first QA flags rel-newcomen
    let graph = (await projectPackageGraph(db, pkg.id))!;
    expect(graph.edges.find((e) => e.localRef === 'rel-newcomen')!.qaFlagged).toBe(true);
    // corrected package receives a later PASSING QA result with no flags
    await recordQa(db, pkg.id, { recommendation: 'pass', flags: [] });
    graph = (await projectPackageGraph(db, pkg.id))!;
    expect(graph.edges.find((e) => e.localRef === 'rel-newcomen')!.qaFlagged).toBe(false); // current = clear
    expect(graph.flags.length).toBe(0); // current flags empty
    // audit history preserved: two QA results still exist
    const results = await db.query.qaResults.findMany({ where: eq(qaResults.packageId, pkg.id) });
    expect(results.length).toBe(2);
  });
});

/* F ---------------------------------------------------------------- */
describe('F. edge hold provenance projected accurately', () => {
  it('a simultaneously human+QA held edge carries both flags on the graph model', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteam(db, true); // QA holds rel-newcomen
    const rel = await item(db, pkg.id, 'relationship', 'rel-newcomen');
    await setItemHold(db, rel.id, true, 'Sahil'); // + human hold
    const graph = (await projectPackageGraph(db, pkg.id))!;
    const edge = graph.edges.find((e) => e.localRef === 'rel-newcomen')!;
    expect(edge.held).toBe(true);
    expect(edge.humanHeld).toBe(true);
    expect(edge.qaHeld).toBe(true);
  });
});

/* G ---------------------------------------------------------------- */
describe('G. canonical-match editing requires a valid entity + controlled status', () => {
  it('rejects an asserting status with no entity id (and never silently clears a match)', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteam(db, false);
    const central = await item(db, pkg.id, 'entity', 'central'); // kind: invention
    // a KIND-COMPATIBLE, non-synthetic target (invention); status is derived.
    const target = await createEntity(db, { slug: 'match-target-inv', kind: 'invention', label: 'Target Invention', graphStatus: 'canonical_complete' });
    await correctCanonicalMatch(db, central.id, target.id, null, 'Sahil');
    expect((await item(db, pkg.id, 'entity', 'central')).matchEntityId).toBe(target.id);
    expect((await item(db, pkg.id, 'entity', 'central')).matchStatus).toBe('canonical_complete'); // derived
    // an asserting status with NO id must be rejected — not silently clear it
    await expect(correctCanonicalMatch(db, central.id, null, 'canonical_complete', 'Sahil')).rejects.toThrow();
    expect((await item(db, pkg.id, 'entity', 'central')).matchEntityId).toBe(target.id); // unchanged
    // arbitrary free-text status is rejected
    await expect(correctCanonicalMatch(db, central.id, target.id, 'totally-made-up', 'Sahil')).rejects.toThrow();
    // a non-existent entity id is rejected
    await expect(correctCanonicalMatch(db, central.id, 'no-such-id', 'canonical_incomplete', 'Sahil')).rejects.toThrow();
    // explicit clear with a no-entity status is allowed
    const cleared = await correctCanonicalMatch(db, central.id, null, 'no_match', 'Sahil');
    expect(cleared.item.matchEntityId).toBeNull();
  });
});

/* H ---------------------------------------------------------------- */
describe('H. synthetic graph items require explicit developer mode', () => {
  it('normal projection excludes synthetic; dev projection includes them (still unpromotable)', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteam(db, false); // envelope contains a synthetic node + edge
    const normal = (await projectPackageGraph(db, pkg.id))!;
    expect(normal.nodes.some((n) => n.synthetic)).toBe(false);
    expect(normal.nodes.some((n) => n.localRef === 'synthnode')).toBe(false);
    expect(normal.edges.some((e) => e.localRef === 'rel-synth')).toBe(false); // edge to synthetic dropped
    const dev = (await projectPackageGraph(db, pkg.id, { includeSynthetic: true }))!;
    expect(dev.nodes.some((n) => n.localRef === 'synthnode' && n.synthetic)).toBe(true);
    // synthetic items are still flagged unpromotable in the DB
    const synth = await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.packageId, pkg.id) });
    expect(synth.find((i) => i.localRef === 'synthnode')!.isSynthetic).toBe(true);
    void entities;
  });
});
