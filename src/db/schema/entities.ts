/**
 * Central entity table. Holds only genuinely shared columns (slug, kind,
 * label, summary, editorial/placeholder/synthetic flags, timestamps,
 * optional primary period). Kind-specific fields live in normalized
 * per-kind subtype tables in entity-subtypes.ts — never dumped into a JSON
 * blob here, so each kind's fields stay typed and queryable.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { editorialStatusEnum, entityGraphStatusEnum, entityKindEnum, newId } from './shared';
import { periods } from './periods';

export const entities = pgTable(
  'entities',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    slug: text('slug').notNull().unique(),
    kind: entityKindEnum('kind').notNull(),
    label: text('label').notNull(),
    summary: text('summary'),
    primaryPeriodId: text('primary_period_id').references(() => periods.id, {
      onDelete: 'set null',
    }),
    isPlaceholder: boolean('is_placeholder').notNull().default(true),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    editorialStatus: editorialStatusEnum('editorial_status').notNull().default('draft'),
    /* --- Cycle 8A knowledge-graph metadata (NOT historical truth) --- */
    /** Durable research-completeness/freshness state. Existing rows default
     * to canonical_incomplete: accepted content of unknown depth, never
     * silently treated as "sufficiently complete". */
    graphStatus: entityGraphStatusEnum('graph_status').notNull().default('canonical_incomplete'),
    freshnessCheckedAt: timestamp('freshness_checked_at', { withTimezone: true }),
    /** Superseded/merged pointers (self-refs) — never a silent delete. */
    supersededById: text('superseded_by_id').references((): AnyPgColumn => entities.id, {
      onDelete: 'set null',
    }),
    mergedIntoId: text('merged_into_id').references((): AnyPgColumn => entities.id, {
      onDelete: 'set null',
    }),
    revision: integer('revision').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('entities_kind_slug_idx').on(t.kind, t.slug),
    index('entities_label_idx').on(t.label),
    index('entities_primary_period_idx').on(t.primaryPeriodId),
    index('entities_graph_status_idx').on(t.graphStatus),
    check('entities_slug_not_empty', sql`length(${t.slug}) > 0`),
    check('entities_revision_positive', sql`${t.revision} >= 1`),
  ],
);

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
