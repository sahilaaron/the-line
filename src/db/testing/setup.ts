/**
 * Shared test helper: fresh, fully-migrated, isolated in-memory PGlite
 * instance per call. Every test file/suite calls this itself — no shared
 * module-level DB state, so tests never depend on run order.
 */
import path from 'node:path';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createTestDb } from '../client/test';
import type { Db } from '../repositories/types';
import type { PGlite } from '@electric-sql/pglite';

export interface FreshDb {
  db: Db;
  pg: PGlite;
}

export async function freshMigratedDb(): Promise<FreshDb> {
  const { pg, db } = createTestDb();
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  return { db, pg };
}
