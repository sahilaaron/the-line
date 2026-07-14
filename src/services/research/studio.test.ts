/** Cycle 8B — graph projection + candidate edit / QA-invalidation tests. */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshMigratedDb } from '../../db/testing/setup';
import { researchPackageItems, researchPackages, yolCompositions } from '../../db/schema';
import { createJob } from '../../db/repositories/research';
import { submitPackage } from './submit';
import { recordQa } from './qa';
import { decidePackage } from './decision';
import { projectPackageGraph } from './graph-projection';
import {
  editPackageItemFields, changeRelationshipType, setItemHold, rejectPackageItem,
  listPackageRevisions, qaIsStale,
} from './edit';
import {
  STEAM_ENGINE_ENVELOPE, STEAM_ENGINE_QA, seedSteamEngineExistingCanon,
} from './fixtures/steam-engine';

async function stageSteamEngine(db: Awaited<ReturnType<typeof freshMigratedDb>>['db'], withQa = true) {
  await seedSteamEngineExistingCanon(db);
  const job = await createJob(db, { centralTitle: 'Steam engine', origin: 'manual', dedupeKey: `se-${Math.random()}`, status: 'claimed' });
  const { package: pkg } = await submitPackage(db, job.id, STEAM_ENGINE_ENVELOPE);
  if (withQa) await recordQa(db, pkg.id, STEAM_ENGINE_QA);
  return pkg;
}
const itemOf = async (db: Awaited<ReturnType<typeof freshMigratedDb>>['db'], pkgId: string, section: string, ref: string) =>
  (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.packageId, pkgId) })).find((i) => i.section === section && i.localRef === ref)!;

describe('graph projection', () => {
  it('projects the Steam Engine package into nodes + labelled edges', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteamEngine(db, false);
    const g = (await projectPackageGraph(db, pkg.id))!;
    expect(g.nodes.find((n) => n.role === 'central')!.localRef).toBe('central');
    // synthetic node distinguished
    expect(g.nodes.find((n) => n.localRef === 'synthnode')!.primaryState).toBe('synthetic_excluded');
    // canonical match vs new candidate distinction (watt matches seeded canon)
    const watt = g.nodes.find((n) => n.localRef === 'watt')!;
    expect(watt.matchEntityId).toBeTruthy();
    expect(['canonical_match', 'canonical_incomplete']).toContain(watt.primaryState);
    expect(g.nodes.find((n) => n.localRef === 'glasgow')!.primaryState).toBe('new_candidate');
    // edge forward + inverse labels from the registry
    const relWatt = g.edges.find((e) => e.localRef === 'rel-watt')!;
    expect(relWatt.forwardLabel).toBe('was improved by');
    expect(relWatt.inverseLabel).toBe('improved');
    expect(relWatt.source).toBe('central');
    expect(relWatt.target).toBe('watt');
    // deterministic: same projection twice
    const g2 = (await projectPackageGraph(db, pkg.id))!;
    expect(g2.nodes.map((n) => [n.id, n.x, n.y])).toEqual(g.nodes.map((n) => [n.id, n.x, n.y]));
  });
});

describe('candidate editing + QA invalidation', () => {
  it('records an append-only revision on a field edit', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteamEngine(db, false);
    const glasgow = await itemOf(db, pkg.id, 'entity', 'glasgow');
    const res = await editPackageItemFields(db, glasgow.id, { label: 'University of Glasgow (edited)' }, 'Sahil');
    expect((res.item.payload as { label: string }).label).toBe('University of Glasgow (edited)');
    const revs = await listPackageRevisions(db, pkg.id);
    expect(revs.length).toBe(1);
    expect(revs[0].editKind).toBe('field_edit');
    expect(revs[0].editor).toBe('Sahil');
    expect((revs[0].afterValue as { label: string }).label).toBe('University of Glasgow (edited)');
  });

  it('a material edit after QA invalidates QA and reverts to qa_pending', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteamEngine(db, true); // qa_complete
    const glasgow = await itemOf(db, pkg.id, 'entity', 'glasgow');
    const res = await editPackageItemFields(db, glasgow.id, { shortDescription: 'edited' }, 'Sahil');
    expect(res.invalidatedQa).toBe(true);
    expect(res.packageStatus).toBe('qa_pending');
    expect(await qaIsStale(db, pkg.id)).toBe(true);
  });

  it('blocks approval until QA is rerun after an edit', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteamEngine(db, true);
    const glasgow = await itemOf(db, pkg.id, 'entity', 'glasgow');
    await editPackageItemFields(db, glasgow.id, { shortDescription: 'edited again' }, 'Sahil');
    await expect(decidePackage(db, pkg.id, { decision: 'approve' })).rejects.toThrow(/re-run QA/i);
    // rerun QA -> approval allowed
    await recordQa(db, pkg.id, STEAM_ENGINE_QA);
    expect(await qaIsStale(db, pkg.id)).toBe(false);
    const decision = await decidePackage(db, pkg.id, { decision: 'approve_with_holds', heldItems: [{ section: 'relationship', localRef: 'rel-newcomen' }] });
    expect(decision.finalStatus).toBe('promoted');
  });

  it('hold from the edit service is not material and does not invalidate QA', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteamEngine(db, true);
    const relGlasgow = await itemOf(db, pkg.id, 'relationship', 'rel-glasgow');
    const res = await setItemHold(db, relGlasgow.id, true, 'Sahil');
    expect(res.invalidatedQa).toBe(false);
    expect(res.item.held).toBe(true);
    expect(await qaIsStale(db, pkg.id)).toBe(false);
    const revs = await listPackageRevisions(db, pkg.id);
    expect(revs[0].editKind).toBe('hold');
  });

  it('validates a relationship type change against endpoint kinds', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteamEngine(db, false);
    const relCondenser = await itemOf(db, pkg.id, 'relationship', 'rel-condenser'); // condenser -> watt (developed_by)
    // invented_by requires source invention/technology/product + target person/org — condenser(invention)->watt(person) OK
    const ok = await changeRelationshipType(db, relCondenser.id, 'invented_by', 'Sahil');
    expect((ok.item.payload as { typeKey: string }).typeKey).toBe('invented_by');
    // founded_by requires source org/movement/civilisation — condenser is invention -> reject
    await expect(changeRelationshipType(db, relCondenser.id, 'founded_by', 'Sahil')).rejects.toThrow(/not allowed|invalid/i);
  });

  it('rejects an individual candidate item (review action)', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteamEngine(db, false);
    const glasgow = await itemOf(db, pkg.id, 'entity', 'glasgow');
    const res = await rejectPackageItem(db, glasgow.id, 'Sahil');
    expect(res.item.decision).toBe('rejected');
  });

  it('never writes yol_* during editing', async () => {
    const { db } = await freshMigratedDb();
    const pkg = await stageSteamEngine(db, true);
    const glasgow = await itemOf(db, pkg.id, 'entity', 'glasgow');
    await editPackageItemFields(db, glasgow.id, { label: 'X' }, 'Sahil');
    expect((await db.select().from(yolCompositions)).length).toBe(0);
    void researchPackages;
  });
});
