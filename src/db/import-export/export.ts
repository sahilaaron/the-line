/**
 * Export functions. `exportDatabase` dumps every table. `exportYolClosure`
 * dumps one YoL composition plus the transitive closure of everything it
 * references (period, themes -> theme entities, featured entities, scene
 * hints, and any relationships/claims/sources touching those entities).
 */
import { inArray } from 'drizzle-orm';
import * as schema from '../schema';
import type { Db } from '../repositories/types';
import { EXPORT_FORMAT_VERSION, type ExportPayload } from './types';

export async function exportDatabase(db: Db): Promise<ExportPayload> {
  const [
    periods,
    entities,
    entityPersonDetails,
    entityInventionDetails,
    entityEventDetails,
    entityThemeDetails,
    entityPlaceDetails,
    entityOrganisationDetails,
    entityCivilisationDetails,
    entityConceptDetails,
    entityPeriodDetails,
    relationships,
    claims,
    sources,
    claimSources,
    relationshipClaims,
    yolCompositions,
    yolThemes,
    yolSceneHints,
    yolFeaturedEntities,
    media,
    mediaAssociations,
  ] = await Promise.all([
    db.query.periods.findMany(),
    db.query.entities.findMany(),
    db.query.entityPersonDetails.findMany(),
    db.query.entityInventionDetails.findMany(),
    db.query.entityEventDetails.findMany(),
    db.query.entityThemeDetails.findMany(),
    db.query.entityPlaceDetails.findMany(),
    db.query.entityOrganisationDetails.findMany(),
    db.query.entityCivilisationDetails.findMany(),
    db.query.entityConceptDetails.findMany(),
    db.query.entityPeriodDetails.findMany(),
    db.query.relationships.findMany(),
    db.query.claims.findMany(),
    db.query.sources.findMany(),
    db.query.claimSources.findMany(),
    db.query.relationshipClaims.findMany(),
    db.query.yolCompositions.findMany(),
    db.query.yolThemes.findMany(),
    db.query.yolSceneHints.findMany(),
    db.query.yolFeaturedEntities.findMany(),
    db.query.media.findMany(),
    db.query.mediaAssociations.findMany(),
  ]);

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      periods,
      entities,
      entityPersonDetails,
      entityInventionDetails,
      entityEventDetails,
      entityThemeDetails,
      entityPlaceDetails,
      entityOrganisationDetails,
      entityCivilisationDetails,
      entityConceptDetails,
      entityPeriodDetails,
      relationships,
      claims,
      sources,
      claimSources,
      relationshipClaims,
      yolCompositions,
      yolThemes,
      yolSceneHints,
      yolFeaturedEntities,
      media,
      mediaAssociations,
    },
  };
}

export async function exportYolClosure(db: Db, yolId: string): Promise<ExportPayload> {
  const yol = await db.query.yolCompositions.findFirst({ where: (t, { eq }) => eq(t.id, yolId) });
  if (!yol) throw new Error(`YoL composition ${yolId} not found`);

  const [themes, hints, featured] = await Promise.all([
    db.query.yolThemes.findMany({ where: (t, { eq }) => eq(t.yolId, yolId) }),
    db.query.yolSceneHints.findMany({ where: (t, { eq }) => eq(t.yolId, yolId) }),
    db.query.yolFeaturedEntities.findMany({ where: (t, { eq }) => eq(t.yolId, yolId) }),
  ]);

  const entityIds = new Set<string>([
    ...themes.map((t) => t.themeEntityId),
    ...featured.map((f) => f.entityId),
  ]);
  const period = await db.query.periods.findFirst({ where: (t, { eq }) => eq(t.id, yol.periodId) });

  const entities = entityIds.size > 0 ? await db.query.entities.findMany({ where: inArray(schema.entities.id, [...entityIds]) }) : [];
  const relationships =
    entityIds.size > 0
      ? await db.query.relationships.findMany({
          where: (t, { or: orOp }) => orOp(inArray(t.sourceEntityId, [...entityIds]), inArray(t.targetEntityId, [...entityIds])),
        })
      : [];
  const relationshipIds = relationships.map((r) => r.id);
  const claims =
    entityIds.size > 0 || relationshipIds.length > 0
      ? await db.query.claims.findMany({
          where: inArray(schema.claims.subjectId, [...entityIds, ...relationshipIds, yol.periodId]),
        })
      : [];
  const claimIds = claims.map((c) => c.id);
  const claimSources = claimIds.length > 0 ? await db.query.claimSources.findMany({ where: inArray(schema.claimSources.claimId, claimIds) }) : [];
  const sourceIds = [...new Set(claimSources.map((cs) => cs.sourceId))];
  const sources = sourceIds.length > 0 ? await db.query.sources.findMany({ where: inArray(schema.sources.id, sourceIds) }) : [];
  const relationshipClaims = relationshipIds.length > 0 ? await db.query.relationshipClaims.findMany({ where: inArray(schema.relationshipClaims.relationshipId, relationshipIds) }) : [];

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      periods: period ? [period] : [],
      entities,
      entityPersonDetails: [],
      entityInventionDetails: [],
      entityEventDetails: [],
      entityThemeDetails: [],
      entityPlaceDetails: [],
      entityOrganisationDetails: [],
      entityCivilisationDetails: [],
      entityConceptDetails: [],
      entityPeriodDetails: [],
      relationships,
      claims,
      sources,
      claimSources,
      relationshipClaims,
      yolCompositions: [yol],
      yolThemes: themes,
      yolSceneHints: hints,
      yolFeaturedEntities: featured,
      media: [],
      mediaAssociations: [],
    },
  };
}
