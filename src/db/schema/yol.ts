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
import { editorialStatusEnum, newId } from './shared';
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

export type YolComposition = typeof yolCompositions.$inferSelect;
export type NewYolComposition = typeof yolCompositions.$inferInsert;
export type YolTheme = typeof yolThemes.$inferSelect;
export type YolSceneHint = typeof yolSceneHints.$inferSelect;
export type YolFeaturedEntity = typeof yolFeaturedEntities.$inferSelect;
