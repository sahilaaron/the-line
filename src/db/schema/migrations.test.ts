import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createTestDb } from '../client/test';

describe('migrations', () => {
  it('applies cleanly to an empty database', async () => {
    const { db, pg } = createTestDb();
    await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
    const rows = await db.query.periods.findMany();
    expect(rows).toEqual([]);
    await pg.close();
  });

  it('is safe to run twice (idempotent)', async () => {
    const { db, pg } = createTestDb();
    await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
    await expect(migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })).resolves.not.toThrow();
    await pg.close();
  });
});
