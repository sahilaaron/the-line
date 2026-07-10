/**
 * db:migrate — applies drizzle/*.sql migrations to the dev-persistent
 * PGlite data dir (creates it if absent). Safe to re-run (drizzle tracks
 * applied migrations in its own `__drizzle_migrations` table).
 */
import path from 'node:path';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { getDevClient, getDevDb, closeDevClient } from '../db/client/dev';

async function main() {
  const db = getDevDb();
  // Ensure the client is actually initialized before migrating.
  await getDevClient().waitReady;
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  console.log('[db:migrate] migrations applied.');
  await closeDevClient();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('[db:migrate] failed:', err);
  process.exit(1);
});
