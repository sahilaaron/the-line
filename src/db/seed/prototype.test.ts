import { describe, expect, it, afterEach } from 'vitest';
import { freshMigratedDb } from '../testing/setup';
import { seedPrototype } from './prototype';
import { YOL_CONTENT } from '../../data/yol';

describe('prototype seed', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('seeds all 5 anchors as periods with placeholder flags', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const summary = await seedPrototype(db);
    expect(summary.periodsCreated).toBe(5);

    const periods = await db.query.periods.findMany();
    expect(periods).toHaveLength(5);
    expect(periods.every((p) => p.isPlaceholder)).toBe(true);

    const yol1969 = await db.query.yolCompositions.findFirst({ where: (t, { eq }) => eq(t.anchorSlug, '1969') });
    // Assert against the single source of truth in src/data/yol.ts rather than
    // a hard-coded phrase, so editorial copy changes don't make this go stale.
    expect(yol1969?.thesis).toBe(YOL_CONTENT['1969'].thesis);
  });

  it('is idempotent — running twice does not duplicate rows', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await seedPrototype(db);
    const second = await seedPrototype(db);
    expect(second.periodsCreated).toBe(0);
    expect(second.entitiesCreated).toBe(0);
    expect(second.yolCompositionsCreated).toBe(0);

    const periods = await db.query.periods.findMany();
    expect(periods).toHaveLength(5);
  });
});
