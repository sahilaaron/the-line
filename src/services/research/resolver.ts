/**
 * Entity resolver. "Exists" is never a binary skip: this returns one of the
 * documented states so the operator/kernel can decide between skip, refresh,
 * expand, create-stub or human duplicate-resolution. Match order (locked):
 * external id (strongest, non-fuzzy) -> exact slug -> normalized alias/label.
 * Multiple distinct matches are NEVER silently merged — they surface as
 * `ambiguous_duplicate` for human resolution.
 */
import { and, count, eq, inArray } from 'drizzle-orm';
import {
  claims,
  entities,
  entityTimeAssociations,
  researchJobs,
  type Entity,
} from '../../db/schema';
import type { Db } from '../../db/repositories/types';
import { findByExternalId, findAliasMatches, normalizeText } from '../../db/repositories/graph-ext';
import { DEFAULT_QUEUE_CONFIG, type QueueConfig } from './config';
import type { EntityResolutionStatus } from '../../db/schema';

export interface ResolveInput {
  slug?: string;
  label?: string;
  aliases?: string[];
  externalIds?: { scheme: string; value: string }[];
}

export interface ResolveResult {
  status: EntityResolutionStatus;
  matchedBy: 'external_id' | 'slug' | 'alias' | 'label' | null;
  entity?: Entity;
  /** For ambiguous_duplicate: the competing entity ids a human must resolve. */
  candidateIds?: string[];
}

async function completenessStatus(
  db: Db,
  entity: Entity,
  config: QueueConfig,
  now: Date,
): Promise<EntityResolutionStatus> {
  if (entity.graphStatus === 'archived' || entity.graphStatus === 'superseded') {
    return 'superseded_or_archived';
  }
  // Being actively worked right now?
  const openJob = await db.query.researchJobs.findFirst({
    where: and(
      eq(researchJobs.matchEntityId, entity.id),
      inArray(researchJobs.status, ['queued', 'claimed', 'researching']),
    ),
  });
  if (openJob) return 'queued_or_researching';

  if (entity.graphStatus === 'frontier' || entity.graphStatus === 'draft_stub') return 'draft_stub';
  if (entity.graphStatus === 'candidate') return 'candidate_in_review';
  if (entity.graphStatus === 'stale') return 'stale';

  // Age-based staleness (optional).
  if (config.freshnessMaxAgeMs > 0) {
    const checked = entity.freshnessCheckedAt?.getTime() ?? entity.updatedAt.getTime();
    if (now.getTime() - checked > config.freshnessMaxAgeMs) return 'stale';
  }

  // Depth heuristic decides complete vs incomplete for canonical entities.
  const [{ n: claimCount }] = await db
    .select({ n: count() })
    .from(claims)
    .where(and(eq(claims.subjectType, 'entity'), eq(claims.subjectId, entity.id)));
  const [{ n: timeCount }] = await db
    .select({ n: count() })
    .from(entityTimeAssociations)
    .where(eq(entityTimeAssociations.entityId, entity.id));
  const complete =
    claimCount >= config.completenessMinClaims && timeCount >= config.completenessMinTimeAssociations;
  return complete ? 'canonical_complete' : 'canonical_incomplete';
}

export async function resolveEntity(
  db: Db,
  input: ResolveInput,
  config: QueueConfig = DEFAULT_QUEUE_CONFIG,
  now: Date = new Date(),
): Promise<ResolveResult> {
  // 1) external id — strongest, non-fuzzy
  const extMatches = new Map<string, Entity>();
  for (const ext of input.externalIds ?? []) {
    const hit = await findByExternalId(db, ext.scheme as never, ext.value);
    if (hit) {
      const ent = await db.query.entities.findFirst({ where: eq(entities.id, hit.entityId) });
      if (ent) extMatches.set(ent.id, ent);
    }
  }
  if (extMatches.size === 1) {
    const entity = [...extMatches.values()][0];
    return { status: await completenessStatus(db, entity, config, now), matchedBy: 'external_id', entity };
  }
  if (extMatches.size > 1) {
    return { status: 'ambiguous_duplicate', matchedBy: 'external_id', candidateIds: [...extMatches.keys()] };
  }

  // 2) exact slug
  if (input.slug) {
    const bySlug = await db.query.entities.findFirst({ where: eq(entities.slug, input.slug) });
    if (bySlug) {
      return { status: await completenessStatus(db, bySlug, config, now), matchedBy: 'slug', entity: bySlug };
    }
  }

  // 3) normalized alias/label
  const needles = new Set<string>();
  if (input.label) needles.add(normalizeText(input.label));
  for (const a of input.aliases ?? []) needles.add(normalizeText(a));
  const matched = new Map<string, Entity>();
  for (const needle of needles) {
    if (!needle) continue;
    // alias table
    const aliasHits = await findAliasMatches(db, needle);
    for (const h of aliasHits) {
      const ent = await db.query.entities.findFirst({ where: eq(entities.id, h.entityId) });
      if (ent) matched.set(ent.id, ent);
    }
    // canonical labels (normalized on the fly — dataset is small)
    const all = await db.query.entities.findMany();
    for (const ent of all) {
      if (normalizeText(ent.label) === needle) matched.set(ent.id, ent);
    }
  }
  if (matched.size === 1) {
    const entity = [...matched.values()][0];
    const matchedBy = input.label && normalizeText(input.label) ? 'label' : 'alias';
    return { status: await completenessStatus(db, entity, config, now), matchedBy, entity };
  }
  if (matched.size > 1) {
    return { status: 'ambiguous_duplicate', matchedBy: 'alias', candidateIds: [...matched.keys()] };
  }

  return { status: 'absent', matchedBy: null };
}
