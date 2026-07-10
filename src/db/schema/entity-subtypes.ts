/**
 * Per-kind subtype tables, one row per entity of that kind, 1:1 via a
 * shared-primary-key FK to entities.id. Kept separate from `entities` so
 * kind-specific columns stay typed instead of collapsing into JSON.
 * Not every entity kind needs extra columns yet (e.g. `concept` is
 * intentionally minimal in this cycle) — add columns as real research
 * lands in a future cycle, this table shape is the extension point.
 */
import { integer, pgTable, real, text } from 'drizzle-orm/pg-core';
import { entities } from './entities';
import { periods } from './periods';

const entityFk = () => text('entity_id').primaryKey().references(() => entities.id, { onDelete: 'cascade' });

export const entityPersonDetails = pgTable('entity_person_details', {
  entityId: entityFk(),
  birthYear: integer('birth_year'),
  deathYear: integer('death_year'),
  nationalityLabel: text('nationality_label'),
});

export const entityInventionDetails = pgTable('entity_invention_details', {
  entityId: entityFk(),
  inventionYear: integer('invention_year'),
  category: text('category'),
});

export const entityEventDetails = pgTable('entity_event_details', {
  entityId: entityFk(),
  periodId: text('period_id').references(() => periods.id, { onDelete: 'set null' }),
  eventType: text('event_type'),
});

export const entityThemeDetails = pgTable('entity_theme_details', {
  entityId: entityFk(),
  colorHex: text('color_hex'),
  /** Stable renderer lens/identity key (e.g. 'spaceflight', 'steam',
   * 'coldwar') — the explicit bridge from a theme entity to the visual
   * layer's theme lens. Presentation KEY only; the visual treatment
   * itself lives in src/data/identity. */
  lensKey: text('lens_key'),
});

export const entityPlaceDetails = pgTable('entity_place_details', {
  entityId: entityFk(),
  modernName: text('modern_name'),
  latitude: real('latitude'),
  longitude: real('longitude'),
});

export const entityOrganisationDetails = pgTable('entity_organisation_details', {
  entityId: entityFk(),
  foundedYear: integer('founded_year'),
  dissolvedYear: integer('dissolved_year'),
});

export const entityCivilisationDetails = pgTable('entity_civilisation_details', {
  entityId: entityFk(),
  periodId: text('period_id').references(() => periods.id, { onDelete: 'set null' }),
  regionLabel: text('region_label'),
});

export const entityConceptDetails = pgTable('entity_concept_details', {
  entityId: entityFk(),
  domain: text('domain'),
});

/** Entities of kind `period` — links the entity to its exact periods row. */
export const entityPeriodDetails = pgTable('entity_period_details', {
  entityId: entityFk(),
  periodId: text('period_id')
    .notNull()
    .references(() => periods.id, { onDelete: 'restrict' }),
});

export type EntityPersonDetails = typeof entityPersonDetails.$inferSelect;
export type EntityInventionDetails = typeof entityInventionDetails.$inferSelect;
export type EntityEventDetails = typeof entityEventDetails.$inferSelect;
export type EntityThemeDetails = typeof entityThemeDetails.$inferSelect;
export type EntityPlaceDetails = typeof entityPlaceDetails.$inferSelect;
export type EntityOrganisationDetails = typeof entityOrganisationDetails.$inferSelect;
export type EntityCivilisationDetails = typeof entityCivilisationDetails.$inferSelect;
export type EntityConceptDetails = typeof entityConceptDetails.$inferSelect;
export type EntityPeriodDetails = typeof entityPeriodDetails.$inferSelect;
