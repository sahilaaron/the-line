/**
 * In-memory PGlite connection factory for tests. Every call returns a
 * brand-new isolated instance (no shared state, no ordering dependence
 * between test files) per the Vitest suite requirements.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../schema';

export function createTestClient(): PGlite {
  return new PGlite();
}

export function createTestDb() {
  const pg = createTestClient();
  return { pg, db: drizzle(pg, { schema }) };
}
