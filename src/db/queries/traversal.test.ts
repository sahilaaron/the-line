import { describe, expect, it, afterEach } from 'vitest';
import { freshMigratedDb } from '../testing/setup';
import { createEntity } from '../repositories/entities';
import { addRelationship } from '../repositories/relationships';
import { ancestry, consequences, neighbourhood, shortestConnection } from './traversal';

describe('traversal', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  async function buildCycleFixture() {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    const b = await createEntity(db, { slug: 'b', kind: 'concept', label: 'B' });
    const c = await createEntity(db, { slug: 'c', kind: 'concept', label: 'C' });
    // A -> B -> C -> A (a cycle)
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, type: 'influenced' });
    await addRelationship(db, { sourceEntityId: b.id, targetEntityId: c.id, type: 'influenced' });
    await addRelationship(db, { sourceEntityId: c.id, targetEntityId: a.id, type: 'influenced' });
    return { db, a, b, c };
  }

  it('terminates on a cyclic graph and returns each entity once', async () => {
    const { db, a, b, c } = await buildCycleFixture();
    const result = await consequences(db, a.id, { maxDepth: 10 });
    // Only 2 other nodes exist (b, c); despite maxDepth 10 the cycle guard
    // must prevent infinite walking and must not revisit `a` itself.
    const ids = result.map((r) => r.entityId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(a.id);
    expect(ids.sort()).toEqual([b.id, c.id].sort());
  });

  it('respects maxDepth', async () => {
    const { db, a } = await buildCycleFixture();
    const shallow = await consequences(db, a.id, { maxDepth: 1 });
    expect(shallow.every((r) => r.depth <= 1)).toBe(true);
    expect(shallow).toHaveLength(1); // only B at depth 1
  });

  it('ancestry walks backward', async () => {
    const { db, a, c } = await buildCycleFixture();
    const result = await ancestry(db, a.id, { maxDepth: 1 });
    expect(result.map((r) => r.entityId)).toContain(c.id);
  });

  it('filters by minimum confidence', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    const b = await createEntity(db, { slug: 'b', kind: 'concept', label: 'B' });
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, type: 'influenced', confidence: 10 });
    const strict = await consequences(db, a.id, { minConfidence: 50 });
    expect(strict).toHaveLength(0);
    const loose = await consequences(db, a.id, { minConfidence: 5 });
    expect(loose).toHaveLength(1);
  });

  it('filters by relationship type', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    const b = await createEntity(db, { slug: 'b', kind: 'concept', label: 'B' });
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, type: 'opposed' });
    const filtered = await consequences(db, a.id, { relationshipTypes: ['influenced'] });
    expect(filtered).toHaveLength(0);
  });

  it('neighbourhood includes both directions', async () => {
    const { db, a, b, c } = await buildCycleFixture();
    const result = await neighbourhood(db, a.id, { maxDepth: 1 });
    const ids = result.map((r) => r.entityId).sort();
    expect(ids).toEqual([b.id, c.id].sort());
  });

  it('shortestConnection finds the direct path and carries path info', async () => {
    const { db, a, b } = await buildCycleFixture();
    const result = await shortestConnection(db, a.id, b.id);
    expect(result?.depth).toBe(1);
    expect(result?.path).toHaveLength(1);
    expect(result?.path[0].relationship.sourceEntityId).toBe(a.id);
  });

  it('shortestConnection returns null when unreachable within maxDepth', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    const isolated = await createEntity(db, { slug: 'isolated', kind: 'concept', label: 'Isolated' });
    const result = await shortestConnection(db, a.id, isolated.id, { maxDepth: 2 });
    expect(result).toBeNull();
  });
});
