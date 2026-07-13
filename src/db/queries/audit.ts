/**
 * Integrity audit. Read-only: never mutates data. Returns totals, warnings,
 * errors. CI-suitable: callers should exit non-zero when `errors.length >
 * 0`. Dense-node threshold and acyclic-type list are documented constants
 * below (also see docs/database/data-integrity-rules.md).
 */
import { ACYCLIC_EXPECTED_RELATIONSHIP_TYPES } from '../schema';
import type { Db } from '../repositories/types';

/** Above this total (in-degree + out-degree) a node is flagged as a warning
 * for review, not an error — dense hubs are plausible in real history but
 * worth a human look. Chosen as a round number well above what a modest
 * prototype/curated dataset would produce organically. */
export const DENSE_NODE_THRESHOLD = 200;

export interface AuditIssue {
  code: string;
  message: string;
  subjectId?: string;
}

export interface AuditReport {
  totals: Record<string, number>;
  warnings: AuditIssue[];
  errors: AuditIssue[];
}

export async function runIntegrityAudit(db: Db): Promise<AuditReport> {
  const warnings: AuditIssue[] = [];
  const errors: AuditIssue[] = [];

  const [allEntities, allPeriods, allRelationships, allClaims, allMedia, allMediaAssociations, allYolCompositions, allYolThemes, allYolTimelinePoints, allYolPointThemes] =
    await Promise.all([
      db.query.entities.findMany(),
      db.query.periods.findMany(),
      db.query.relationships.findMany(),
      db.query.claims.findMany(),
      db.query.media.findMany(),
      db.query.mediaAssociations.findMany(),
      db.query.yolCompositions.findMany(),
      db.query.yolThemes.findMany(),
      db.query.yolTimelinePoints.findMany(),
      db.query.yolPointThemes.findMany(),
    ]);

  const entityIds = new Set(allEntities.map((e) => e.id));
  const periodIds = new Set(allPeriods.map((p) => p.id));
  const relationshipIds = new Set(allRelationships.map((r) => r.id));

  // --- duplicate slugs ---
  const slugCounts = new Map<string, number>();
  for (const e of allEntities) slugCounts.set(e.slug, (slugCounts.get(e.slug) ?? 0) + 1);
  for (const [slug, n] of slugCounts) {
    if (n > 1) errors.push({ code: 'duplicate_entity_slug', message: `slug "${slug}" used by ${n} entities` });
  }

  // --- duplicate edges (source,target,type) — defense in depth vs the unique constraint ---
  const edgeCounts = new Map<string, number>();
  for (const r of allRelationships) {
    const key = `${r.sourceEntityId}|${r.targetEntityId}|${r.type}`;
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }
  for (const [key, n] of edgeCounts) {
    if (n > 1) errors.push({ code: 'duplicate_relationship', message: `duplicate edge ${key} (${n}x)` });
  }

  // --- invalid time ranges ---
  for (const p of allPeriods) {
    if (p.startYear !== null && p.endYear !== null && p.startYear > p.endYear) {
      errors.push({ code: 'invalid_period_range', message: `period ${p.slug ?? p.id} has startYear > endYear`, subjectId: p.id });
    }
  }

  // --- relationships referencing archived/missing entities ---
  for (const r of allRelationships) {
    if (!entityIds.has(r.sourceEntityId) || !entityIds.has(r.targetEntityId)) {
      errors.push({ code: 'orphaned_relationship', message: `relationship ${r.id} references a missing entity`, subjectId: r.id });
    }
  }
  const archivedEntityIds = new Set(allEntities.filter((e) => e.editorialStatus === 'archived').map((e) => e.id));
  for (const r of allRelationships) {
    if (archivedEntityIds.has(r.sourceEntityId) || archivedEntityIds.has(r.targetEntityId)) {
      warnings.push({ code: 'relationship_references_archived_entity', message: `relationship ${r.id} touches an archived entity`, subjectId: r.id });
    }
  }

  // --- claims without sources where verification status requires them ---
  const allClaimSourceLinks = await db.query.claimSources.findMany();
  const claimIdsWithSource = new Set(allClaimSourceLinks.map((l) => l.claimId));
  for (const c of allClaims) {
    if ((c.verificationStatus === 'verified' || c.verificationStatus === 'corroborated') && !claimIdsWithSource.has(c.id)) {
      errors.push({ code: 'claim_missing_required_source', message: `claim ${c.id} is "${c.verificationStatus}" but has no linked source`, subjectId: c.id });
    }
  }

  // --- claim/period/relationship polymorphic subject orphans ---
  for (const c of allClaims) {
    const exists =
      c.subjectType === 'entity'
        ? entityIds.has(c.subjectId)
        : c.subjectType === 'relationship'
          ? relationshipIds.has(c.subjectId)
          : periodIds.has(c.subjectId);
    if (!exists) {
      errors.push({ code: 'orphaned_claim_subject', message: `claim ${c.id} references missing ${c.subjectType} ${c.subjectId}`, subjectId: c.id });
    }
  }

  // --- media marked publishable without a clear rights status ---
  for (const m of allMedia) {
    if (m.isPublicDomain && m.rightsStatus === 'unknown') {
      errors.push({ code: 'media_publishable_without_rights_status', message: `media ${m.id} is marked public domain but rightsStatus is "unknown"`, subjectId: m.id });
    }
    if (m.licence && !m.isSynthetic && m.rightsStatus !== 'public_domain' && m.rightsStatus !== 'cleared') {
      errors.push({ code: 'media_licence_without_clearance', message: `media ${m.id} claims a licence without cleared/public_domain rights (and is not synthetic)`, subjectId: m.id });
    }
  }
  const mediaIds = new Set(allMedia.map((m) => m.id));
  for (const a of allMediaAssociations) {
    if (!mediaIds.has(a.mediaId)) {
      errors.push({ code: 'orphaned_media_association', message: `media association ${a.id} references missing media ${a.mediaId}` });
    }
  }

  // --- published YoL compositions missing themes ---
  const yolThemeCounts = new Map<string, number>();
  for (const t of allYolThemes) yolThemeCounts.set(t.yolId, (yolThemeCounts.get(t.yolId) ?? 0) + 1);
  for (const y of allYolCompositions) {
    if (y.editorialStatus === 'published' && !((yolThemeCounts.get(y.id) ?? 0) > 0)) {
      errors.push({ code: 'published_yol_missing_themes', message: `YoL composition ${y.id} is published but has no active themes`, subjectId: y.id });
    }
  }

  // --- YoL local chronology integrity ---
  const entityIndex = new Map(allEntities.map((e) => [e.id, e]));
  const periodIndex = new Map(allPeriods.map((p) => [p.id, p]));
  const themeYolByRowId = new Map(allYolThemes.map((t) => [t.id, t.yolId]));
  const pointById = new Map(allYolTimelinePoints.map((p) => [p.id, p]));
  for (const p of allYolTimelinePoints) {
    if (p.entityId && !entityIndex.has(p.entityId)) {
      errors.push({ code: 'orphaned_timeline_point_entity', message: `timeline point ${p.id} references missing entity ${p.entityId}`, subjectId: p.id });
    }
    if (p.periodId && !periodIndex.has(p.periodId)) {
      errors.push({ code: 'orphaned_timeline_point_period', message: `timeline point ${p.id} references missing period ${p.periodId}`, subjectId: p.id });
    }
    if (!p.isSynthetic) {
      const ent = p.entityId ? entityIndex.get(p.entityId) : undefined;
      const per = p.periodId ? periodIndex.get(p.periodId) : undefined;
      if (ent?.isSynthetic) {
        errors.push({ code: 'timeline_point_synthetic_leak', message: `non-synthetic timeline point ${p.id} references synthetic entity ${p.entityId}`, subjectId: p.id });
      }
      if (per?.isSynthetic) {
        errors.push({ code: 'timeline_point_synthetic_leak', message: `non-synthetic timeline point ${p.id} references synthetic period ${p.periodId}`, subjectId: p.id });
      }
    }
    if (p.role === 'development' && !p.entityId) {
      warnings.push({ code: 'timeline_point_missing_subject', message: `development point ${p.id} has no entity subject`, subjectId: p.id });
    }
  }
  for (const pt of allYolPointThemes) {
    const point = pointById.get(pt.pointId);
    const themeYol = themeYolByRowId.get(pt.yolThemeId);
    if (point && themeYol && point.yolId !== themeYol) {
      errors.push({ code: 'timeline_point_theme_cross_composition', message: `point theme ${pt.id} links point ${pt.pointId} to a theme of another composition`, subjectId: pt.id });
    }
  }

  // --- unreachable entities (no relationships at all) ---
  const connected = new Set<string>();
  for (const r of allRelationships) {
    connected.add(r.sourceEntityId);
    connected.add(r.targetEntityId);
  }
  const unreachable = allEntities.filter((e) => !connected.has(e.id));
  if (unreachable.length > 0) {
    warnings.push({ code: 'unreachable_entities', message: `${unreachable.length} entities have no relationships at all` });
  }

  // --- suspiciously dense nodes ---
  const degree = new Map<string, number>();
  for (const r of allRelationships) {
    degree.set(r.sourceEntityId, (degree.get(r.sourceEntityId) ?? 0) + 1);
    degree.set(r.targetEntityId, (degree.get(r.targetEntityId) ?? 0) + 1);
  }
  for (const [entityId, d] of degree) {
    if (d > DENSE_NODE_THRESHOLD) {
      warnings.push({ code: 'dense_node', message: `entity ${entityId} has degree ${d} (> ${DENSE_NODE_THRESHOLD})`, subjectId: entityId });
    }
  }

  // --- Cycle 8A: relationship registry integrity (load once) ---
  const registry = await db.query.relationshipTypeRegistry.findMany();
  const registryKeys = new Set(registry.map((r) => r.key));
  const acyclicKeys = new Set<string>([
    ...ACYCLIC_EXPECTED_RELATIONSHIP_TYPES,
    ...registry.filter((r) => r.isAcyclic).map((r) => r.key),
  ]);
  const relTypeOf = (r: (typeof allRelationships)[number]): string | null => r.typeKey ?? r.type ?? null;

  // Every relationship must carry a type (enum) or a registry typeKey.
  for (const r of allRelationships) {
    if (r.type == null && r.typeKey == null) {
      errors.push({
        code: 'relationship_missing_type',
        message: `relationship ${r.id} has neither a type nor a typeKey`,
        subjectId: r.id,
      });
    }
    if (r.typeKey && !registryKeys.has(r.typeKey)) {
      errors.push({
        code: 'unknown_relationship_type_key',
        message: `relationship ${r.id} uses unregistered type key "${r.typeKey}"`,
        subjectId: r.id,
      });
    }
  }

  // --- cycles in expected-acyclic relationship types (registry-driven) ---
  for (const type of acyclicKeys) {
    const edges = allRelationships.filter((r) => relTypeOf(r) === type);
    const adjacency = new Map<string, string[]>();
    for (const e of edges) {
      if (!adjacency.has(e.sourceEntityId)) adjacency.set(e.sourceEntityId, []);
      adjacency.get(e.sourceEntityId)!.push(e.targetEntityId);
    }
    const WHITE = 0,
      GRAY = 1,
      BLACK = 2;
    const color = new Map<string, number>();
    const cycleNodes: string[] = [];

    function dfs(node: string): boolean {
      color.set(node, GRAY);
      for (const next of adjacency.get(node) ?? []) {
        const c = color.get(next) ?? WHITE;
        if (c === GRAY) {
          cycleNodes.push(next);
          return true;
        }
        if (c === WHITE && dfs(next)) return true;
      }
      color.set(node, BLACK);
      return false;
    }

    for (const node of adjacency.keys()) {
      if ((color.get(node) ?? WHITE) === WHITE) {
        if (dfs(node)) {
          errors.push({
            code: 'unexpected_cycle',
            message: `relationship type "${type}" is expected to be acyclic but a cycle was found involving ${cycleNodes[0]}`,
          });
          break;
        }
      }
    }
  }


  // --- Cycle 8A: a verified/corroborated claim must be a fact/interpretation,
  // never an inference/forecast masquerading as verified truth ---
  for (const c of allClaims) {
    const v = (c as { verificationStatus?: string }).verificationStatus;
    const ac = (c as { assertionClass?: string }).assertionClass;
    if ((v === 'verified' || v === 'corroborated') && (ac === 'inference' || ac === 'forecast')) {
      errors.push({
        code: 'assertion_class_violation',
        message: `claim ${c.id} is ${v} but assertion class is ${ac} (inference/forecast cannot be verified fact)`,
        subjectId: c.id,
      });
    }
  }

  const totals = {
    entities: allEntities.length,
    periods: allPeriods.length,
    relationships: allRelationships.length,
    claims: allClaims.length,
    media: allMedia.length,
    yolCompositions: allYolCompositions.length,
    yolTimelinePoints: allYolTimelinePoints.length,
  };

  return { totals, warnings, errors };
}
