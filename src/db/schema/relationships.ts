/**
 * Directed relationships between entities. Not a strict tree: cycles are
 * allowed at the data level (e.g. mutual `influenced` over time is
 * legitimate history). The traversal layer (src/db/queries) is
 * cycle-SAFE (visited-set, max depth) rather than cycle-FREE.
 *
 * Decisions (see docs/database/data-integrity-rules.md):
 * - Self-relationships (source === target) are FORBIDDEN (CHECK constraint).
 *   None of the 13 relationship types express a meaningful self-reference.
 * - Duplicate edges are prevented at the DB level via a unique constraint
 *   on (source, target, type) — addRelationship() in the repository layer
 *   also checks against this so callers get a clear "already exists"
 *   result instead of a thrown constraint error where reasonable.
 * - `influenced` is explicitly NOT `caused` — no causal claim is implied.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { editorialStatusEnum, newId, relationshipTypeEnum } from './shared';
import { entities } from './entities';
import { periods } from './periods';

export const relationships = pgTable(
  'relationships',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    sourceEntityId: text('source_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    targetEntityId: text('target_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    type: relationshipTypeEnum('type').notNull(),
    explanation: text('explanation'),
    strength: integer('strength').notNull().default(50),
    confidence: integer('confidence').notNull().default(50),
    disputed: boolean('disputed').notNull().default(false),
    validPeriodId: text('valid_period_id').references(() => periods.id, {
      onDelete: 'set null',
    }),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    editorialStatus: editorialStatusEnum('editorial_status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('relationships_source_idx').on(t.sourceEntityId),
    index('relationships_target_idx').on(t.targetEntityId),
    index('relationships_type_idx').on(t.type),
    index('relationships_source_type_idx').on(t.sourceEntityId, t.type),
    index('relationships_target_type_idx').on(t.targetEntityId, t.type),
    unique('relationships_source_target_type_unique').on(t.sourceEntityId, t.targetEntityId, t.type),
    check('relationships_no_self_link', sql`${t.sourceEntityId} <> ${t.targetEntityId}`),
    check('relationships_strength_range', sql`${t.strength} >= 0 AND ${t.strength} <= 100`),
    check('relationships_confidence_range', sql`${t.confidence} >= 0 AND ${t.confidence} <= 100`),
  ],
);

export type Relationship = typeof relationships.$inferSelect;
export type NewRelationship = typeof relationships.$inferInsert;
// relationshipClaims (join to claims) lives in claims.ts to avoid a
// circular import between relationships.ts and claims.ts.
