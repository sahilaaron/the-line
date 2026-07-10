/**
 * Deterministic synthetic stress-seed generator. Fixed seed -> identical
 * output every run (content-wise; primary keys are still fresh UUIDs per
 * insert, but every deterministic field — slug, label, year, counts — is a
 * pure function of the seed). All rows are clearly synthetic: entity/period
 * slugs are prefixed `synth-`, every row sets `isSynthetic: true`, and
 * source titles are prefixed `SYNTHETIC:`.
 *
 * Idempotent: every insert targets a slug/unique-constrained shape and
 * uses onConflictDoNothing, so re-running with the same seed is a no-op
 * after the first run.
 */
import {
  claimSources,
  claims,
  entities,
  entityThemeDetails,
  periods,
  relationshipClaims,
  relationships,
  sources,
  yolCompositions,
  yolFeaturedEntities,
  yolSceneHints,
  yolThemes,
  type NewClaim,
  type NewEntity,
  type NewPeriod,
  type NewRelationship,
  type NewSource,
} from '../schema';
import type { Db } from '../repositories/types';
import { chance, intBetween, mulberry32, pick } from './prng';

export const SYNTHETIC_SEED = 1337;

export const SYNTHETIC_TARGETS = {
  entities: 5000,
  periods: 10000,
  relationships: 20000,
  claims: 2000,
  sources: 1000,
  yolCompositions: 100,
} as const;

export type SyntheticTargets = Record<keyof typeof SYNTHETIC_TARGETS, number>;

const ENTITY_KINDS = [
  'person',
  'invention',
  'event',
  'theme',
  'place',
  'organisation',
  'civilisation',
  'concept',
  'period',
] as const;

const RELATIONSHIP_TYPES = [
  'enabled',
  'influenced',
  'contributed_to',
  'accelerated',
  'responded_to',
  'opposed',
  'replaced',
  'spread_through',
  'developed_by',
  'improved_by',
  'occurred_in',
  'associated_with',
  'part_of',
] as const;

const SOURCE_TYPES = [
  'book',
  'article',
  'website',
  'primary_document',
  'video',
  'dataset',
  'oral_history',
  'other',
] as const;

const VERIFICATION_STATUSES = ['unverified', 'corroborated', 'verified', 'disputed'] as const;
const PRECISIONS = ['exact', 'approximate', 'range', 'decade', 'century', 'era', 'unknown'] as const;
const CLAIM_SUBJECTS = ['entity', 'relationship', 'period'] as const;

async function insertChunked<T extends Record<string, unknown>>(
  db: Db,
  table: Parameters<Db['insert']>[0],
  rows: T[],
  chunkSize: number,
  onConflictNothing = true,
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const result = onConflictNothing
      ? await db.insert(table).values(chunk as never).onConflictDoNothing().returning()
      : await db.insert(table).values(chunk as never).returning();
    inserted += (result as unknown[]).length;
  }
  return inserted;
}

export interface SyntheticSeedSummary {
  entities: number;
  periods: number;
  relationships: number;
  claims: number;
  sources: number;
  claimSources: number;
  yolCompositions: number;
  yolThemes: number;
  yolSceneHints: number;
  yolFeaturedEntities: number;
  mutualInfluenceCyclesInjected: number;
}

