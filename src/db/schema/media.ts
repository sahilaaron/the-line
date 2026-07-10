/**
 * Media references — structural only, no downloads/binaries. Only
 * synthetic fixture media may claim any licence (enforced by convention +
 * covered in validation/audit, not a DB-level constraint since "synthetic"
 * status is app-asserted).
 */
import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { mediaRightsStatusEnum, mediaSubjectTypeEnum, mediaTypeEnum, newId } from './shared';

export const media = pgTable(
  'media',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    title: text('title').notNull(),
    mediaType: mediaTypeEnum('media_type').notNull(),
    creator: text('creator'),
    sourceOrganisation: text('source_organisation'),
    sourceUrl: text('source_url'),
    licence: text('licence'),
    isPublicDomain: boolean('is_public_domain').notNull().default(false),
    attributionText: text('attribution_text'),
    rightsStatus: mediaRightsStatusEnum('rights_status').notNull().default('unknown'),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('media_type_idx').on(t.mediaType),
    check('media_title_not_empty', sql`length(${t.title}) > 0`),
  ],
);

/** Polymorphic association: media <-> entity/period/yol composition. */
export const mediaAssociations = pgTable(
  'media_associations',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    subjectType: mediaSubjectTypeEnum('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('media_associations_subject_idx').on(t.subjectType, t.subjectId),
    index('media_associations_media_idx').on(t.mediaId),
  ],
);

export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type MediaAssociation = typeof mediaAssociations.$inferSelect;
