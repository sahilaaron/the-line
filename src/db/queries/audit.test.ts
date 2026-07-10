import { describe, expect, it, afterEach } from 'vitest';
import { freshMigratedDb } from '../testing/setup';
import { createEntity } from '../repositories/entities';
import { addRelationship } from '../repositories/relationships';
import { runIntegrityAudit } from './audit';
import { claims, media, yolCompositions } from '../schema';
import { createPeriod } from '../repositories/periods';

describe('integrity audit', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('reports zero errors on a clean, empty database', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const report = await runIntegrityAudit(db);
    expect(report.errors).toHaveLength(0);
  });

  it('catches a claim missing a required source', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    await db.insert(claims).values({
      text: 'a verified claim with no source',
      subjectType: 'entity',
      subjectId: a.id,
      verificationStatus: 'verified',
    });
    const report = await runIntegrityAudit(db);
    expect(report.errors.some((e) => e.code === 'claim_missing_required_source')).toBe(true);
  });

  it('catches an orphaned claim subject', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await db.insert(claims).values({
      text: 'orphaned',
      subjectType: 'entity',
      subjectId: 'does-not-exist',
    });
    const report = await runIntegrityAudit(db);
    expect(report.errors.some((e) => e.code === 'orphaned_claim_subject')).toBe(true);
  });

  it('catches media marked public domain without a clear rights status', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await db.insert(media).values({ title: 'x', mediaType: 'image', isPublicDomain: true, rightsStatus: 'unknown' });
    const report = await runIntegrityAudit(db);
    expect(report.errors.some((e) => e.code === 'media_publishable_without_rights_status')).toBe(true);
  });

  it('catches a published YoL composition with no themes', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const period = await createPeriod(db, { label: 'x', precision: 'exact', startYear: 2000, endYear: 2000 });
    await db.insert(yolCompositions).values({
      periodId: period.id,
      title: 'x',
      thesis: 'x',
      atmospherePreset: 'network',
      editorialStatus: 'published',
    });
    const report = await runIntegrityAudit(db);
    expect(report.errors.some((e) => e.code === 'published_yol_missing_themes')).toBe(true);
  });

  it('flags dense nodes as warnings, not errors', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const hub = await createEntity(db, { slug: 'hub', kind: 'concept', label: 'Hub' });
    for (let i = 0; i < 5; i++) {
      const leaf = await createEntity(db, { slug: `leaf-${i}`, kind: 'concept', label: `Leaf ${i}` });
      await addRelationship(db, { sourceEntityId: hub.id, targetEntityId: leaf.id, type: 'associated_with' });
    }
    const report = await runIntegrityAudit(db);
    // 5 edges is nowhere near DENSE_NODE_THRESHOLD (200) — sanity check that
    // a modest hub does NOT trip the dense-node warning.
    expect(report.warnings.some((w) => w.code === 'dense_node')).toBe(false);
  });

  it('detects an unexpected cycle in an expected-acyclic relationship type (part_of)', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    const b = await createEntity(db, { slug: 'b', kind: 'concept', label: 'B' });
    const c = await createEntity(db, { slug: 'c', kind: 'concept', label: 'C' });
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, type: 'part_of' });
    await addRelationship(db, { sourceEntityId: b.id, targetEntityId: c.id, type: 'part_of' });
    await addRelationship(db, { sourceEntityId: c.id, targetEntityId: a.id, type: 'part_of' });
    const report = await runIntegrityAudit(db);
    expect(report.errors.some((e) => e.code === 'unexpected_cycle')).toBe(true);
  });

  it('does NOT flag a mutual `influenced` cycle as an error (allowed cycle type)', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    const b = await createEntity(db, { slug: 'b', kind: 'concept', label: 'B' });
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, type: 'influenced' });
    await addRelationship(db, { sourceEntityId: b.id, targetEntityId: a.id, type: 'influenced' });
    const report = await runIntegrityAudit(db);
    expect(report.errors.some((e) => e.code === 'unexpected_cycle')).toBe(false);
  });
});
