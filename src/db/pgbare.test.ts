/**
 * Smoke test: bare PGlite boots and answers a trivial query, independent
 * of Drizzle/migrations/schema. Kept separate from schema/migration tests
 * so a failure here immediately points at the PGlite/vitest pool
 * integration rather than anything app-specific (see the vitest.config.ts
 * `pool: 'forks'` note and Cycle 3 in docs/implementation-notes.md).
 */
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

describe('PGlite smoke test', () => {
  it('boots an in-memory instance and runs a trivial query', async () => {
    const pg = new PGlite();
    const r = await pg.query('select 1 as x');
    expect(r.rows).toEqual([{ x: 1 }]);
    await pg.close();
  });
});
