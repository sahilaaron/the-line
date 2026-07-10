import type { PgliteDatabase } from 'drizzle-orm/pglite';
import type * as schema from '../schema';

/** The concrete Drizzle DB type every repository/query function accepts.
 * Callers pass either getDevDb() or createTestDb().db. */
export type Db = PgliteDatabase<typeof schema>;
