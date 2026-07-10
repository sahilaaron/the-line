import { describe, expect, it, afterEach } from 'vitest';
import { freshMigratedDb } from '../testing/setup';
import { archiveEntity, createEntity, findEntityById, findEntityBySlug, listEntitiesByKind, searchEntitiesByLabel } from './entities';

describe('entities repository', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('creates, finds by id and slug, lists by kind, searches by label, archives', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();

    const created = await createEntity(db, { slug: 'steam-engine', kind: 'invention', label: 'Steam Engine' });
    expect(created.id).toBeTruthy();

    const byId = await findEntityById(db, created.id);
    expect(byId?.slug).toBe('steam-engine');

    const bySlug = await findEntityBySlug(db, 'steam-engine');
    expect(bySlug?.id).toBe(created.id);

    const byKind = await listEntitiesByKind(db, 'invention');
    expect(byKind.map((e) => e.id)).toContain(created.id);

    const search = await searchEntitiesByLabel(db, 'steam');
    expect(search.map((e) => e.id)).toContain(created.id);

    const archived = await archiveEntity(db, created.id);
    expect(archived?.editorialStatus).toBe('archived');
  });

  it('enforces unique slugs', async () => {
    const { db, pg } = await freshMigratedDb();
    cleanup = () => pg.close();
    await createEntity(db, { slug: 'dup', kind: 'concept', label: 'A' });
    await expect(createEntity(db, { slug: 'dup', kind: 'concept', label: 'B' })).rejects.toThrow();
  });
});
