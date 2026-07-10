/**
 * The canonical DB -> YoL read model: everything the Year-on-Line page needs
 * for one anchor, as one typed, renderer-agnostic structure.
 *
 * SYNTHETIC EXCLUSION BOUNDARY: every query in this path filters
 * `isSynthetic = false`. Synthetic stress fixtures cannot cross this
 * function, so nothing downstream (API route, client accessor, renderer)
 * needs to re-check.
 *
 * SQL stays here (server-side); React components consume the returned
 * JSON-safe `YolReadModel` (src/domain/yol-read-model.ts) only.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  claims,
  claimSources,
  entities,
  entityThemeDetails,
  media,
  mediaAssociations,
  periods,
  sources,
  yolCompositions,
  yolPointThemes,
  yolThemes,
  yolTimelinePoints,
} from '../schema';
import type { Db } from '../repositories/types';
import {
  formatYolDate,
  type YolClaimRef,
  type YolDate,
  type YolMediaRef,
  type YolPointModel,
  type YolProvenance,
  type YolReadModel,
  type YolThemeModel,
} from '../../domain/yol-read-model';

const REVIEWED_STATUSES = new Set(['in_review', 'verified', 'published']);

function provenanceOf(isPlaceholder: boolean, editorialStatus: string): YolProvenance {
  return !isPlaceholder && REVIEWED_STATUSES.has(editorialStatus) ? 'reviewed' : 'placeholder';
}

function toYolDate(p: typeof periods.$inferSelect): YolDate {
  const year = p.startYear ?? p.displayYear ?? 0;
  return {
    year,
    month: p.startMonth ?? undefined,
    day: p.startDay ?? undefined,
    endYear: p.endYear != null && p.endYear !== year ? p.endYear : undefined,
    endMonth: p.endMonth ?? undefined,
    endDay: p.endDay ?? undefined,
    precision: p.precision,
    uncertain: p.isStartUncertain || p.isEndUncertain,
    display: formatYolDate({
      year,
      month: p.startMonth,
      day: p.startDay,
      endYear: p.endYear,
      endMonth: p.endMonth,
      endDay: p.endDay,
      precision: p.precision,
    }),
  };
}

/**
 * Builds the full read model for an anchor slug, or undefined when the
 * composition does not exist (missing/empty database included — callers
 * decide how to fall back; this layer never throws for "not found").
 */
