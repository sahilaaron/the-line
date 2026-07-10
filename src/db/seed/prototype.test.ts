import { describe, expect, it, afterEach } from 'vitest';
import { freshMigratedDb } from '../testing/setup';
import { seedPrototype } from './prototype';
import { YOL_CONTENT, YOL_YEARS } from '../../data/yol';
import { YOL_CHRONOLOGY } from './yol-chronology';

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

    const anchors = await db.query.periods.findMany({
      where: (t, { inArray }) => inArray(t.slug, ['bce-10000', '1450', '1769', '1969', '2026']),
    });
    expect(anchors).toHaveLength(5);

    const all = await db.query.periods.findMany();
    expect(all.every((p) => p.isPlaceholder)).toBe(true);
    expect(all.every((p) => !p.isSynthetic)).toBe(true);

    const yol1969 = await db.query.yolCompositions.findFirst({ where: (t, { eq }) => eq(t.anchorSlug, '1969') });
    // Assert against the single source of truth in src/data/yol rather than
    // a hard-coded phrase, so editorial copy changes don't make this go stale.
    expect(yol1969?.thesis).toBe(YOL_CONTENT['1969'].thesis);
  });

  it('seeds the complete local chronology for 1769 and 1969', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await seedPrototype(db);

    for (const anchorId of ['1769', '1969'] as const) {
      const chron = YOL_CHRONOLOGY[anchorId];
      const year = YOL_YEARS[anchorId];
      const yol = await db.query.yolCompositions.findFirst({ where: (t, { eq }) => eq(t.anchorSlug, anchorId) });
      expect(yol).toBeDefined();
      const points = await db.query.yolTimelinePoints.findMany({
        where: (t, { eq }) => eq(t.yolId, yol!.id),
        orderBy: (t, { asc }) => [asc(t.displayOrder)],
      });
      const expected =
        chron.contextsBefore.length + 1 + year.events.length + chron.contextsAfter.length + 1;
      expect(points).toHaveLength(expected);
      // contexts before -> overview -> developments -> contexts after -> closing
      expect(points.slice(0, chron.contextsBefore.length).every((p) => p.role === 'context')).toBe(true);
      expect(points[chron.contextsBefore.length].role).toBe('overview');
      expect(points[points.length - 1].role).toBe('closing');
      const devs = points.filter((p) => p.role === 'development');
      expect(devs).toHaveLength(year.events.length);
      expect(devs.map((d) => d.headline)).toEqual(chron.events.map((e) => year.events.find((x) => x.id === e.eventId)!.title));
      expect(points.every((p) => p.isPlaceholder && !p.isSynthetic && p.editorialStatus === 'draft')).toBe(true);
    }
  });

  it('stores within-year date parts as integers (no JS Date)', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await seedPrototype(db);
    const apollo = await db.query.periods.findFirst({ where: (t, { eq }) => eq(t.slug, 'evt-1969-apollo11') });
    expect(apollo?.startYear).toBe(1969);
    expect(apollo?.startMonth).toBe(7);
    expect(apollo?.startDay).toBe(20);
    const woodstock = await db.query.periods.findFirst({ where: (t, { eq }) => eq(t.slug, 'evt-1969-woodstock') });
    expect(woodstock?.startDay).toBe(15);
    expect(woodstock?.endDay).toBe(18);
    const watt = await db.query.periods.findFirst({ where: (t, { eq }) => eq(t.slug, 'evt-1769-watt-condenser') });
    expect(watt?.startMonth).toBe(1);
    expect(watt?.startDay).toBeNull();
  });

  it('seeds no sources and no claims (nothing is researched yet)', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await seedPrototype(db);
    expect(await db.query.sources.findMany()).toHaveLength(0);
    expect(await db.query.claims.findMany()).toHaveLength(0);
  });

  it('is idempotent — running twice does not duplicate rows', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await seedPrototype(db);
    const countsAfterFirst = {
      periods: (await db.query.periods.findMany()).length,
      entities: (await db.query.entities.findMany()).length,
      points: (await db.query.yolTimelinePoints.findMany()).length,
      pointThemes: (await db.query.yolPointThemes.findMany()).length,
    };
    const second = await seedPrototype(db);
    expect(second.periodsCreated).toBe(0);
    expect(second.entitiesCreated).toBe(0);
    expect(second.yolCompositionsCreated).toBe(0);
    expect(second.timelinePointsCreated).toBe(0);
    expect({
      periods: (await db.query.periods.findMany()).length,
      entities: (await db.query.entities.findMany()).length,
      points: (await db.query.yolTimelinePoints.findMany()).length,
      pointThemes: (await db.query.yolPointThemes.findMany()).length,
    }).toEqual(countsAfterFirst);
  });

  it('upgrades a database seeded by the pre-chronology seed (existing composition, no points)', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    // simulate the old seed's output: run the new seed, then strip the new rows
    await seedPrototype(db);
    const { yolTimelinePoints, yolPointThemes, yolThemes, entityThemeDetails } = await import('../schema');
    const { sql } = await import('drizzle-orm');
    await db.delete(yolPointThemes);
    await db.delete(yolTimelinePoints);
    await db.update(yolThemes).set({ displayLabel: null });
    await db.update(entityThemeDetails).set({ lensKey: null });
    await db.execute(sql`select 1`);

    const again = await seedPrototype(db);
    expect(again.timelinePointsCreated).toBeGreaterThan(0);
    const yol = await db.query.yolCompositions.findFirst({ where: (t, { eq }) => eq(t.anchorSlug, '1769') });
    const points = await db.query.yolTimelinePoints.findMany({ where: (t, { eq }) => eq(t.yolId, yol!.id) });
    expect(points.length).toBeGreaterThan(0);
    // lens keys and display labels were back-filled
    const details = await db.query.entityThemeDetails.findMany();
    expect(details.some((d) => d.lensKey === 'spaceflight')).toBe(true);
    const themes = await db.query.yolThemes.findMany({ where: (t, { eq }) => eq(t.yolId, yol!.id) });
    expect(themes.some((t) => t.displayLabel === 'Steam & Mechanisation')).toBe(true);
  });
});
