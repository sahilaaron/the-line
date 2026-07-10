import { describe, expect, it, afterEach } from 'vitest';
import { freshMigratedDb } from '../testing/setup';
import { createEntity } from './entities';
import { addRelationship, findDirectConnections, listByType, listIncoming, listOutgoing } from './relationships';

describe('relationships repository', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('addRelationship is safe against duplicates (returns created: false on repeat)', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();

    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    const b = await createEntity(db, { slug: 'b', kind: 'concept', label: 'B' });

    const first = await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, type: 'influenced' });
    expect(first.created).toBe(true);

    const second = await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, type: 'influenced' });
    expect(second.created).toBe(false);
    expect(second.relationship.id).toBe(first.relationship.id);

    const outgoing = await listOutgoing(db, a.id);
    expect(outgoing).toHaveLength(1);
  });

  it('rejects self-relationships at the DB level (CHECK constraint)', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    await expect(
      addRelationship(db, { sourceEntityId: a.id, targetEntityId: a.id, type: 'influenced' }),
    ).rejects.toThrow();
  });

  it('rejects relationships to a missing entity (FK enforcement)', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    await expect(
      addRelationship(db, { sourceEntityId: a.id, targetEntityId: 'does-not-exist', type: 'influenced' }),
    ).rejects.toThrow();
  });

  it('supports the same pair with two different relationship types', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    const b = await createEntity(db, { slug: 'b', kind: 'concept', label: 'B' });
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, type: 'influenced' });
    await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, type: 'enabled' });
    const byType = await listByType(db, 'enabled');
    expect(byType).toHaveLength(1);
    const connections = await findDirectConnections(db, a.id);
    expect(connections).toHaveLength(2);
  });

  it('allows a mutual-influence cycle (A influences B, B influences A)', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    const a = await createEntity(db, { slug: 'a', kind: 'concept', label: 'A' });
    const b = await createEntity(db, { slug: 'b', kind: 'concept', label: 'B' });
    const ab = await addRelationship(db, { sourceEntityId: a.id, targetEntityId: b.id, type: 'influenced' });
    const ba = await addRelationship(db, { sourceEntityId: b.id, targetEntityId: a.id, type: 'influenced' });
    expect(ab.created).toBe(true);
    expect(ba.created).toBe(true);
    const incomingA = await listIncoming(db, a.id);
    expect(incomingA).toHaveLength(1);
  });
});
