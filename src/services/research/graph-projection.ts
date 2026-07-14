/**
 * Cycle 8B — project a research package into a graph model for the Studio
 * canvas (and the accessible table fallback). Pure read: candidate entities +
 * canonical matches become nodes; candidate relationships become directional,
 * labelled edges. Deterministic initial layout (sorted by localRef) so the
 * same package always renders the same. QA flags, hold, synthetic, dispute and
 * match state are surfaced as machine-readable node/edge states (never
 * colour-only in the UI).
 */
import { eq, inArray } from 'drizzle-orm';
import {
  entities,
  qaFlags,
  researchPackageItems,
  researchPackages,
} from '../../db/schema';
import type { Db } from '../../db/repositories/types';
import { listRelationshipTypes } from '../../db/repositories/graph-ext';

export type NodeState =
  | 'synthetic_excluded' | 'held' | 'qa_flagged'
  | 'canonical_match' | 'canonical_incomplete' | 'new_candidate';
export type EdgeState = 'held' | 'qa_flagged' | 'disputed' | 'provisional' | 'normal';

export interface GraphNode {
  id: string;
  itemId: string;
  localRef: string;
  label: string;
  kind: string;
  role: 'central' | 'connected';
  states: NodeState[];
  primaryState: NodeState;
  matchEntityId: string | null;
  matchStatus: string | null;
  matchSlug: string | null;
  matchLabel: string | null;
  synthetic: boolean;
  held: boolean;
  holdSource: string | null;
  qaFlagged: boolean;
  decision: string;
  year: number | null;
  x: number;
  y: number;
  payload: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  itemId: string;
  localRef: string;
  source: string;
  target: string;
  typeKey: string;
  forwardLabel: string;
  inverseLabel: string;
  directionality: 'directed' | 'symmetric';
  category: string;
  isProvisional: boolean;
  states: EdgeState[];
  primaryState: EdgeState;
  confidence: number | null;
  assertionClass: string | null;
  held: boolean;
  disputed: boolean;
  qaFlagged: boolean;
  decision: string;
  payload: Record<string, unknown>;
}

export interface PackageQaFlag {
  section: string | null; localRef: string | null; severity: string; category: string | null;
  explanation: string; state: string; correctiveSource: string | null;
}
export interface PackageGraph {
  package: { id: string; centralLabel: string; centralSlug: string; status: string; lastEditedAt: string | null };
  nodes: GraphNode[];
  edges: GraphEdge[];
  flags: PackageQaFlag[];
  facets: { kinds: string[]; categories: string[] };
}

function nodePrimaryState(n: { synthetic: boolean; held: boolean; qaFlagged: boolean; matchEntityId: string | null; matchStatus: string | null }): NodeState {
  if (n.synthetic) return 'synthetic_excluded';
  if (n.held) return 'held';
  if (n.qaFlagged) return 'qa_flagged';
  if (n.matchEntityId) return n.matchStatus === 'canonical_incomplete' ? 'canonical_incomplete' : 'canonical_match';
  return 'new_candidate';
}

