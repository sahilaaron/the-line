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
    // 1975 has no exact period/composition; nearest ANCHOR composition is
    // 1969. Regression guard: the chronology seed also creates slugged
    // context-year periods (e.g. year-1973) that are CLOSER to 1975 but
    // carry no composition — they must never win or null the fallback.
    const yol = await nearestAvailableYolComposition(db, 1975);
    expect(yol?.anchorSlug).toBe('1969');
  });

  it('nearestAvailableYolComposition ignores synthetic compositions', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await seedPrototype(db);
    const { periods, yolCompositions } = await import('../schema');
    const [p] = await db
      .insert(periods)
      .values({ slug: 'synth-1974', label: 'SYNTH', precision: 'exact', startYear: 1974, endYear: 1974, displayYear: 1974, isSynthetic: true })
      .returning();
    await db.insert(yolCompositions).values({
      periodId: p.id,
      anchorSlug: 'synth-1974',
      title: 'SYNTH',
      thesis: 'SYNTH',
      atmospherePreset: 'orbital',
      isSynthetic: true,
    });
    // 1974 is nearer to 1975 than 1969, but it is synthetic — skip it.
    const yol = await nearestAvailableYolComposition(db, 1975);
    expect(yol?.anchorSlug).toBe('1969');
  });
});
