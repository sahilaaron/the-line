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
import { createJob } from '../db/repositories/research';
import { normalizeText } from '../db/repositories/graph-ext';
import { createRun } from '../services/research/run';
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
  await createJob(db, {
    centralTitle: 'Steam engine (provisional record)',
    centralUrl: 'https://en.wikipedia.org/wiki/Steam_engine',
    focusNote: 'Prove the pipeline end to end.',
    origin: 'manual',
    priority: 50,
    dedupeKey: normalizeText('steam engine'),
    status: 'queued',
  });
  const claim = await claimNextJob(db, run.id, { worker: 'seed' });
  if (claim.job) {
    const { package: pkg } = await submitPackage(db, claim.job.id, STEAM_ENGINE_ENVELOPE, { submittedBy: 'seed' });
    await recordQa(db, pkg.id, STEAM_ENGINE_QA);
    console.log(`[db:seed:research] run ${run.id}; package ${pkg.id} awaiting review (QA hold applied).`);
  }
  await closeDevClient();
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[db:seed:research] failed:', err);
  process.exit(1);
});
