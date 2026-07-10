/**
 * db:export — dumps the full DB to a JSON file (versioned format). Usage:
 *   npx tsx src/scripts/export.ts [outFile] [--yol <yolId>]
 * With --yol, exports just that composition + its dependency closure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getDevDb, closeDevClient } from '../db/client/dev';
import { exportDatabase, exportYolClosure } from '../db/import-export/export';

async function main() {
  const args = process.argv.slice(2);
  const yolIdx = args.indexOf('--yol');
  const yolId = yolIdx >= 0 ? args[yolIdx + 1] : undefined;
  const outFile = args.find((a) => !a.startsWith('--') && a !== yolId) ?? 'docs/generated/db-export.json';

  const db = getDevDb();
  const payload = yolId ? await exportYolClosure(db, yolId) : await exportDatabase(db);
  await closeDevClient();

  const outPath = path.resolve(process.cwd(), outFile);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`[db:export] wrote ${outPath}`);
  const counts = Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, (v as unknown[]).length]));
  console.log('[db:export] row counts:', counts);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('[db:export] failed:', err);
  process.exit(1);
});
