import type {
  Claim,
  ClaimSource,
  Entity,
  EntityCivilisationDetails,
  EntityConceptDetails,
  EntityEventDetails,
  EntityInventionDetails,
  EntityOrganisationDetails,
  EntityPeriodDetails,
  EntityPersonDetails,
  EntityPlaceDetails,
  EntityThemeDetails,
  Media,
  MediaAssociation,
  Period,
  Relationship,
  RelationshipClaim,
  Source,
  YolComposition,
  YolFeaturedEntity,
  YolPointTheme,
  YolSceneHint,
  YolTheme,
  YolTimelinePoint,
} from '../schema';

export const EXPORT_FORMAT_VERSION = 1;

export interface ExportPayload {
  formatVersion: typeof EXPORT_FORMAT_VERSION;
  exportedAt: string;
  data: {
    periods: Period[];
    entities: Entity[];
    entityPersonDetails: EntityPersonDetails[];
    entityInventionDetails: EntityInventionDetails[];
    entityEventDetails: EntityEventDetails[];
    entityThemeDetails: EntityThemeDetails[];
    entityPlaceDetails: EntityPlaceDetails[];
    entityOrganisationDetails: EntityOrganisationDetails[];
    entityCivilisationDetails: EntityCivilisationDetails[];
    entityConceptDetails: EntityConceptDetails[];
    entityPeriodDetails: EntityPeriodDetails[];
    relationships: Relationship[];
    claims: Claim[];
    sources: Source[];
    claimSources: ClaimSource[];
    relationshipClaims: RelationshipClaim[];
    yolCompositions: YolComposition[];
    yolThemes: YolTheme[];
    yolSceneHints: YolSceneHint[];
    yolFeaturedEntities: YolFeaturedEntity[];
    yolTimelinePoints: YolTimelinePoint[];
    yolPointThemes: YolPointTheme[];
    media: Media[];
    mediaAssociations: MediaAssociation[];
  };
}

export interface ImportSummary {
  created: Record<string, number>;
  skipped: Record<string, number>;
  failed: Record<string, number>;
  dryRun: boolean;
  ok: boolean;
  errorMessages: string[];
}
