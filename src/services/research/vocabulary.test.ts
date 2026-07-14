/** Cycle 8B — relationship vocabulary v1 tests. */
import { describe, it, expect } from 'vitest';
import { freshMigratedDb } from '../../db/testing/setup';
import { relationshipTypeRegistry } from '../../db/schema';
import { seedRelationshipVocabularyV1, listRelationshipTypes } from '../../db/repositories/graph-ext';
import { BUILTIN_RELATIONSHIP_KEYS, V1_ADDITION_KEYS } from '../../db/seed/relationship-vocabulary';
import { validateRelationshipEndpoints, compatibleRelationshipTypes, getRelationshipVocabulary } from './vocabulary';

describe('relationship vocabulary v1', () => {
  it('preserves the 13 built-in types after migration', async () => {
    const { db } = await freshMigratedDb();
    const rows = await db.select().from(relationshipTypeRegistry);
    const keys = new Set(rows.map((r) => r.key));
    for (const k of BUILTIN_RELATIONSHIP_KEYS) expect(keys.has(k)).toBe(true);
    expect(rows.filter((r) => r.isBuiltin).length).toBe(13);
  });

  it('migration seeds all v1 additions; re-seeding is idempotent (inserts 0)', async () => {
    const { db } = await freshMigratedDb();
    const rows = await db.select().from(relationshipTypeRegistry);
    const keys = new Set(rows.map((r) => r.key));
    for (const k of V1_ADDITION_KEYS) expect(keys.has(k)).toBe(true);
    // migration already seeded them → helper inserts nothing
    expect(await seedRelationshipVocabularyV1(db)).toBe(0);
    expect(await seedRelationshipVocabularyV1(db)).toBe(0);
    expect((await db.select().from(relationshipTypeRegistry)).length).toBe(rows.length);
  });

  it('enforces allowed endpoint kinds', async () => {
    const { db } = await freshMigratedDb();
    // invented_by: source invention/technology/product, target person/organisation
    expect((await validateRelationshipEndpoints(db, 'invented_by', 'invention', 'person')).ok).toBe(true);
    expect((await validateRelationshipEndpoints(db, 'invented_by', 'person', 'person')).ok).toBe(false);
    expect((await validateRelationshipEndpoints(db, 'invented_by', 'invention', 'invention')).ok).toBe(false);
    // unregistered type
    expect((await validateRelationshipEndpoints(db, 'no_such', 'person', 'person')).ok).toBe(false);
  });

  it('symmetric types accept either endpoint ordering', async () => {
    const { db } = await freshMigratedDb();
    // collaborated_with: person/organisation both sides, symmetric
    expect((await validateRelationshipEndpoints(db, 'collaborated_with', 'person', 'organisation')).ok).toBe(true);
    expect((await validateRelationshipEndpoints(db, 'collaborated_with', 'organisation', 'person')).ok).toBe(true);
  });

  it('flags associated_with as provisional + symmetric fallback', async () => {
    const { db } = await freshMigratedDb();
    const [aw] = (await listRelationshipTypes(db)).filter((t) => t.key === 'associated_with');
    expect(aw.isProvisional).toBe(true);
    expect(aw.directionality).toBe('symmetric');
    expect(aw.category).toBe('fallback');
  });

  it('offers only compatible active types for an endpoint pair', async () => {
    const { db } = await freshMigratedDb();
    const forInventionPerson = await compatibleRelationshipTypes(db, 'invention', 'person');
    const keys = forInventionPerson.map((t) => t.key);
    expect(keys).toContain('invented_by');
    expect(keys).not.toContain('founded_by'); // founded_by target is person but source must be org/movement/civilisation
    // vocab page returns everything, category-sorted
    const vocab = await getRelationshipVocabulary(db);
    expect(vocab.length).toBeGreaterThanOrEqual(13 + V1_ADDITION_KEYS.length);
  });
});
