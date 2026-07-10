import { describe, expect, it, afterEach } from 'vitest';
import { freshMigratedDb } from '../testing/setup';
import { seedSynthetic } from './synthetic';

// Small targets for test speed; the real db:seed:synthetic script uses the
// full SYNTHETIC_TARGETS. Determinism is what's under test here, not scale.
const SMALL_TARGETS = {
  entities: 60,
  periods: 40,
  relationships: 100,
  claims: 30,
  sources: 20,
  yolCompositions: 5,
} as const;

describe('synthetic seed', () => {
  let cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    await Promise.all(cleanups.map((c) => c()));
    cleanups = [];
  });

  it('marks every row as synthetic and covers all entity kinds', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanups.push(() => pg.close());
    await seedSynthetic(db, 42, SMALL_TARGETS);

    const entities = await db.query.entities.findMany();
    expect(entities.every((e) => e.isSynthetic)).toBe(true);
    const kinds = new Set(entities.map((e) => e.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(9);

    const relationships = await db.query.relationships.findMany();
    expect(relationships.every((r) => r.isSynthetic)).toBe(true);
    expect(relationships.some((r) => r.disputed)).toBe(true);

    const periods = await db.query.periods.findMany();
    expect(periods.some((p) => (p.startYear ?? 0) < 0)).toBe(true); // BCE present
    expect(periods.some((p) => (p.startYear ?? -1) >= 0)).toBe(true); // CE present

    const sources = await db.query.sources.findMany();
    expect(sources.every((s) => s.title.startsWith('SYNTHETIC:'))).toBe(true);
  });

  it('injects at least one legitimate mutual-influence cycle', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanups.push(() => pg.close());
    const summary = await seedSynthetic(db, 42, SMALL_TARGETS);
    expect(summary.mutualInfluenceCyclesInjected).toBeGreaterThan(0);
  });

  it('is deterministic — same seed produces the same sampled record set', async () => {
    const { db: db1, pg: pg1 } = await freshMigratedDb();
    cleanups.push(() => pg1.close());
    await seedSynthetic(db1, 7, SMALL_TARGETS);
    const entities1 = (await db1.query.entities.findMany()).map((e) => `${e.slug}:${e.kind}:${e.label}`).sort();

    const { db: db2, pg: pg2 } = await freshMigratedDb();
    cleanups.push(() => pg2.close());
    await seedSynthetic(db2, 7, SMALL_TARGETS);
    const entities2 = (await db2.query.entities.findMany()).map((e) => `${e.slug}:${e.kind}:${e.label}`).sort();

    expect(entities1).toEqual(entities2);

    const periods1 = (await db1.query.periods.findMany()).map((p) => `${p.slug}:${p.startYear}:${p.endYear}`).sort();
    const periods2 = (await db2.query.periods.findMany()).map((p) => `${p.slug}:${p.startYear}:${p.endYear}`).sort();
    expect(periods1).toEqual(periods2);
  });

  it('is idempotent — re-running with the same seed does not duplicate rows', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanups.push(() => pg.close());
    await seedSynthetic(db, 99, SMALL_TARGETS);
    const countAfterFirst = (await db.query.entities.findMany()).length;
    await seedSynthetic(db, 99, SMALL_TARGETS);
    const countAfterSecond = (await db.query.entities.findMany()).length;
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});