export async function seedSynthetic(
  db: Db,
  seed: number = SYNTHETIC_SEED,
  targets: SyntheticTargets = SYNTHETIC_TARGETS,
): Promise<SyntheticSeedSummary> {
  const rng = mulberry32(seed);

  // ---- Periods ----
  const periodRows: NewPeriod[] = [];
  for (let i = 0; i < targets.periods; i++) {
    const isBce = chance(rng, 0.35);
    const spanWidth = intBetween(rng, 0, 400);
    const anchorYear = isBce ? -intBetween(rng, 1, 9999) : intBetween(rng, 1, 2026);
    const startYear = anchorYear;
    const endYear = spanWidth === 0 ? anchorYear : anchorYear + spanWidth;
    const precision = pick(rng, PRECISIONS);
    periodRows.push({
      slug: `synth-period-${i.toString().padStart(5, '0')}`,
      label: `SYNTHETIC period #${i} (${startYear}..${endYear})`,
      precision,
      startYear: precision === 'unknown' ? null : startYear,
      endYear: precision === 'unknown' ? null : endYear,
      isStartUncertain: chance(rng, 0.2),
      isEndUncertain: chance(rng, 0.2),
      displayYear: precision === 'unknown' ? null : Math.round((startYear + endYear) / 2),
      confidence: intBetween(rng, 0, 100),
      isPlaceholder: true,
      isSynthetic: true,
      editorialStatus: 'draft',
    });
  }
  const periodsInserted = await insertChunked(db, periods, periodRows, 500);
  const periodIdRows = await db.query.periods.findMany({
    columns: { id: true, slug: true },
    where: (p, { like }) => like(p.slug, 'synth-period-%'),
  });
  const periodIds = periodIdRows.map((p) => p.id);

  // ---- Entities ----
  const entityRows: NewEntity[] = [];
  for (let i = 0; i < targets.entities; i++) {
    const kind = ENTITY_KINDS[i % ENTITY_KINDS.length]; // guarantees full coverage
    const periodId = periodIds.length > 0 ? pick(rng, periodIds) : null;
    entityRows.push({
      slug: `synth-entity-${i.toString().padStart(5, '0')}`,
      kind,
      label: `SYNTHETIC ${kind} #${i}`,
      summary: `Synthetic stress-test fixture entity of kind "${kind}".`,
      primaryPeriodId: chance(rng, 0.6) ? periodId : null,
      isPlaceholder: true,
      isSynthetic: true,
      editorialStatus: pick(rng, ['draft', 'in_review', 'verified', 'disputed', 'published'] as const),
    });
  }
  const entitiesInserted = await insertChunked(db, entities, entityRows, 500);
  const entityIdRows = await db.query.entities.findMany({
    columns: { id: true, kind: true },
    where: (e, { like }) => like(e.slug, 'synth-entity-%'),
  });
  const entityIds = entityIdRows.map((e) => e.id);
  const themeEntityIds = entityIdRows.filter((e) => e.kind === 'theme').map((e) => e.id);

  // Give a slice of theme entities their subtype row (not required for all).
  const themeDetailRows = themeEntityIds.slice(0, 200).map((entityId) => ({
    entityId,
    colorHex: `#${intBetween(rng, 0, 0xffffff).toString(16).padStart(6, '0')}`,
  }));
  await insertChunked(db, entityThemeDetails, themeDetailRows, 500);

  // ---- Relationships ----
  // Explicit mutual-influence cycles injected first, to guarantee the
  // dataset always demonstrates legitimate allowed cycles regardless of
  // what random generation produces.
  const relRows: NewRelationship[] = [];
  const edgeKeys = new Set<string>();
  let mutualCycles = 0;

  function addEdge(sourceEntityId: string, targetEntityId: string, type: (typeof RELATIONSHIP_TYPES)[number], opts: Partial<NewRelationship> = {}): boolean {
    if (sourceEntityId === targetEntityId) return false;
    const key = `${sourceEntityId}|${targetEntityId}|${type}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    relRows.push({
      sourceEntityId,
      targetEntityId,
      type,
      explanation: `Synthetic ${type} edge for stress testing.`,
      strength: intBetween(rng, 0, 100),
      confidence: intBetween(rng, 0, 100),
      disputed: chance(rng, 0.08),
      isSynthetic: true,
      editorialStatus: 'draft',
      ...opts,
    });
    return true;
  }

  const cyclePairCount = Math.min(25, Math.floor(entityIds.length / 2));
  for (let i = 0; i < cyclePairCount; i++) {
    const a = entityIds[i * 2];
    const b = entityIds[i * 2 + 1];
    if (!a || !b) continue;
    const okAB = addEdge(a, b, 'influenced', { confidence: 70, strength: 60 });
    const okBA = addEdge(b, a, 'influenced', { confidence: 65, strength: 55 });
    if (okAB && okBA) mutualCycles++;
  }
  // One explicit 3-cycle for traversal tests (A -> B -> C -> A, influenced).
  if (entityIds.length >= 3) {
    const [a, b, c] = entityIds;
    addEdge(a, b, 'influenced');
    addEdge(b, c, 'influenced');
    addEdge(c, a, 'influenced');
  }

  let attempts = 0;
  const maxAttempts = targets.relationships * 4;
  while (relRows.length < targets.relationships && attempts < maxAttempts) {
    attempts++;
    const source = pick(rng, entityIds);
    const target = pick(rng, entityIds);
    const type = pick(rng, RELATIONSHIP_TYPES);
    addEdge(source, target, type);
  }
  const relationshipsInserted = await insertChunked(db, relationships, relRows, 500);

  const relationshipIdRows = await db.query.relationships.findMany({
    columns: { id: true },
    where: (r, { eq }) => eq(r.isSynthetic, true),
  });
  const relationshipIds = relationshipIdRows.map((r) => r.id);

  // ---- Sources ----
  const sourceRows: NewSource[] = [];
  for (let i = 0; i < targets.sources; i++) {
    sourceRows.push({
      title: `SYNTHETIC: stress-test source #${i}`,
      type: pick(rng, SOURCE_TYPES),
      publicationYear: chance(rng, 0.8) ? intBetween(rng, -500, 2026) : null,
      url: chance(rng, 0.5) ? `https://example.invalid/synthetic-source/${i}` : null,
      identifier: chance(rng, 0.3) ? `SYNTH-ID-${i}` : null,
      notes: 'Synthetic fixture source — not a real citation.',
      isSynthetic: true,
    });
  }
  const sourcesInserted = await insertChunked(db, sources, sourceRows, 500);
  const sourceIdRows = await db.query.sources.findMany({
    columns: { id: true },
    where: (s, { eq }) => eq(s.isSynthetic, true),
  });
  const sourceIds = sourceIdRows.map((s) => s.id);

  // ---- Claims (+ claim_sources, + relationship_claims) ----
  const claimRows: NewClaim[] = [];
  for (let i = 0; i < targets.claims; i++) {
    const subjectType = pick(rng, CLAIM_SUBJECTS);
    const subjectId =
      subjectType === 'entity' ? pick(rng, entityIds) : subjectType === 'relationship' ? pick(rng, relationshipIds) : pick(rng, periodIds);
    if (!subjectId) continue;
    const verificationStatus = pick(rng, VERIFICATION_STATUSES);
    claimRows.push({
      text: `SYNTHETIC claim #${i} about a ${subjectType}.`,
      subjectType,
      subjectId,
      confidence: intBetween(rng, 0, 100),
      verificationStatus,
      disputed: verificationStatus === 'disputed' || chance(rng, 0.05),
      isSynthetic: true,
    });
  }
  const claimsInserted = await insertChunked(db, claims, claimRows, 500);
  const claimIdRows = await db.query.claims.findMany({
    columns: { id: true, subjectType: true, verificationStatus: true },
    where: (c, { eq }) => eq(c.isSynthetic, true),
  });

  const claimSourceRows: { claimId: string; sourceId: string; quotation?: string; locator?: string }[] = [];
  const relationshipClaimRows: { relationshipId: string; claimId: string }[] = [];
  for (const c of claimIdRows) {
    const needsSource = c.verificationStatus === 'verified' || c.verificationStatus === 'corroborated';
    const linkCount = needsSource ? intBetween(rng, 1, 2) : chance(rng, 0.3) ? 1 : 0;
    for (let j = 0; j < linkCount && sourceIds.length > 0; j++) {
      claimSourceRows.push({
        claimId: c.id,
        sourceId: pick(rng, sourceIds),
        locator: `p.${intBetween(rng, 1, 400)}`,
      });
    }
  }
  const claimSourcesInserted = await insertChunked(db, claimSources, claimSourceRows, 500);
  await insertChunked(db, relationshipClaims, relationshipClaimRows, 500);

  // ---- YoL compositions ----
  const yolPeriodPool = periodIds.slice(0, targets.yolCompositions * 3);
  const atmospherePresets = ['settlement', 'print', 'industrial', 'orbital', 'network'] as const;
  let yolThemesInserted = 0;
  let yolHintsInserted = 0;
  let yolFeaturedInserted = 0;
  let yolCompositionsInserted = 0;

  for (let i = 0; i < targets.yolCompositions; i++) {
    const periodId = yolPeriodPool.length > 0 ? pick(rng, yolPeriodPool) : pick(rng, periodIds);
    const [yol] = await db
      .insert(yolCompositions)
      .values({
        periodId,
        anchorSlug: null,
        title: `SYNTHETIC YoL composition #${i}`,
        thesis: `Synthetic stress-test thesis line #${i} — not researched history.`,
        supportingLine: 'Generated fixture data for load testing.',
        atmospherePreset: pick(rng, atmospherePresets),
        isPlaceholder: true,
        isSynthetic: true,
        editorialStatus: 'draft',
      })
      .onConflictDoNothing()
      .returning();
    if (!yol) continue;
    yolCompositionsInserted++;

    const themeCount = intBetween(rng, 2, 4);
    const chosenThemes = new Set<string>();
    while (chosenThemes.size < themeCount && chosenThemes.size < themeEntityIds.length) {
      chosenThemes.add(pick(rng, themeEntityIds));
    }
    const themeRows = [...chosenThemes].map((themeEntityId, idx) => ({
      yolId: yol.id,
      themeEntityId,
      importance: intBetween(rng, 0, 100),
      displayOrder: idx,
    }));
    if (themeRows.length > 0) {
      const r = await db.insert(yolThemes).values(themeRows).onConflictDoNothing().returning();
      yolThemesInserted += r.length;
    }

    const hintRows = [
      { yolId: yol.id, hintKey: 'motif', hintValue: pick(rng, ['orbital', 'settlement', 'print', 'industrial', 'network']) },
      { yolId: yol.id, hintKey: 'intensity', hintValue: pick(rng, ['low', 'medium', 'high']) },
    ];
    const hr = await db.insert(yolSceneHints).values(hintRows).returning();
    yolHintsInserted += hr.length;

    const featuredCount = intBetween(rng, 1, 3);
    const chosenFeatured = new Set<string>();
    while (chosenFeatured.size < featuredCount) {
      chosenFeatured.add(pick(rng, entityIds));
    }
    const featuredRows = [...chosenFeatured].map((entityId, idx) => ({
      yolId: yol.id,
      entityId,
      displayOrder: idx,
    }));
    const fr = await db.insert(yolFeaturedEntities).values(featuredRows).onConflictDoNothing().returning();
    yolFeaturedInserted += fr.length;
  }

  return {
    entities: entitiesInserted,
    periods: periodsInserted,
    relationships: relationshipsInserted,
    claims: claimsInserted,
    sources: sourcesInserted,
    claimSources: claimSourcesInserted,
    yolCompositions: yolCompositionsInserted,
    yolThemes: yolThemesInserted,
    yolSceneHints: yolHintsInserted,
    yolFeaturedEntities: yolFeaturedInserted,
    mutualInfluenceCyclesInjected: mutualCycles,
  };
}
