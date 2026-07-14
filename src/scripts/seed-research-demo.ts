/**
 * Seed the dev DB with the Steam Engine demo up to the human-review point:
 * migrates, seeds the two existing canonical entities, opens a run, captures a
 * manual job, claims it, submits the fixture package and records QA (leaving a
 * package awaiting the reviewer's decision in the CRM). Deterministic; safe to
 * re-run. Clearly-provisional test data — never published.
 */
import path from 'node:path';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { getDevClient, getDevDb, closeDevClient } from '../db/client/dev';
import { createRun } from '../services/research/run';
import { createEntity } from '../db/repositories/entities';
import { captureManualJob } from '../services/research/capture';
import { claimNextJob } from '../services/research/queue';
import { submitPackage } from '../services/research/submit';
import { recordQa } from '../services/research/qa';
import {
  STEAM_ENGINE_ENVELOPE,
  STEAM_ENGINE_QA,
  seedSteamEngineExistingCanon,
} from '../services/research/fixtures/steam-engine';

async function main() {
  await getDevClient().waitReady;
  const db = getDevDb();
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

  await seedSteamEngineExistingCanon(db);
  const run = await createRun(db, { batchLimit: 3, operator: 'Sahil' });
  await captureManualJob(db, {
    title: 'Steam engine (provisional record)',
    url: 'https://en.wikipedia.org/wiki/Steam_engine',
    focusNote: 'Prove the pipeline end to end.',
    priority: 50,
  });
  const claim = await claimNextJob(db, run.id, { worker: 'seed' });
  if (claim.job) {
    const { package: pkg } = await submitPackage(db, claim.job.id, STEAM_ENGINE_ENVELOPE, { submittedBy: 'seed' });
    await recordQa(db, pkg.id, STEAM_ENGINE_QA);
    console.log(`[db:seed:research] run ${run.id}; package ${pkg.id} awaiting review (QA hold applied).`);
  }

  // A SECOND package awaiting review, staged to be marked as a duplicate of an
  // existing canonical entity (demo/test data only). Distinct subject slug so
  // it is a genuine new candidate that turns out to duplicate 'aeolipile'.
  await createEntity(db, {
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
    const dupEnvelope = {
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
    const { package: dupPkg } = await submitPackage(db, dupClaim.job.id, dupEnvelope, { submittedBy: 'seed' });
    await recordQa(db, dupPkg.id, { recommendation: 'duplicate', summary: 'Looks like the Aeolipile.', flags: [] });
    console.log(`[db:seed:research] duplicate-candidate package ${dupPkg.id} awaiting review.`);
  }

  await closeDevClient();
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[db:seed:research] failed:', err);
  process.exit(1);
});
