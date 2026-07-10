/**
 * db:import — imports a versioned JSON fixture file, transactionally.
 * Usage: npx tsx src/scripts/import.ts <file> [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { getDevDb, closeDevClient } from '../db/client/dev';
import { importFixture } from '../db/import-export/import';
import type { ExportPayload } from '../db/import-export/types';

const DATE_KEYS = new Set(['createdAt', 'updatedAt', 'exportedAt']);

/** JSON.parse serializes Date -> ISO string; this reviver converts it back
 * for the specific columns Drizzle expects a real Date for on insert. */
function reviver(key: string, value: unknown): unknown {
  if (DATE_KEYS.has(key) && typeof value === 'string') {
    return new Date(value);
  }
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('[db:import] usage: tsx src/scripts/import.ts <file> [--dry-run]');
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'), reviver) as ExportPayload;

  const db = getDevDb();
  const summary = await importFixture(db, payload, { dryRun });
  await closeDevClient();

  console.log(`[db:import] ${dryRun ? '(dry run) ' : ''}ok=${summary.ok}`);
  console.log('[db:import] created:', summary.created);
  console.log('[db:import] skipped:', summary.skipped);
  if (summary.errorMessages.length > 0) {
    console.log('[db:import] errors:', summary.errorMessages);
  }
  if (!summary.ok) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[db:import] failed:', err);
    process.exit(1);
  });
