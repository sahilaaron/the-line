/**
 * db:audit — integrity audit CLI. Exits non-zero when any error-level
 * issue is found (CI-suitable). `--json` prints the machine-readable
 * report instead of the human-readable terminal summary.
 */
import { getDevDb, closeDevClient } from '../db/client/dev';
import { runIntegrityAudit } from '../db/queries/audit';

async function main() {
  const asJson = process.argv.includes('--json');
  const db = getDevDb();
  const report = await runIntegrityAudit(db);
  await closeDevClient();

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('[db:audit] totals:', report.totals);
    console.log(`[db:audit] ${report.warnings.length} warning(s):`);
    for (const w of report.warnings) console.log(`  WARN  [${w.code}] ${w.message}`);
    console.log(`[db:audit] ${report.errors.length} error(s):`);
    for (const e of report.errors) console.log(`  ERROR [${e.code}] ${e.message}`);
  }

  if (report.errors.length > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('[db:audit] failed:', err);
  process.exit(1);
});
