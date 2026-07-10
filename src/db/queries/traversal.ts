/**
 * Bounded graph traversal over relationships. No graph DB: each hop issues
 * one indexed query per frontier entity (source_id/target_id are indexed),
 * never a full-table scan into JS. Cycle-safe via a visited-set; direction
 * and max depth are always respected and every result carries the path
 * that produced it, not just an endpoint id.
 */
import { inArray } from 'drizzle-orm';
import { relationships, type Relationship } from '../schema';
import type { Db } from '../repositories/types';

export interface TraversalOptions {
  maxDepth?: number;
  relationshipTypes?: Relationship['type'][];
  minConfidence?: number;
}

export interface TraversalStep {
  relationship: Relationship;
  entityId: string; // the entity arrived at by this step
  depth: number;
}

export interface TraversalResult {
  entityId: string;
  depth: number;
  /** Ordered path of relationship steps from the start entity to this one. */
  path: TraversalStep[];
}

function passesFilters(rel: Relationship, opts: TraversalOptions): boolean {
  if (opts.relationshipTypes && !opts.relationshipTypes.includes(rel.type)) return false;
  if (opts.minConfidence !== undefined && rel.confidence < opts.minConfidence) return false;
  return true;
}

async function walk(
  db: Db,
  startId: string,
  direction: 'forward' | 'backward',
  opts: TraversalOptions,
): Promise<TraversalResult[]> {
  const maxDepth = opts.maxDepth ?? 3;
  const visited = new Set<string>([startId]);
  const results: TraversalResult[] = [];
  let frontier: { entityId: string; path: TraversalStep[] }[] = [{ entityId: startId, path: [] }];

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const frontierIds = frontier.map((f) => f.entityId);
    const rows =
      direction === 'forward'
        ? await db.query.relationships.findMany({ where: inArray(relationships.sourceEntityId, frontierIds) })
        : await db.query.relationships.findMany({ where: inArray(relationships.targetEntityId, frontierIds) });

    const next: { entityId: string; path: TraversalStep[] }[] = [];
    // Group candidate edges by the frontier entity they extend from so we
    // can attach the correct prefix path to each.
    const pathByEntity = new Map(frontier.map((f) => [f.entityId, f.path]));

    for (const rel of rows) {
      if (!passesFilters(rel, opts)) continue;
      const fromId = direction === 'forward' ? rel.sourceEntityId : rel.targetEntityId;
      const toId = direction === 'forward' ? rel.targetEntityId : rel.sourceEntityId;
      if (visited.has(toId)) continue; // cycle guard
      const prefix = pathByEntity.get(fromId) ?? [];
      const step: TraversalStep = { relationship: rel, entityId: toId, depth };
      const path = [...prefix, step];
      results.push({ entityId: toId, depth, path });
      next.push({ entityId: toId, path });
      visited.add(toId);
    }
    frontier = next;
  }
  return results;
}

/** Walk backward (targets -> sources): what enabled/preceded this entity. */
export function ancestry(db: Db, entityId: string, opts: TraversalOptions = {}): Promise<TraversalResult[]> {
  return walk(db, entityId, 'backward', opts);
}

/** Walk forward (sources -> targets): what this entity led to. */
export function consequences(db: Db, entityId: string, opts: TraversalOptions = {}): Promise<TraversalResult[]> {
  return walk(db, entityId, 'forward', opts);
}

/** Neighbourhood within N steps, either direction, deduplicated by entity id
 * (keeps the shortest-known path per entity). */
export async function neighbourhood(
  db: Db,
  entityId: string,
  opts: TraversalOptions = {},
): Promise<TraversalResult[]> {
  const [fwd, bwd] = await Promise.all([
    consequences(db, entityId, opts),
    ancestry(db, entityId, opts),
  ]);
  const byEntity = new Map<string, TraversalResult>();
  for (const r of [...fwd, ...bwd]) {
    const existing = byEntity.get(r.entityId);
    if (!existing || r.depth < existing.depth) byEntity.set(r.entityId, r);
  }
  return [...byEntity.values()];
}

/** Bidirectional BFS shortest connection between two entities, direction-
 * agnostic (treats relationships as traversable either way for this
 * specific query, since "connection" here means "linked at all"). Returns
 * null if unreachable within maxDepth. */
export async function shortestConnection(
  db: Db,
  fromId: string,
  toId: string,
  opts: TraversalOptions = {},
): Promise<TraversalResult | null> {
  if (fromId === toId) return { entityId: toId, depth: 0, path: [] };
  const maxDepth = opts.maxDepth ?? 6;
  const visited = new Set<string>([fromId]);
  let frontier: { entityId: string; path: TraversalStep[] }[] = [{ entityId: fromId, path: [] }];

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const frontierIds = frontier.map((f) => f.entityId);
    const [outRows, inRows] = await Promise.all([
      db.query.relationships.findMany({ where: inArray(relationships.sourceEntityId, frontierIds) }),
      db.query.relationships.findMany({ where: inArray(relationships.targetEntityId, frontierIds) }),
    ]);
    const pathByEntity = new Map(frontier.map((f) => [f.entityId, f.path]));
    const next: { entityId: string; path: TraversalStep[] }[] = [];

    const candidates: { rel: Relationship; fromEntity: string; toEntity: string }[] = [
      ...outRows.map((rel) => ({ rel, fromEntity: rel.sourceEntityId, toEntity: rel.targetEntityId })),
      ...inRows.map((rel) => ({ rel, fromEntity: rel.targetEntityId, toEntity: rel.sourceEntityId })),
    ];

    for (const { rel, fromEntity, toEntity } of candidates) {
      if (!passesFilters(rel, opts)) continue;
      if (visited.has(toEntity)) continue;
      const prefix = pathByEntity.get(fromEntity) ?? [];
      const path = [...prefix, { relationship: rel, entityId: toEntity, depth }];
      if (toEntity === toId) {
        return { entityId: toEntity, depth, path };
      }
      visited.add(toEntity);
      next.push({ entityId: toEntity, path });
    }
    frontier = next;
  }
  return null;
}