export async function yolReadModelByAnchorSlug(db: Db, anchorSlug: string): Promise<YolReadModel | undefined> {
  const [composition] = await db
    .select()
    .from(yolCompositions)
    .where(and(eq(yolCompositions.anchorSlug, anchorSlug), eq(yolCompositions.isSynthetic, false)));
  if (!composition) return undefined;

  const [anchorPeriod] = await db
    .select()
    .from(periods)
    .where(and(eq(periods.id, composition.periodId), eq(periods.isSynthetic, false)));

  /* themes: composition themes joined to non-synthetic theme entities */
  const themeRows = await db
    .select({
      yolThemeId: yolThemes.id,
      importance: yolThemes.importance,
      displayOrder: yolThemes.displayOrder,
      displayLabel: yolThemes.displayLabel,
      entityId: entities.id,
      label: entities.label,
      slug: entities.slug,
      colorHex: entityThemeDetails.colorHex,
      lensKey: entityThemeDetails.lensKey,
    })
    .from(yolThemes)
    .innerJoin(entities, and(eq(yolThemes.themeEntityId, entities.id), eq(entities.isSynthetic, false)))
    .leftJoin(entityThemeDetails, eq(entityThemeDetails.entityId, entities.id))
    .where(eq(yolThemes.yolId, composition.id))
    .orderBy(asc(yolThemes.displayOrder));

  const themes: YolThemeModel[] = themeRows.map((t) => ({
    lensKey: t.lensKey ?? (t.slug ?? '').split('-').pop() ?? t.label.toLowerCase(),
    label: t.label,
    displayLabel: t.displayLabel ?? t.label,
    colorHex: t.colorHex,
    importance: t.importance,
    displayOrder: t.displayOrder,
  }));
  const lensKeyByThemeRowId = new Map(themeRows.map((t, i) => [t.yolThemeId, themes[i].lensKey]));

  /* ordered chronology */
  const pointRows = await db
    .select()
    .from(yolTimelinePoints)
    .where(and(eq(yolTimelinePoints.yolId, composition.id), eq(yolTimelinePoints.isSynthetic, false)))
    .orderBy(asc(yolTimelinePoints.displayOrder));

  const pointIds = pointRows.map((p) => p.id);
  const entityIds = [...new Set(pointRows.map((p) => p.entityId).filter((x): x is string => x !== null))];
  const periodIds = [...new Set(pointRows.map((p) => p.periodId).filter((x): x is string => x !== null))];

  const [pointEntityRows, pointPeriodRows, pointThemeRows] = await Promise.all([
    entityIds.length
      ? db.select().from(entities).where(and(inArray(entities.id, entityIds), eq(entities.isSynthetic, false)))
      : Promise.resolve([]),
    periodIds.length
      ? db.select().from(periods).where(and(inArray(periods.id, periodIds), eq(periods.isSynthetic, false)))
      : Promise.resolve([]),
    pointIds.length
      ? db.select().from(yolPointThemes).where(inArray(yolPointThemes.pointId, pointIds))
      : Promise.resolve([]),
  ]);
  const entityById = new Map(pointEntityRows.map((e) => [e.id, e]));
  const periodById = new Map(pointPeriodRows.map((p) => [p.id, p]));
  const themeKeysByPoint = new Map<string, string[]>();
  for (const pt of pointThemeRows) {
    const key = lensKeyByThemeRowId.get(pt.yolThemeId);
    if (!key) continue;
    const arr = themeKeysByPoint.get(pt.pointId) ?? [];
    arr.push(key);
    themeKeysByPoint.set(pt.pointId, arr);
  }

  /* claims + sources for point entities (non-synthetic only) */
  const claimRows = entityIds.length
    ? await db
        .select()
        .from(claims)
        .where(and(inArray(claims.subjectId, entityIds), eq(claims.subjectType, 'entity'), eq(claims.isSynthetic, false)))
    : [];
  const claimIds = claimRows.map((c) => c.id);
  const claimSourceRows = claimIds.length
    ? await db
        .select({
          claimId: claimSources.claimId,
          locator: claimSources.locator,
          quotation: claimSources.quotation,
          title: sources.title,
          type: sources.type,
          publicationYear: sources.publicationYear,
        })
        .from(claimSources)
        .innerJoin(sources, and(eq(claimSources.sourceId, sources.id), eq(sources.isSynthetic, false)))
        .where(inArray(claimSources.claimId, claimIds))
    : [];
  const sourcesByClaim = new Map<string, YolClaimRef['sources']>();
  for (const cs of claimSourceRows) {
    const arr = sourcesByClaim.get(cs.claimId) ?? [];
    arr.push({
      title: cs.title,
      type: cs.type,
      publicationYear: cs.publicationYear,
      locator: cs.locator,
      quotation: cs.quotation,
    });
    sourcesByClaim.set(cs.claimId, arr);
  }
  const claimsByEntity = new Map<string, YolClaimRef[]>();
  for (const c of claimRows) {
    const arr = claimsByEntity.get(c.subjectId) ?? [];
    arr.push({
      text: c.text,
      verificationStatus: c.verificationStatus,
      disputed: c.disputed,
      confidence: c.confidence,
      sources: sourcesByClaim.get(c.id) ?? [],
    });
    claimsByEntity.set(c.subjectId, arr);
  }

  /* media metadata for point entities (never synthetic fixtures) */
  const mediaAssocRows = entityIds.length
    ? await db
        .select({
          subjectId: mediaAssociations.subjectId,
          id: media.id,
          title: media.title,
          mediaType: media.mediaType,
          rightsStatus: media.rightsStatus,
          uri: media.sourceUrl,
          attribution: media.attributionText,
        })
        .from(mediaAssociations)
        .innerJoin(media, and(eq(mediaAssociations.mediaId, media.id), eq(media.isSynthetic, false)))
        .where(and(inArray(mediaAssociations.subjectId, entityIds), eq(mediaAssociations.subjectType, 'entity')))
    : [];
  const mediaByEntity = new Map<string, YolMediaRef[]>();
  for (const m of mediaAssocRows) {
    const arr = mediaByEntity.get(m.subjectId) ?? [];
    arr.push({ id: m.id, title: m.title, mediaType: m.mediaType, rightsStatus: m.rightsStatus, uri: m.uri, attribution: m.attribution });
    mediaByEntity.set(m.subjectId, arr);
  }

  const points: YolPointModel[] = pointRows.map((p) => {
    const entity = p.entityId ? entityById.get(p.entityId) : undefined;
    const period = p.periodId ? periodById.get(p.periodId) : undefined;
    return {
      id: p.id,
      role: p.role,
      displayOrder: p.displayOrder,
      sectionKey: p.sectionKey,
      headline: p.headline ?? entity?.label ?? composition.title,
      summary: p.summary ?? entity?.summary ?? '',
      entity: entity ? { slug: entity.slug ?? entity.id, kind: entity.kind, label: entity.label } : null,
      date: period ? toYolDate(period) : null,
      themes: themeKeysByPoint.get(p.id) ?? [],
      claims: entity ? (claimsByEntity.get(entity.id) ?? []) : [],
      media: entity ? (mediaByEntity.get(entity.id) ?? []) : [],
      provenance: provenanceOf(p.isPlaceholder, p.editorialStatus),
      editorialStatus: p.editorialStatus,
    };
  });

  return {
    anchorSlug,
    enteredYear: anchorPeriod?.displayYear ?? anchorPeriod?.startYear ?? 0,
    title: composition.title,
    thesis: composition.thesis,
    supportingLine: composition.supportingLine,
    atmospherePreset: composition.atmospherePreset,
    provenance: provenanceOf(composition.isPlaceholder, composition.editorialStatus),
    editorialStatus: composition.editorialStatus,
    themes,
    points,
  };
}
