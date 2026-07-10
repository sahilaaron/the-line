import { describe, expect, it, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshMigratedDb } from '../testing/setup';
import { seedPrototype } from '../seed/prototype';
import { yolReadModelByAnchorSlug } from './yol-read-model';
import {
  claims,
  claimSources,
  entities,
  periods,
  sources,
  yolCompositions,
  yolTimelinePoints,
} from '../schema';
import { formatYolDate } from '../../domain/yol-read-model';

describe('YoL read model', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  async function seeded() {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await seedPrototype(db);
    return db;
  }

  it('loads the composition by anchor slug with themes and ordered chronology', async () => {
    const db = await seeded();
    const model = await yolReadModelByAnchorSlug(db, '1969');
    expect(model).toBeDefined();
    expect(model!.anchorSlug).toBe('1969');
    expect(model!.enteredYear).toBe(1969);
    expect(model!.title).toBe('1969');
    expect(model!.themes.map((t) => t.lensKey)).toEqual(['spaceflight', 'computing', 'signal', 'coldwar']);
    expect(model!.themes.every((t) => t.colorHex)).toBe(true);
    // chronology is ordered by displayOrder and spans context -> overview -> developments -> context -> closing
    const orders = model!.points.map((p) => p.displayOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(model!.points[0].role).toBe('context');
    expect(model!.points.at(-1)!.role).toBe('closing');
    const overviewIndex = model!.points.findIndex((p) => p.role === 'overview');
    expect(overviewIndex).toBe(2); // after 1967 + 1968 contexts
  });

  it('formats within-year dates BCE-safely without JS Date', async () => {
    const db = await seeded();
    const model = await yolReadModelByAnchorSlug(db, '1969');
    const apollo = model!.points.find((p) => p.entity?.slug === 'yolev-1969-apollo11');
    expect(apollo?.date?.display).toBe('July 20, 1969');
    const woodstock = model!.points.find((p) => p.entity?.slug === 'yolev-1969-woodstock');
    expect(woodstock?.date?.display).toBe('August 15–18, 1969');
    const m1769 = await yolReadModelByAnchorSlug(db, '1769');
    const watt = m1769!.points.find((p) => p.entity?.slug === 'yolev-1769-watt-condenser');
    expect(watt?.date?.display).toBe('January 1769');
    // pure formatter handles BCE years
    expect(formatYolDate({ year: -9999, precision: 'approximate' })).toBe('c. 10,000 BCE');
    expect(formatYolDate({ year: 0 })).toBe('1 BCE');
  });

  it('carries date precision and uncertainty flags', async () => {
    const db = await seeded();
    const yol = (await db.query.yolCompositions.findFirst({ where: eq(yolCompositions.anchorSlug, '1769') }))!;
    // mark one seeded period uncertain
    const p = (await db.query.periods.findFirst({ where: eq(periods.slug, 'evt-1769-water-frame') }))!;
    await db.update(periods).set({ isStartUncertain: true, precision: 'approximate' }).where(eq(periods.id, p.id));
    const model = await yolReadModelByAnchorSlug(db, '1769');
    const point = model!.points.find((x) => x.entity?.slug === 'yolev-1769-water-frame');
    expect(point?.date?.uncertain).toBe(true);
    expect(point?.date?.precision).toBe('approximate');
    expect(yol.anchorSlug).toBe('1769');
  });

  it('joins claims and sources with locators for point entities', async () => {
    const db = await seeded();
    const entity = (await db.query.entities.findFirst({ where: eq(entities.slug, 'yolev-1969-apollo11') }))!;
    const [claim] = await db
      .insert(claims)
      .values({
        text: 'Apollo 11 landed on the Moon on 20 July 1969.',
        subjectType: 'entity',
        subjectId: entity.id,
        confidence: 95,
        verificationStatus: 'verified',
        isSynthetic: false,
      })
      .returning();
    const [source] = await db
      .insert(sources)
      .values({ title: 'Test source record', type: 'book', publicationYear: 2000, isSynthetic: false })
      .returning();
    await db.insert(claimSources).values({ claimId: claim.id, sourceId: source.id, locator: 'p. 42' });

    const model = await yolReadModelByAnchorSlug(db, '1969');
    const apollo = model!.points.find((p) => p.entity?.slug === 'yolev-1969-apollo11');
    expect(apollo?.claims).toHaveLength(1);
    expect(apollo?.claims[0].verificationStatus).toBe('verified');
    expect(apollo?.claims[0].sources[0].title).toBe('Test source record');
    expect(apollo?.claims[0].sources[0].locator).toBe('p. 42');
  });

  it('reports placeholder provenance for the draft seed and reviewed after editorial promotion', async () => {
    const db = await seeded();
    let model = await yolReadModelByAnchorSlug(db, '1769');
    expect(model!.provenance).toBe('placeholder');
    expect(model!.points.every((p) => p.provenance === 'placeholder')).toBe(true);

    const yol = (await db.query.yolCompositions.findFirst({ where: eq(yolCompositions.anchorSlug, '1769') }))!;
    await db
      .update(yolCompositions)
      .set({ isPlaceholder: false, editorialStatus: 'verified' })
      .where(eq(yolCompositions.id, yol.id));
    model = await yolReadModelByAnchorSlug(db, '1769');
    expect(model!.provenance).toBe('reviewed');
  });

  it('excludes synthetic records at the query boundary', async () => {
    const db = await seeded();
    const yol = (await db.query.yolCompositions.findFirst({ where: eq(yolCompositions.anchorSlug, '1969') }))!;
    // inject a synthetic point into the real composition
    const [synthPeriod] = await db
      .insert(periods)
      .values({ slug: 'synth-period-x', label: 'SYNTH', precision: 'exact', startYear: 1969, endYear: 1969, displayYear: 1969, isSynthetic: true, isPlaceholder: true, editorialStatus: 'draft' })
      .returning();
    const [synthEntity] = await db
      .insert(entities)
      .values({ slug: 'synth-entity-x', kind: 'event', label: 'SYNTHETIC EVENT — must never render', isSynthetic: true, isPlaceholder: true, editorialStatus: 'draft' })
      .returning();
    await db.insert(yolTimelinePoints).values({
      yolId: yol.id,
      role: 'development',
      entityId: synthEntity.id,
      periodId: synthPeriod.id,
      displayOrder: 999_999,
      isSynthetic: true,
      isPlaceholder: true,
      editorialStatus: 'draft',
    });

    const model = await yolReadModelByAnchorSlug(db, '1969');
    expect(model!.points.some((p) => p.entity?.slug === 'synth-entity-x')).toBe(false);
    expect(JSON.stringify(model)).not.toContain('SYNTHETIC EVENT');
    // and an entirely synthetic composition is unreachable
    const [synthYol] = await db
      .insert(yolCompositions)
      .values({ periodId: synthPeriod.id, anchorSlug: 'synth-anchor', title: 'SYNTH', thesis: 'SYNTH', atmospherePreset: 'orbital', isSynthetic: true })
      .returning();
    expect(synthYol.anchorSlug).toBe('synth-anchor');
    expect(await yolReadModelByAnchorSlug(db, 'synth-anchor')).toBeUndefined();
  });

  it('reflects database edits without touching src/data/yol (DB is the source of truth)', async () => {
    const db = await seeded();
    const yol = (await db.query.yolCompositions.findFirst({ where: eq(yolCompositions.anchorSlug, '1769') }))!;
    await db.update(yolCompositions).set({ title: 'Seventeen Sixty-Nine (edited)' }).where(eq(yolCompositions.id, yol.id));
    // swap the ordering of the first two developments
    const points = await db.query.yolTimelinePoints.findMany({ where: eq(yolTimelinePoints.yolId, yol.id) });
    const devs = points.filter((p) => p.role === 'development').sort((a, b) => a.displayOrder - b.displayOrder);
    const [a, b] = devs;
    await db.update(yolTimelinePoints).set({ displayOrder: -777 }).where(eq(yolTimelinePoints.id, a.id));
    await db.update(yolTimelinePoints).set({ displayOrder: a.displayOrder }).where(eq(yolTimelinePoints.id, b.id));
    await db.update(yolTimelinePoints).set({ displayOrder: b.displayOrder }).where(eq(yolTimelinePoints.id, a.id));

    const model = await yolReadModelByAnchorSlug(db, '1769');
    expect(model!.title).toBe('Seventeen Sixty-Nine (edited)');
    const modelDevs = model!.points.filter((p) => p.role === 'development');
    expect(modelDevs[0].id).toBe(b.id);
    expect(modelDevs[1].id).toBe(a.id);
  });

  it('returns undefined for unknown anchors and empty databases', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    expect(await yolReadModelByAnchorSlug(db, '1969')).toBeUndefined();
  });
});
