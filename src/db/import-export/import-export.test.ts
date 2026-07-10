import { describe, expect, it, afterEach } from 'vitest';
import { freshMigratedDb } from '../testing/setup';
import { seedPrototype } from '../seed/prototype';
import { exportDatabase, exportYolClosure } from './export';
import { importFixture } from './import';
import { findYolByAnchorSlug } from '../repositories/yol';
import { EXPORT_FORMAT_VERSION } from './types';

describe('export/import', () => {
  let cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    await Promise.all(cleanups.map((c) => c()));
    cleanups = [];
  });

  it('exportDatabase produces a versioned payload with all rows', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanups.push(() => pg.close());
    await seedPrototype(db);
    const payload = await exportDatabase(db);
    expect(payload.formatVersion).toBe(EXPORT_FORMAT_VERSION);
    expect(payload.data.periods).toHaveLength(5);
  });

  it('export -> import into a fresh DB round-trips row counts', async () => {
    const { db: sourceDb, pg: sourcePg } = await freshMigratedDb();
    cleanups.push(() => sourcePg.close());
    await seedPrototype(sourceDb);
    const payload = await exportDatabase(sourceDb);

    const { db: targetDb, pg: targetPg } = await freshMigratedDb();
    cleanups.push(() => targetPg.close());
    const summary = await importFixture(targetDb, payload);
    expect(summary.ok).toBe(true);

    const targetPeriods = await targetDb.query.periods.findMany();
    expect(targetPeriods).toHaveLength(payload.data.periods.length);
    const targetEntities = await targetDb.query.entities.findMany();
    expect(targetEntities).toHaveLength(payload.data.entities.length);
  });

  it('dry-run import validates without writing anything', async () => {
    const { db: sourceDb, pg: sourcePg } = await freshMigratedDb();
    cleanups.push(() => sourcePg.close());
    await seedPrototype(sourceDb);
    const payload = await exportDatabase(sourceDb);

    const { db: targetDb, pg: targetPg } = await freshMigratedDb();
    cleanups.push(() => targetPg.close());
    const summary = await importFixture(targetDb, payload, { dryRun: true });
    expect(summary.ok).toBe(true);
    expect(summary.dryRun).toBe(true);

    const targetPeriods = await targetDb.query.periods.findMany();
    expect(targetPeriods).toHaveLength(0); // nothing actually written
  });

  it('rolls back the whole import on bad data (FK violation) — no partial corruption', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanups.push(() => pg.close());

    const badPayload = {
      formatVersion: EXPORT_FORMAT_VERSION as typeof EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        periods: [],
        entities: [{ id: 'e1', slug: 'e1', kind: 'concept', label: 'E1' } as never],
        entityPersonDetails: [],
        entityInventionDetails: [],
        entityEventDetails: [],
        entityThemeDetails: [],
        entityPlaceDetails: [],
        entityOrganisationDetails: [],
        entityCivilisationDetails: [],
        entityConceptDetails: [],
        entityPeriodDetails: [],
        // References a nonexistent entity -> FK violation -> whole transaction rolls back.
        relationships: [
          { id: 'r1', sourceEntityId: 'e1', targetEntityId: 'does-not-exist', type: 'influenced' } as never,
        ],
        claims: [],
        sources: [],
        claimSources: [],
        relationshipClaims: [],
        yolCompositions: [],
        yolThemes: [],
        yolSceneHints: [],
        yolFeaturedEntities: [],
      yolTimelinePoints: [],
      yolPointThemes: [],
        media: [],
        mediaAssociations: [],
      },
    };

    const summary = await importFixture(db, badPayload);
    expect(summary.ok).toBe(false);

    // Nothing should have been committed, including the entity that would
    // otherwise have inserted cleanly.
    const entities = await db.query.entities.findMany();
    expect(entities).toHaveLength(0);
  });

  it('exportYolClosure exports just one composition and its dependency closure', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanups.push(() => pg.close());
    await seedPrototype(db);
    const yol = await findYolByAnchorSlug(db, '1969');
    const closure = await exportYolClosure(db, yol!.id);
    expect(closure.data.yolCompositions).toHaveLength(1);
    expect(closure.data.periods).toHaveLength(1);
    expect(closure.data.periods[0].slug).toBe('1969');
  });

  it('rejects an unsupported formatVersion', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanups.push(() => pg.close());
    const summary = await importFixture(db, {
      formatVersion: 999 as never,
      exportedAt: new Date().toISOString(),
      data: {
        periods: [],
        entities: [],
        entityPersonDetails: [],
        entityInventionDetails: [],
        entityEventDetails: [],
        entityThemeDetails: [],
        entityPlaceDetails: [],
        entityOrganisationDetails: [],
        entityCivilisationDetails: [],
        entityConceptDetails: [],
        entityPeriodDetails: [],
        relationships: [],
        claims: [],
        sources: [],
        claimSources: [],
        relationshipClaims: [],
        yolCompositions: [],
        yolThemes: [],
        yolSceneHints: [],
        yolFeaturedEntities: [],
      yolTimelinePoints: [],
      yolPointThemes: [],
        media: [],
        mediaAssociations: [],
      },
    });
    expect(summary.ok).toBe(false);
  });
});
