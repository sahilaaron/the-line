/**
 * End-to-end proof of the research CRM using the Steam Engine fixture:
 * manual capture -> run -> claim -> submit -> QA (with a hold) -> package
 * approval excluding the held item -> private canonical record. Asserts every
 * acceptance guarantee in the Cycle 8A brief §11.
 */
import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { freshMigratedDb } from '../../../db/testing/setup';
import {
  entityTimeAssociations,
  relationships,
  researchJobs,
  yolCompositions,
  yolTimelinePoints,
} from '../../../db/schema';
import { createJob } from '../../../db/repositories/research';
import { findEntityBySlug, listEntitiesByKind } from '../../../db/repositories/entities';
import { listClaimsForSubject, listSourcesForClaim } from '../../../db/repositories/claims';
import { normalizeText } from '../../../db/repositories/graph-ext';
import { createRun } from '../run';
import { claimNextJob } from '../queue';
import { submitPackage } from '../submit';
import { recordQa } from '../qa';
import { decidePackage } from '../decision';
import { promotePackage } from '../promotion';
import {
  STEAM_ENGINE_ENVELOPE,
  STEAM_ENGINE_QA,
  STEAM_ENGINE_DECISION,
  seedSteamEngineExistingCanon,
} from './steam-engine';

async function runFullWorkflow() {
  const { db } = await freshMigratedDb();
  const seeded = await seedSteamEngineExistingCanon(db);
  const run = await createRun(db, { batchLimit: 1, operator: 'Sahil' });
  await createJob(db, {
    centralTitle: 'Steam engine (provisional record)',
    origin: 'manual',
    dedupeKey: normalizeText('steam engine'),
    status: 'queued',
  });
  const claim = await claimNextJob(db, run.id, { worker: 'cowork' });
  expect(claim.job).toBeTruthy();
  const { package: pkg } = await submitPackage(db, claim.job!.id, STEAM_ENGINE_ENVELOPE, { worker: 'cowork', leaseToken: claim.job!.workerLock! });
  await recordQa(db, pkg.id, STEAM_ENGINE_QA);
  const decision = await decidePackage(db, pkg.id, STEAM_ENGINE_DECISION);
  return { db, run, pkg, decision, seeded };
}

describe('Steam Engine end-to-end promotion', () => {
  it('promotes the central entity into a PRIVATE canonical record (never published)', async () => {
    const { db } = await runFullWorkflow();
    const central = await findEntityBySlug(db, 'steam-engine');
    expect(central).toBeTruthy();
    expect(central!.isPlaceholder).toBe(true);
    expect(central!.isSynthetic).toBe(false);
    expect(['draft', 'in_review']).toContain(central!.editorialStatus);
    expect(central!.editorialStatus).not.toBe('published');
    expect(central!.graphStatus).toBe('canonical_incomplete');
    expect(central!.primaryPeriodId).toBeTruthy(); // renderer-compat span set
  });

  it('creates accepted periods, time associations, relationships, claims and sources', async () => {
    const { db } = await runFullWorkflow();
    const central = (await findEntityBySlug(db, 'steam-engine'))!;
    const times = await db.query.entityTimeAssociations.findMany({ where: eq(entityTimeAssociations.entityId, central.id) });
    expect(times.length).toBe(4);
    const rels = await db.query.relationships.findMany({ where: eq(relationships.sourceEntityId, central.id) });
    // rel-watt (improved_by) is accepted; rel-newcomen (replaced) is held.
    expect(rels.some((r) => r.typeKey === 'improved_by')).toBe(true);
    const claims = await listClaimsForSubject(db, 'entity', central.id);
    expect(claims.length).toBeGreaterThanOrEqual(2);
    const sources = await listSourcesForClaim(db, claims[0].id);
    expect(sources.length).toBeGreaterThanOrEqual(1);
  });

  it('EXCLUDES the held relationship from the canonical graph', async () => {
    const { db, seeded } = await runFullWorkflow();
    const central = (await findEntityBySlug(db, 'steam-engine'))!;
    const held = await db.query.relationships.findFirst({
      where: and(
        eq(relationships.sourceEntityId, central.id),
        eq(relationships.targetEntityId, seeded.newcomenId),
        eq(relationships.typeKey, 'replaced'),
      ),
    });
    expect(held).toBeUndefined();
  });

  it('creates new unfinished neighbours as private draft stubs + frontier jobs', async () => {
    const { db } = await runFullWorkflow();
    const glasgow = await findEntityBySlug(db, 'university-of-glasgow');
    const condenser = await findEntityBySlug(db, 'separate-condenser');
    expect(glasgow!.graphStatus).toBe('draft_stub');
    expect(condenser!.graphStatus).toBe('draft_stub');
    const frontier = await db.query.researchJobs.findMany({ where: eq(researchJobs.origin, 'frontier') });
    // two new stubs + two suggested next entities = frontier jobs enqueued
    expect(frontier.length).toBeGreaterThanOrEqual(3);
  });

  it('NEVER promotes synthetic items into canonical rows', async () => {
    const { db, decision } = await runFullWorkflow();
    const synth = await findEntityBySlug(db, 'synthetic-stress-node');
    expect(synth).toBeUndefined();
    expect(decision.promotion!.skipped.synthetic).toBeGreaterThanOrEqual(1);
  });

  it('matches the two existing entities instead of duplicating them', async () => {
    const { db, decision } = await runFullWorkflow();
    const watts = await listEntitiesByKind(db, 'person');
    expect(watts.filter((e) => e.slug === 'james-watt').length).toBe(1);
    expect(decision.promotion!.matchedEntities).toBeGreaterThanOrEqual(2);
  });

  it('does NOT touch any YoL / public-curation table', async () => {
    const { db } = await runFullWorkflow();
    const comps = await db.query.yolCompositions.findMany();
    const points = await db.query.yolTimelinePoints.findMany();
    expect(comps.length).toBe(0);
    expect(points.length).toBe(0);
    void yolCompositions;
    void yolTimelinePoints;
  });

  it('is idempotent: re-running promotion does not duplicate anything', async () => {
    const { db, pkg } = await runFullWorkflow();
    const before = (await db.query.entities.findMany()).length;
    const relBefore = (await db.query.relationships.findMany()).length;
    const again = await promotePackage(db, pkg.id);
    expect(again.alreadyPromoted).toBe(true);
    expect((await db.query.entities.findMany()).length).toBe(before);
    expect((await db.query.relationships.findMany()).length).toBe(relBefore);
  });

  it('keeps the package / QA / decision provenance chain auditable', async () => {
    const { db, pkg } = await runFullWorkflow();
    const qa = await db.query.qaResults.findMany();
    const flags = await db.query.qaFlags.findMany();
    const decisions = await db.query.packageDecisions.findMany();
    expect(qa.length).toBe(1);
    expect(flags.length).toBe(1);
    expect(decisions.length).toBe(1);
    const finalPkg = (await db.query.researchPackages.findMany()).find((p) => p.id === pkg.id)!;
    expect(finalPkg.status).toBe('promoted');
    expect(finalPkg.promotedEntityId).toBeTruthy();
  });

  it('leaves held candidate items in staging (never silently deleted)', async () => {
    const { db, pkg } = await runFullWorkflow();
    const items = (await db.query.researchPackageItems.findMany()).filter((i) => i.packageId === pkg.id);
    const heldRel = items.find((i) => i.section === 'relationship' && i.localRef === 'rel-newcomen');
    expect(heldRel).toBeTruthy();
    expect(heldRel!.decision).toBe('held');
  });
});
