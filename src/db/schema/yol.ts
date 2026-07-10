/**
 * Year on Line (YoL) compositions — the curated per-anchor package the
 * visual layer would eventually read (thesis, active themes, scene hints,
 * featured entities). Scene hints are semantic tags for the visual layer
 * to interpret (e.g. { motif: "orbital", intensity: "high" }), never GLSL
 * or literal render settings — that mapping lives in the (untouched)
 * src/experience layer, not here.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { editorialStatusEnum, newId, yolPointRoleEnum } from './shared';
import { periods } from './periods';
import { entities } from './entities';

export const yolCompositions = pgTable(
  'yol_compositions',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    periodId: text('period_id')
      .notNull()
      .references(() => periods.id, { onDelete: 'restrict' }),
    /** Matches src/data/anchors.ts Anchor.id when this composition mirrors
     * an existing prototype anchor. Null for synthetic-only compositions. */
    anchorSlug: text('anchor_slug').unique(),
    title: text('title').notNull(),
    thesis: text('thesis').notNull(),
    supportingLine: text('supporting_line'),
    /** Free-form key naming an atmosphere preset the visual layer maps
     * elsewhere (e.g. "orbital-1969"). Not a shader parameter set. */
    atmospherePreset: text('atmosphere_preset').notNull(),
    isPlaceholder: boolean('is_placeholder').notNull().default(true),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    editorialStatus: editorialStatusEnum('editorial_status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('yol_period_idx').on(t.periodId),
    check('yol_title_not_empty', sql`length(${t.title}) > 0`),
  ],
);

export const yolThemes = pgTable(
  'yol_themes',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    yolId: text('yol_id')
      .notNull()
      .references(() => yolCompositions.id, { onDelete: 'cascade' }),
    themeEntityId: text('theme_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    importance: integer('importance').notNull().default(50),
    displayOrder: integer('display_order').notNull().default(0),
    /** Optional long-form YoL label (e.g. "Steam & Mechanisation") —
     * curation copy; null falls back to the theme entity's label. */
    displayLabel: text('display_label'),
  },
  (t) => [
    unique('yol_themes_unique').on(t.yolId, t.themeEntityId),
    index('yol_themes_yol_idx').on(t.yolId),
    check('yol_themes_importance_range', sql`${t.importance} >= 0 AND ${t.importance} <= 100`),
  ],
);

/** Semantic scene hints, e.g. (motif, orbital) / (intensity, high). Free-form
 * key/value on purpose — kept normalized (not JSON) for simple querying. */
export const yolSceneHints = pgTable(
  'yol_scene_hints',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    yolId: text('yol_id')
      .notNull()
      .references(() => yolCompositions.id, { onDelete: 'cascade' }),
    hintKey: text('hint_key').notNull(),
    hintValue: text('hint_value').notNull(),
  },
  (t) => [index('yol_scene_hints_yol_idx').on(t.yolId)],
);

export const yolFeaturedEntities = pgTable(
  'yol_featured_entities',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    yolId: text('yol_id')
      .notNull()
      .references(() => yolCompositions.id, { onDelete: 'cascade' }),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (t) => [
    unique('yol_featured_entities_unique').on(t.yolId, t.entityId),
    index('yol_featured_entities_yol_idx').on(t.yolId),
  ],
);

/**
 * The ordered LOCAL CHRONOLOGY of a composition — one row per point on the
 * year's local timeline (year overview, dated developments, neighbouring
 * context years, a closing/transition point). Curation only: inclusion,
 * ordering, presentation role and optional copy overrides. Historical truth
 * stays in periods/entities/claims/sources; visual treatment stays in the
 * Year Visual Identity (this table stores only the `sectionKey` bridge).
 */
export const yolTimelinePoints = pgTable(
  'yol_timeline_points',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    yolId: text('yol_id')
      .notNull()
      .references(() => yolCompositions.id, { onDelete: 'cascade' }),
    role: yolPointRoleEnum('role').notNull().default('development'),
    /** The historical subject (event/invention/person/development entity).
     * Null for overview/closing points, which have no single subject. */
    entityId: text('entity_id').references(() => entities.id, { onDelete: 'restrict' }),
    /** The point's own time: an event-date period (with sub-year columns)
     * or a context-year period. Null only for closing points. */
    periodId: text('period_id').references(() => periods.id, { onDelete: 'restrict' }),
    /** Authoritative total order within the composition (chronological by
     * convention; stable when several developments share the same year). */
    displayOrder: integer('display_order').notNull(),
    /** Presentation-only bridge to the year identity's manifest section
     * (e.g. 'spaceflight', 'steam'). Never a historical categorisation. */
    sectionKey: text('section_key'),
    /** Curated display headline; null renders the entity's label. */
    headline: text('headline'),
    /** Curated display summary; null renders the entity's summary. */
    summary: text('summary'),
    isPlaceholder: boolean('is_placeholder').notNull().default(true),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    editorialStatus: editorialStatusEnum('editorial_status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('yol_timeline_points_order_unique').on(t.yolId, t.displayOrder),
    index('yol_timeline_points_yol_idx').on(t.yolId),
    index('yol_timeline_points_entity_idx').on(t.entityId),
  ],
);

/** Theme/lens associations of a timeline point, referencing the
 *  composition's own yol_themes rows (never a bare lens string). */
export const yolPointThemes = pgTable(
  'yol_point_themes',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    pointId: text('point_id')
      .notNull()
      .references(() => yolTimelinePoints.id, { onDelete: 'cascade' }),
    yolThemeId: text('yol_theme_id')
      .notNull()
      .references(() => yolThemes.id, { onDelete: 'cascade' }),
  },
  (t) => [
    unique('yol_point_themes_unique').on(t.pointId, t.yolThemeId),
    index('yol_point_themes_point_idx').on(t.pointId),
  ],
);

export type YolComposition = typeof yolCompositions.$inferSelect;
export type NewYolComposition = typeof yolCompositions.$inferInsert;
export type YolTheme = typeof yolThemes.$inferSelect;
export type YolSceneHint = typeof yolSceneHints.$inferSelect;
export type YolFeaturedEntity = typeof yolFeaturedEntities.$inferSelect;
export type YolTimelinePoint = typeof yolTimelinePoints.$inferSelect;
export type NewYolTimelinePoint = typeof yolTimelinePoints.$inferInsert;
export type YolPointTheme = typeof yolPointThemes.$inferSelect;
export type NewYolPointTheme = typeof yolPointThemes.$inferInsert;
