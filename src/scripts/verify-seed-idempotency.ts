/**
 * Verification (item 4): runs the demo seed twice against ONE database and
 * asserts idempotency. Exits 0 only if every assertion holds. Not a product
 * script — a repeatable verification harness for release checks / CI.
 */
import path from 'node:path';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { getDevClient, getDevDb, closeDevClient } from '../db/client/dev';
import { seedResearchDemo } from '../services/research/fixtures/seed-demo';
import { eq } from 'drizzle-orm';
import { entities, researchPackages, researchRuns } from '../db/schema';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

async function main() {
  await getDevClient().waitReady;
  const db = getDevDb();
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

  const first = await seedResearchDemo(db);
  assert(first.status === 'seeded', `first run status = ${first.status} (expected seeded)`);
  const runsAfterFirst = (await db.select().from(researchRuns)).length;

  const second = await seedResearchDemo(db);
  assert(second.status === 'already_seeded', `second run status = ${second.status} (expected already_seeded)`);

  const pkgs = await db.select().from(researchPackages);
  assert(pkgs.filter((p) => p.centralSlug === 'steam-engine').length === 1, 'exactly one Steam Engine package');
  assert(pkgs.filter((p) => p.centralSlug === 'hero-engine').length === 1, "exactly one Hero's Engine package");

  for (const slug of ['james-watt', 'thomas-newcomen', 'aeolipile']) {
    const rows = await db.select().from(entities).where(eq(entities.slug, slug));
    assert(rows.length === 1, `exactly one ${slug} entity (found ${rows.length})`);
  }

  const runsAfterSecond = (await db.select().from(researchRuns)).length;
  assert(runsAfterSecond === runsAfterFirst, `no redundant run (before ${runsAfterFirst}, after ${runsAfterSecond})`);

  console.log('[verify-seed-idempotency] OK: both runs succeeded; one Steam + one Hero package; one james-watt/thomas-newcomen/aeolipile; no redundant run.');
  await closeDevClient();
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[verify-seed-idempotency]', err.message ?? err);
  process.exit(1);
});
