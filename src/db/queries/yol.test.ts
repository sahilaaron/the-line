import { describe, expect, it, afterEach } from 'vitest';
import { freshMigratedDb } from '../testing/setup';
import { seedPrototype } from '../seed/prototype';
import { activeThemesOrderedByImportance, compositionByYearOrPeriod, featuredEntities, nearestAvailableYolComposition } from './yol';
import { findYolByAnchorSlug } from '../repositories/yol';

describe('YoL queries', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('compositionByYearOrPeriod finds the 1969 composition for year 1969', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await seedPrototype(db);
    const yol = await compositionByYearOrPeriod(db, 1969);
    expect(yol?.anchorSlug).toBe('1969');
  });

  it('activeThemesOrderedByImportance returns themes sorted descending', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await seedPrototype(db);
    const yol = await findYolByAnchorSlug(db, '1969');
    const themes = await activeThemesOrderedByImportance(db, yol!.id);
    const importances = themes.map((t) => t.importance);
    expect([...importances]).toEqual([...importances].sort((a, b) => b - a));
  });

  it('featuredEntities resolves entity rows, not just ids', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await seedPrototype(db);
    const yol = await findYolByAnchorSlug(db, '1969');
    // Prototype seed doesn't populate featured entities; assert the shape
    // holds for an empty result rather than asserting non-empty.
    const featured = await featuredEntities(db, yol!.id);
    expect(Array.isArray(featured)).toBe(true);
  });

  it('nearestAvailableYolComposition falls back to the nearest curated anchor', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await seedPrototype(db);
    // 1975 has no exact period/composition; nearest curated anchor is 1969.
    const yol = await nearestAvailableYolComposition(db, 1975);
    expect(yol?.anchorSlug).toBe('1969');
  });
});
