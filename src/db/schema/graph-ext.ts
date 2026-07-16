/**
 * Cycle 8A — canonical graph EXTENSIONS. These evolve the base 24-table
 * foundation (they do not replace it): richer entity identity, a scalable
 * relationship-type registry, and typed multi-role time associations.
 *
 * Separation is strict: everything here is PRIVATE canonical knowledge or
 * its controlled vocabulary. Not public/editorial curation (yol_*), not
 * research staging (schema/research.ts).
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import {
  entityAliasTypeEnum,
  externalIdSchemeEnum,
  newId,
  relationshipDirectionalityEnum,
  timeAssociationRoleEnum,
} from './shared';
import { entities } from './entities';
import { periods } from './periods';

/** Aliases, historical names, spellings, abbreviations, translations. The
 * resolver matches against `normalized` as well as the canonical label. */
export const entityAliases = pgTable(
  'entity_aliases',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    alias: text('alias').notNull(),
    /** Lowercased, whitespace-collapsed form used for matching. */
    normalized: text('normalized').notNull(),
    aliasType: entityAliasTypeEnum('alias_type').notNull().default('alias'),
    lang: text('lang'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('entity_aliases_entity_idx').on(t.entityId),
    index('entity_aliases_normalized_idx').on(t.normalized),
    unique('entity_aliases_unique').on(t.entityId, t.normalized, t.aliasType),
    check('entity_aliases_alias_not_empty', sql`length(${t.alias}) > 0`),
  ],
);

/** External authority identifiers. A shared external id is the strongest,
 * non-fuzzy identity signal in the promotion resolver. */
export const entityExternalIds = pgTable(
  'entity_external_ids',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    scheme: externalIdSchemeEnum('scheme').notNull(),
    value: text('value').notNull(),
    url: text('url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('entity_external_ids_entity_idx').on(t.entityId),
    unique('entity_external_ids_scheme_value_unique').on(t.scheme, t.value),
    check('entity_external_ids_value_not_empty', sql`length(${t.value}) > 0`),
  ],
);

/**
 * Controlled additional classifications. `entities.kind` stays the small,
 * renderer-facing enum; this carries the richer scalable vocabulary that
 * resolves the kind drift (discovery, idea->concept, document, work, law,
 * treaty, technology, movement, ...) WITHOUT multiplying the renderer enum
 * or requiring a code migration per value.
 */
export const entityClassifications = pgTable(
  'entity_classifications',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    classification: text('classification').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('entity_classifications_entity_idx').on(t.entityId),
    index('entity_classifications_value_idx').on(t.classification),
    unique('entity_classifications_unique').on(t.entityId, t.classification),
  ],
);

/**
 * Typed entity-period associations. An entity may hold MANY roles (conceived,
 * patented, demonstrated, commercialised, adopted, declined, replaced...).
 * Keeps entities.primaryPeriodId for renderer compatibility. Evidence attaches
 * via claims (subject_type = 'time_association').
 */
export const entityTimeAssociations = pgTable(
  'entity_time_associations',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    periodId: text('period_id')
      .notNull()
      .references(() => periods.id, { onDelete: 'restrict' }),
    role: timeAssociationRoleEnum('role').notNull().default('existence'),
    confidence: integer('confidence').notNull().default(50),
    isPrimary: boolean('is_primary').notNull().default(false),
    note: text('note'),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('entity_time_assoc_entity_idx').on(t.entityId),
    index('entity_time_assoc_period_idx').on(t.periodId),
    index('entity_time_assoc_role_idx').on(t.role),
    unique('entity_time_assoc_unique').on(t.entityId, t.periodId, t.role),
    check(
      'entity_time_assoc_confidence_range',
      sql`${t.confidence} >= 0 AND ${t.confidence} <= 100`,
    ),
  ],
);

/**
 * Controlled relationship-type registry — grows without a code migration per
 * new historical relationship. `relationships.typeKey` references `key`.
 * Carries inverse wording, directionality/symmetry, allowed source/target
 * kinds and cycle policy. Seeded in migration 0002 with the 13 builtin types.
 */
export const relationshipTypeRegistry = pgTable(
  'relationship_type_registry',
  {
    key: text('key').primaryKey(),
    label: text('label').notNull(),
    inverseLabel: text('inverse_label').notNull(),
    directionality: relationshipDirectionalityEnum('directionality').notNull().default('directed'),
    category: text('category').notNull().default('general'),
    isAcyclic: boolean('is_acyclic').notNull().default(false),
    allowedSourceKinds: jsonb('allowed_source_kinds').$type<string[]>(),
    allowedTargetKinds: jsonb('allowed_target_kinds').$type<string[]>(),
    isBuiltin: boolean('is_builtin').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    /** Cycle 8B: imprecise/provisional type (e.g. associated_with) — flagged
     * in the UI as requiring later refinement. */
    isProvisional: boolean('is_provisional').notNull().default(false),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('rel_type_registry_category_idx').on(t.category),
    check('rel_type_registry_key_format', sql`${t.key} ~ '^[a-z][a-z0-9_]*$'`),
  ],
);

export type EntityAlias = typeof entityAliases.$inferSelect;
export type NewEntityAlias = typeof entityAliases.$inferInsert;
export type EntityExternalId = typeof entityExternalIds.$inferSelect;
export type NewEntityExternalId = typeof entityExternalIds.$inferInsert;
export type EntityClassification = typeof entityClassifications.$inferSelect;
export type NewEntityClassification = typeof entityClassifications.$inferInsert;
export type EntityTimeAssociation = typeof entityTimeAssociations.$inferSelect;
export type NewEntityTimeAssociation = typeof entityTimeAssociations.$inferInsert;
export type RelationshipTypeRegistryRow = typeof relationshipTypeRegistry.$inferSelect;
export type NewRelationshipTypeRegistryRow = typeof relationshipTypeRegistry.$inferInsert;
