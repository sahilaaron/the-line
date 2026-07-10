/**
 * Time periods: the machine-readable temporal backbone. Historical years
 * are signed integers using astronomical year numbering (1 BCE = year 0,
 * 10,000 BCE = -9999), matching `src/data/anchors.ts`'s existing
 * `Anchor.year` convention. We deliberately never use JS `Date` for
 * historical years — `Date` cannot represent BCE or very large ranges and
 * would silently corrupt precision.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { editorialStatusEnum, newId, timePrecisionEnum } from './shared';

export const periods = pgTable(
  'periods',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    slug: text('slug').unique(),
    label: text('label').notNull(),
    precision: timePrecisionEnum('precision').notNull().default('unknown'),
    /** Astronomical-year integers. Null when unknown/open-ended. */
    startYear: integer('start_year'),
    endYear: integer('end_year'),
    /** Optional within-year date parts (1-based ints; never JS Date). */
    startMonth: integer('start_month'),
    startDay: integer('start_day'),
    endMonth: integer('end_month'),
    endDay: integer('end_day'),
    isStartUncertain: boolean('is_start_uncertain').notNull().default(false),
    isEndUncertain: boolean('is_end_uncertain').notNull().default(false),
    /** Representative single year for sorting/anchoring (e.g. midpoint). */
    displayYear: integer('display_year'),
    confidence: integer('confidence').notNull().default(50),
    isPlaceholder: boolean('is_placeholder').notNull().default(true),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    editorialStatus: editorialStatusEnum('editorial_status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('periods_start_year_idx').on(t.startYear),
    index('periods_end_year_idx').on(t.endYear),
    index('periods_display_year_idx').on(t.displayYear),
    check('periods_confidence_range', sql`${t.confidence} >= 0 AND ${t.confidence} <= 100`),
    check(
      'periods_month_range',
      sql`(${t.startMonth} IS NULL OR (${t.startMonth} >= 1 AND ${t.startMonth} <= 12)) AND (${t.endMonth} IS NULL OR (${t.endMonth} >= 1 AND ${t.endMonth} <= 12))`,
    ),
    check(
      'periods_day_range',
      sql`(${t.startDay} IS NULL OR (${t.startDay} >= 1 AND ${t.startDay} <= 31)) AND (${t.endDay} IS NULL OR (${t.endDay} >= 1 AND ${t.endDay} <= 31))`,
    ),
    check(
      'periods_valid_range',
      sql`${t.startYear} IS NULL OR ${t.endYear} IS NULL OR ${t.startYear} <= ${t.endYear}`,
    ),
  ],
);

export type Period = typeof periods.$inferSelect;
export type NewPeriod = typeof periods.$inferInsert;
