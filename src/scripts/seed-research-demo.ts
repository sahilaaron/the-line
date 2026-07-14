/**
 * db:seed:research — migrates the dev DB and seeds the CRM demo to the
 * human-review point (Steam Engine package + a duplicate-candidate Hero's
 * Engine package, both awaiting review). Idempotent: safe to re-run — the
 * second invocation reports "already seeded" and creates nothing new. The
 * reusable, testable logic lives in fixtures/seed-demo.ts.
 */
import path from 'node:path';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { getDevClient, getDevDb, closeDevClient } from '../db/client/dev';
import { seedResearchDemo } from '../services/research/fixtures/seed-demo';

async function main() {
  await getDevClient().waitReady;
  const db = getDevDb();
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

  const res = await seedResearchDemo(db);
  if (res.status === 'already_seeded') {
    console.log('[db:seed:research] already seeded — nothing to do.');
  } else {
    console.log(
      `[db:seed:research] seeded — Steam Engine package ${res.steamPackageId ?? '—'} + Hero's Engine duplicate-candidate ${res.heroPackageId ?? '—'} awaiting review.`,
    );
  }
  await closeDevClient();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[db:seed:research] failed:', err);
    process.exit(1);
  });
