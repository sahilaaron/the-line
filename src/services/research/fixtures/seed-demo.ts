/**
 * Idempotent demo seed for the research CRM. Callable against any Db (the
 * on-disk dev DB from the script, or an in-memory test DB). Running it twice is
 * safe: canonical entities are found-or-created, and demo packages are created
 * only when absent — a second full run reports `already_seeded` and creates NO
 * new research run. Clearly-provisional test data; never published.
 */
import type { Db } from '../../../db/repositories/types';
import { createEntity, findEntityBySlug } from '../../../db/repositories/entities';
import { createRun } from '../run';
import { captureManualJob } from '../capture';
import { claimNextJob } from '../queue';
import { submitPackage } from '../submit';
import { recordQa } from '../qa';
import { STEAM_ENGINE_ENVELOPE, STEAM_ENGINE_QA, seedSteamEngineExistingCanon } from './steam-engine';

const HERO_ENVELOPE = {
  schemaVersion: 1 as const,
  submittedBy: 'seed',
  entities: [
    {
      ref: 'central',
      role: 'central' as const,
      slug: 'hero-engine',
      label: "Hero's engine (provisional record)",
      kind: 'invention' as const,
      classifications: ['invention'],
      shortDescription: 'A first-century steam device; likely the same subject as the Aeolipile.',
    },
  ],
};

async function ensureEntity(db: Db, input: Parameters<typeof createEntity>[1]): Promise<void> {
  const existing = await findEntityBySlug(db, input.slug!);
  if (!existing) await createEntity(db, input);
}

export interface SeedDemoResult {
  status: 'seeded' | 'already_seeded';
  steamPackageId?: string;
  heroPackageId?: string;
}

export async function seedResearchDemo(db: Db): Promise<SeedDemoResult> {
  const packages = await db.query.researchPackages.findMany();
  const steamExisting = packages.find((p) => p.centralSlug === 'steam-engine');
  const heroExisting = packages.find((p) => p.centralSlug === 'hero-engine');
  const studioExisting = packages.find((p) => p.centralSlug === 'studio-demo-engine');
  if (steamExisting && heroExisting && studioExisting) {
    return { status: 'already_seeded', steamPackageId: steamExisting.id, heroPackageId: heroExisting.id };
  }

  // Canonical entities the demo references (idempotent).
  await seedSteamEngineExistingCanon(db);

  // Only open a run when there is at least one package to seed.
  const run = await createRun(db, { batchLimit: 3, operator: 'Sahil' });
  let steamPackageId = steamExisting?.id;
  let heroPackageId = heroExisting?.id;

  if (!steamExisting) {
    await captureManualJob(db, {
      title: 'Steam engine (provisional record)',
      url: 'https://en.wikipedia.org/wiki/Steam_engine',
      focusNote: 'Prove the pipeline end to end.',
      priority: 50,
    });
    const claim = await claimNextJob(db, run.id, { worker: 'seed' });
    if (claim.job) {
      // Submit through the NORMAL production path: worker + the lease token the
      // claim returned (the job's workerLock). No trusted bypass.
      const { package: pkg } = await submitPackage(db, claim.job.id, STEAM_ENGINE_ENVELOPE, { worker: 'seed', leaseToken: claim.job.workerLock! });
      await recordQa(db, pkg.id, STEAM_ENGINE_QA);
      steamPackageId = pkg.id;
    }
  }

  if (!heroExisting) {
    // The duplicate-candidate's canonical target (find-or-create).
    await ensureEntity(db, {
      slug: 'aeolipile',
      kind: 'invention',
      label: 'Aeolipile',
      isPlaceholder: true,
      isSynthetic: false,
      editorialStatus: 'in_review',
      graphStatus: 'canonical_incomplete',
    });
    await captureManualJob(db, { title: "Hero's engine (provisional record)", priority: 40 });
    const dupClaim = await claimNextJob(db, run.id, { worker: 'seed' });
    if (dupClaim.job) {
      const { package: dupPkg } = await submitPackage(db, dupClaim.job.id, HERO_ENVELOPE, { worker: 'seed', leaseToken: dupClaim.job.workerLock! });
      await recordQa(db, dupPkg.id, { recommendation: 'duplicate', summary: 'Looks like the Aeolipile.', flags: [] });
      heroPackageId = dupPkg.id;
    }
  }

  // A THIRD, ISOLATED package for the graph EDIT scenario, so the approval and
  // edit e2e specs never depend on shared mutation or file order.
  if (!studioExisting) {
    const editableEnvelope = {
      ...STEAM_ENGINE_ENVELOPE,
      entities: STEAM_ENGINE_ENVELOPE.entities.map((e) =>
        e.role === 'central' ? { ...e, slug: 'studio-demo-engine', label: 'Studio demo engine (provisional record)' } : e,
      ),
      // Mark one relationship as an AGENT-proposed hold so the Studio's
      // agent-hold resolution controls have something to act on in e2e.
      connections: STEAM_ENGINE_ENVELOPE.connections.map((c) =>
        c.ref === 'rel-glasgow' ? { ...c, held: true } : c,
      ),
    };
    await captureManualJob(db, { title: 'Studio demo engine (provisional record)', priority: 30 });
    const stClaim = await claimNextJob(db, run.id, { worker: 'seed' });
    if (stClaim.job) {
      const { package: stPkg } = await submitPackage(db, stClaim.job.id, editableEnvelope, { worker: 'seed', leaseToken: stClaim.job.workerLock! });
      await recordQa(db, stPkg.id, STEAM_ENGINE_QA);
      void stPkg;
    }
  }

  return { status: 'seeded', steamPackageId, heroPackageId };
}
