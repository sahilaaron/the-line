import { describe, expect, it, afterEach } from 'vitest';
import { freshMigratedDb } from '../testing/setup';
import {
  createPeriod,
  findContainingRange,
  findExactYear,
  findNearestCuratedAnchor,
  listOverlappingPeriods,
  listPeriodsWithinRange,
} from './periods';

describe('periods repository — BCE / approximate date edge cases', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('stores BCE years as negative astronomical-year integers', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const period = await createPeriod(db, {
      label: 'c. 10,000 BCE',
      precision: 'approximate',
      startYear: -9999,
      endYear: -9000,
      slug: 'bce-10000',
    });
    expect(period.startYear).toBe(-9999);
    expect(period.endYear).toBe(-9000);
  });

  it('the DB rejects a period whose startYear > endYear (CHECK constraint)', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await expect(
      createPeriod(db, { label: 'bad', precision: 'range', startYear: 100, endYear: -100 }),
    ).rejects.toThrow();
  });

  it('findExactYear matches a year inside an open-ended BCE period', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await createPeriod(db, { label: 'ancient era', precision: 'era', startYear: -50000, endYear: null });
    const matches = await findExactYear(db, -9999);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('findContainingRange / listOverlappingPeriods / listPeriodsWithinRange behave correctly across a BCE/CE boundary', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await createPeriod(db, { label: 'spanning', precision: 'range', startYear: -100, endYear: 100 });
    await createPeriod(db, { label: 'fully-inside-ce', precision: 'range', startYear: 10, endYear: 50 });

    const containing = await findContainingRange(db, -10, 10);
    expect(containing.some((p) => p.label === 'spanning')).toBe(true);

    const overlapping = await listOverlappingPeriods(db, 40, 200);
    expect(overlapping.map((p) => p.label).sort()).toEqual(['fully-inside-ce', 'spanning'].sort());

    const within = await listPeriodsWithinRange(db, -200, 200);
    expect(within.map((p) => p.label).sort()).toEqual(['fully-inside-ce', 'spanning'].sort());
  });

  it('findNearestCuratedAnchor only considers periods with a slug', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await createPeriod(db, { label: 'uncurated', precision: 'exact', startYear: 1960, endYear: 1960 });
    await createPeriod(db, { label: '1969', precision: 'exact', startYear: 1969, endYear: 1969, slug: '1969' });
    const nearest = await findNearestCuratedAnchor(db, 1965);
    expect(nearest?.slug).toBe('1969');
  });
});
