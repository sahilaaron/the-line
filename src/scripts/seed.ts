/**
 * db:seed          -> prototype seed only (idempotent)
 * db:seed:synthetic -> prototype seed + synthetic stress seed (idempotent)
 */
import { getDevDb, closeDevClient } from '../db/client/dev';
import { seedPrototype } from '../db/seed/prototype';
import { seedSynthetic } from '../db/seed/synthetic';

async function main() {
  const withSynthetic = process.argv.includes('--synthetic');
  const db = getDevDb();

  const proto = await seedPrototype(db);
  console.log('[db:seed] prototype seed summary:', proto);

  if (withSynthetic) {
    console.log('[db:seed] running synthetic stress seed (this can take a while)...');
    const synth = await seedSynthetic(db);
    console.log('[db:seed] synthetic seed summary:', synth);
  }

  await closeDevClient();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('[db:seed] failed:', err);
  process.exit(1);
});
