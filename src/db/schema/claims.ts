/**
 * Atomic claims and their sources. A claim is one falsifiable statement
 * about an entity, relationship, or period. No fabricated citations —
 * source fixtures used by seed data must set `isSynthetic: true` and are
 * additionally prefixed `SYNTHETIC:` in title (see src/db/seed).
 */
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { claimSubjectTypeEnum, claimVerificationStatusEnum, newId, sourceTypeEnum } from './shared';
import { relationships } from './relationships';

export const claims = pgTable(
  'claims',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    text: text('text').notNull(),
    subjectType: claimSubjectTypeEnum('subject_type').notNull(),
    /** Polymorphic reference: id of an entities/relationships/periods row. */
    subjectId: text('subject_id').notNull(),
    confidence: integer('confidence').notNull().default(50),
    verificationStatus: claimVerificationStatusEnum('verification_status')
      .notNull()
      .default('unverified'),
    disputed: boolean('disputed').notNull().default(false),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('claims_subject_idx').on(t.subjectType, t.subjectId),
    check('claims_confidence_range', sql`${t.confidence} >= 0 AND ${t.confidence} <= 100`),
    check('claims_text_not_empty', sql`length(${t.text}) > 0`),
  ],
);

export const sources = pgTable(
  'sources',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    title: text('title').notNull(),
    type: sourceTypeEnum('type').notNull(),
    /** Approximate/exact publication year; kept as a plain integer, not Date. */
    publicationYear: integer('publication_year'),
    url: text('url'),
    identifier: text('identifier'),
    notes: text('notes'),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sources_type_idx').on(t.type),
    check('sources_title_not_empty', sql`length(${t.title}) > 0`),
  ],
);

/** Join table: claim <-> source, with quotation/locator (page/section). */
export const claimSources = pgTable(
  'claim_sources',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    claimId: text('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    quotation: text('quotation'),
    locator: text('locator'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('claim_sources_unique').on(t.claimId, t.sourceId, t.locator),
    index('claim_sources_claim_idx').on(t.claimId),
    index('claim_sources_source_idx').on(t.sourceId),
  ],
);

/** Join table: which claims support a given relationship. Lives here (not
 * relationships.ts) so the import direction is one-way (claims -> relationships)
 * and there's no circular module dependency. */
export const relationshipClaims = pgTable(
  'relationship_claims',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    relationshipId: text('relationship_id')
      .notNull()
      .references(() => relationships.id, { onDelete: 'cascade' }),
    claimId: text('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('relationship_claims_unique').on(t.relationshipId, t.claimId),
    index('relationship_claims_relationship_idx').on(t.relationshipId),
    index('relationship_claims_claim_idx').on(t.claimId),
  ],
);

export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type ClaimSource = typeof claimSources.$inferSelect;
export type RelationshipClaim = typeof relationshipClaims.$inferSelect;