export async function projectPackageGraph(db: Db, packageId: string): Promise<PackageGraph | undefined> {
  const pkg = await db.query.researchPackages.findFirst({ where: eq(researchPackages.id, packageId) });
  if (!pkg) return undefined;
  const items = (await db.query.researchPackageItems.findMany({ where: eq(researchPackageItems.packageId, packageId) }));
  const flags = await db.query.qaFlags.findMany({ where: eq(qaFlags.packageId, packageId) });
  const registry = await listRelationshipTypes(db);
  const regByKey = new Map(registry.map((r) => [r.key, r]));
  const matchIds = [...new Set(items.filter((i) => i.section === 'entity' && i.matchEntityId).map((i) => i.matchEntityId!))];
  const matchedEntities = matchIds.length ? await db.query.entities.findMany({ where: inArray(entities.id, matchIds) }) : [];
  const matchById = new Map(matchedEntities.map((e) => [e.id, e]));
  const flaggedKeys = new Set(flags.filter((f) => f.targetSection && f.targetRef).map((f) => `${f.targetSection} ${f.targetRef}`));

  const entityItems = items.filter((i) => i.section === 'entity').sort((a, b) => a.localRef.localeCompare(b.localRef));
  const timeItems = items.filter((i) => i.section === 'time');
  const relItems = items.filter((i) => i.section === 'relationship').sort((a, b) => a.localRef.localeCompare(b.localRef));

  // earliest year per entity ref (for the chronology-layout toggle)
  const yearByRef = new Map<string, number>();
  for (const t of timeItems) {
    const p = t.payload as { entityRef?: string; startYear?: number };
    if (p.entityRef && typeof p.startYear === 'number') {
      const cur = yearByRef.get(p.entityRef);
      if (cur == null || p.startYear < cur) yearByRef.set(p.entityRef, p.startYear);
    }
  }

  const kinds = new Set<string>();
  const nodes: GraphNode[] = entityItems.map((it, idx) => {
    const p = it.payload as { role?: string; label?: string; kind?: string; classifications?: string[] };
    const kind = p.kind ?? p.classifications?.[0] ?? 'concept';
    kinds.add(kind);
    const role: 'central' | 'connected' = p.role === 'central' ? 'central' : 'connected';
    const qaFlagged = flaggedKeys.has(`entity ${it.localRef}`);
    const base = { synthetic: it.isSynthetic, held: it.held, qaFlagged, matchEntityId: it.matchEntityId, matchStatus: it.matchStatus };
    const primaryState = nodePrimaryState(base);
    const states: NodeState[] = [];
    if (it.isSynthetic) states.push('synthetic_excluded');
    if (it.held) states.push('held');
    if (qaFlagged) states.push('qa_flagged');
    if (it.matchEntityId) states.push(it.matchStatus === 'canonical_incomplete' ? 'canonical_incomplete' : 'canonical_match');
    if (!it.matchEntityId && !it.isSynthetic) states.push('new_candidate');
    // deterministic radial layout: central at origin, others on a ring.
    let x = 0, y = 0;
    if (role !== 'central') {
      const connectedCount = Math.max(1, entityItems.filter((e) => (e.payload as { role?: string }).role !== 'central').length);
      const ring = entityItems.filter((e) => (e.payload as { role?: string }).role !== 'central').findIndex((e) => e.localRef === it.localRef);
      const angle = (2 * Math.PI * ring) / connectedCount;
      const radius = 320;
      x = Math.round(Math.cos(angle) * radius);
      y = Math.round(Math.sin(angle) * radius);
    }
    void idx;
    return {
      id: it.localRef, itemId: it.id, localRef: it.localRef, label: p.label ?? it.localRef, kind, role,
      states, primaryState, matchEntityId: it.matchEntityId, matchStatus: it.matchStatus,
      matchSlug: it.matchEntityId ? matchById.get(it.matchEntityId)?.slug ?? null : null,
      matchLabel: it.matchEntityId ? matchById.get(it.matchEntityId)?.label ?? null : null,
      synthetic: it.isSynthetic, held: it.held, holdSource: it.holdSource, qaFlagged, decision: it.decision,
      year: yearByRef.get(it.localRef) ?? null, x, y, payload: it.payload,
    };
  });

  const categories = new Set<string>();
  const edges: GraphEdge[] = relItems.map((it) => {
    const p = it.payload as { sourceRef: string; targetRef: string; typeKey: string; confidence?: number; assertionClass?: string; disputed?: boolean };
    const reg = regByKey.get(p.typeKey);
    const category = reg?.category ?? 'general';
    categories.add(category);
    const qaFlagged = flaggedKeys.has(`relationship ${it.localRef}`);
    const disputed = !!p.disputed;
    const isProvisional = reg?.isProvisional ?? p.typeKey === 'associated_with';
    const states: EdgeState[] = [];
    if (it.held) states.push('held');
    if (qaFlagged) states.push('qa_flagged');
    if (disputed) states.push('disputed');
    if (isProvisional) states.push('provisional');
    if (states.length === 0) states.push('normal');
    const primaryState: EdgeState = it.held ? 'held' : qaFlagged ? 'qa_flagged' : disputed ? 'disputed' : isProvisional ? 'provisional' : 'normal';
    return {
      id: it.localRef, itemId: it.id, localRef: it.localRef, source: p.sourceRef, target: p.targetRef,
      typeKey: p.typeKey, forwardLabel: reg?.label ?? p.typeKey, inverseLabel: reg?.inverseLabel ?? p.typeKey,
      directionality: (reg?.directionality ?? 'directed') as 'directed' | 'symmetric', category, isProvisional,
      states, primaryState, confidence: p.confidence ?? null, assertionClass: p.assertionClass ?? null,
      held: it.held, disputed, qaFlagged, decision: it.decision, payload: it.payload,
    };
  });

  return {
    package: { id: pkg.id, centralLabel: pkg.centralLabel, centralSlug: pkg.centralSlug, status: pkg.status, lastEditedAt: pkg.lastEditedAt ? pkg.lastEditedAt.toISOString() : null },
    nodes, edges,
    flags: flags.map((f) => ({ section: f.targetSection, localRef: f.targetRef, severity: f.severity, category: f.category, explanation: f.explanation, state: f.state, correctiveSource: f.correctiveSource })),
    facets: { kinds: [...kinds].sort(), categories: [...categories].sort() },
  };
}
