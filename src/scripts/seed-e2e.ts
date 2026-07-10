/**
 * db:seed:e2e — the seed the end-to-end suite runs against.
 *
 * It loads the real prototype chronology (1769 / 1969) AND a DELIBERATELY
 * TINY synthetic set. The synthetic rows exist so the synthetic-exclusion
 * e2e spec has teeth — every one is prefixed `synth-` / `SYNTHETIC:` and
 * marked isSynthetic, so if the read-model boundary ever stopped excluding
 * them the rendered YoL would surface that text and the spec would fail.
 *
 * We use a handful of rows (not the full ~38k stress targets) so CI e2e
 * setup stays fast; scale/determinism of the synthetic generator itself is
 * covered by src/db/seed/synthetic.test.ts.
 */
import { closeDevClient, getDevDb } from '../db/client/dev';
import { seedPrototype } from '../db/seed/prototype';
import { seedSynthetic } from '../db/seed/synthetic';

const E2E_SYNTHETIC_TARGETS = {
  entities: 12,
  periods: 12,
  relationships: 12,
  claims: 6,
  sources: 6,
  yolCompositions: 4,
} as const;

async function main() {
  const db = getDevDb();
  const proto = await seedPrototype(db);
  console.log('[db:seed:e2e] prototype seed summary:', proto);
  const synth = await seedSynthetic(db, undefined, E2E_SYNTHETIC_TARGETS);
  console.log('[db:seed:e2e] tiny synthetic seed summary:', synth);
  await closeDevClient();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[db:seed:e2e] failed:', err);
    process.exit(1);
  });
