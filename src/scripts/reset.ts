/**
 * db:reset — wipes the local PGlite dev data dir and re-runs migrations.
 * Only ever touches the directory returned by resolveDevDataDir() (never
 * anything outside the repo).
 *
 * Deletion strategy: tries a real recursive delete first; if that fails
 * (some sandboxed/mounted filesystems intermittently return EPERM on
 * directory deletion — observed in this project's dev sandbox), falls
 * back to renaming the old directory aside (a same-filesystem rename is
 * far more reliable than a recursive delete there) rather than failing
 * the whole reset. Renamed-aside directories are still under
 * `.pglite-data/` (gitignored) so they don't pollute the repo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { closeDevClient, getDevClient, getDevDb, resolveDevDataDir } from '../db/client/dev';

async function main() {
  await closeDevClient();
  const dir = resolveDevDataDir();
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[db:reset] removed ${dir}`);
    } catch (err) {
      const trashDir = `${dir}-stale-${Date.now()}`;
      fs.renameSync(dir, trashDir);
      console.warn(
        `[db:reset] could not delete ${dir} (${(err as Error).message}); renamed aside to ${trashDir} instead.`,
      );
    }
  }
  fs.mkdirSync(dir, { recursive: true });
  const db = getDevDb();
  await getDevClient().waitReady;
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  console.log('[db:reset] fresh migrations applied.');
  await closeDevClient();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('[db:reset] failed:', err);
  process.exit(1);
});
