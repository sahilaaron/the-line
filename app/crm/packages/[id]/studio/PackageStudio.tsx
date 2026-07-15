'use client';
/**
 * Cycle 8B — the graph-native package workspace (default review surface).
 * 2D React Flow canvas + inspector + filters + accessible table fallback.
 * Node kind/state shown by glyph + text badges (never colour alone). Edits go
 * through validated, atomic server actions and may invalidate QA.
 *
 * v3 corrections: independent human/QA hold provenance on nodes AND edges; a
 * functional canonical-match editor (search + real entity id + controlled
 * status); editable dates and description; edge sources + dates; a neighbourhood
 * focus (expand/collapse) control; synthetic candidates are only present when
 * the SERVER authorized developer mode (?dev=1).
 */
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  Handle, Position, useNodesState, useEdgesState, type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import s from '../../../crm.module.css';
import {
  editItemFieldsAction, changeRelTypeAction, changeRelEndpointsAction,
  holdItemAction, rejectItemAction, correctMatchAction, searchMatchTargetsAction,
} from '../../../actions';

type GNode = {
  id: string; itemId: string; localRef: string; label: string; kind: string; role: string;
  primaryState: string; states: string[]; matchEntityId: string | null; matchStatus: string | null;
  matchSlug: string | null; matchLabel: string | null;
  synthetic: boolean; held: boolean; humanHeld: boolean; qaHeld: boolean; agentHeld: boolean; qaFlagged: boolean; decision: string; year: number | null;
  x: number; y: number; payload: Record<string, unknown>;
};
type GEdge = {
  id: string; itemId: string; localRef: string; source: string; target: string; typeKey: string;
  forwardLabel: string; inverseLabel: string; directionality: string; category: string;
  isProvisional: boolean; primaryState: string; states: string[]; confidence: number | null;
  assertionClass: string | null; held: boolean; humanHeld: boolean; qaHeld: boolean; agentHeld: boolean; disputed: boolean; qaFlagged: boolean;
  decision: string; sourceRefs: string[]; startYear: number | null; endYear: number | null; payload: Record<string, unknown>;
};
type Flag = { section: string | null; localRef: string | null; severity: string; category: string | null; explanation: string; state: string; correctiveSource: string | null };
type Vocab = { key: string; label: string; inverseLabel: string; category: string; directionality: string; isActive: boolean; isProvisional: boolean; allowedSourceKinds: string[] | null; allowedTargetKinds: string[] | null };
type PkgItem = { id: string; section: string; localRef: string; payload: Record<string, unknown> };
type MatchTarget = { id: string; label: string; slug: string; kind: string; graphStatus: string; matchStatus: string };
type StudioGraph = { nodes: GNode[]; edges: GEdge[]; flags: Flag[]; facets: { kinds: string[]; categories: string[] } };
interface StudioProps {
  graph: StudioGraph; packageId: string; packageStatus: string; qaInvalidated: boolean;
  vocabulary: Vocab[]; items: PkgItem[]; devMode: boolean;
}

const KIND_GLYPH: Record<string, string> = {
  person: '◗', organisation: '▣', place: '◆', event: '★', invention: '⬡', discovery: '✦',
  technology: '⬢', concept: '○', movement: '⇶', publication: '▤', product: '▬', law_policy: '§',
  civilisation: '⬟', period: '⌛', theme: '❖',
};
const STATE_LABEL: Record<string, string> = {
  synthetic_excluded: 'SYNTHETIC — excluded', held: 'HELD', qa_flagged: 'QA-flagged',
  canonical_match: 'confirmed match', canonical_incomplete: 'canonical (incomplete)', new_candidate: 'candidate-only',
  disputed: 'disputed', provisional: 'provisional', normal: '',
};

function kindAllowed(allowed: string[] | null, kind: string): boolean {
  return !allowed || allowed.length === 0 || allowed.includes(kind);
}
function edgeCompatible(v: Vocab, sk: string, tk: string): boolean {
  if (!v.isActive) return false;
  if (v.directionality === 'symmetric') {
    return (kindAllowed(v.allowedSourceKinds, sk) && kindAllowed(v.allowedTargetKinds, tk)) ||
           (kindAllowed(v.allowedSourceKinds, tk) && kindAllowed(v.allowedTargetKinds, sk));
  }
  return kindAllowed(v.allowedSourceKinds, sk) && kindAllowed(v.allowedTargetKinds, tk);
}

function StudioNode({ data }: { data: GNode }) {
  const shape = data.role === 'central' ? '10px' : data.matchEntityId ? '4px' : '18px';
  return (
    <div data-testid={`node-${data.localRef}`} data-state={data.primaryState}
      style={{ padding: '8px 12px', borderRadius: shape, minWidth: 120, background: '#12161f',
        border: `2px ${data.matchEntityId ? 'solid' : 'dashed'} ${data.synthetic ? '#7a3030' : data.held ? '#6a5626' : data.qaFlagged ? '#6a4a26' : data.role === 'central' ? '#3f7fd8' : '#39415a'}`,
        color: '#e8ecf3', fontSize: 12, opacity: data.synthetic ? 0.55 : 1 }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden style={{ fontSize: 14 }}>{KIND_GLYPH[data.kind] ?? '○'}</span><b style={{ fontSize: 12 }}>{data.label}</b>
      </div>
      <div style={{ fontSize: 9, color: '#8b93a3', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
        {data.kind} · {STATE_LABEL[data.primaryState]}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
const nodeTypes = { studio: StudioNode };

function chronologyPos(n: GNode): { x: number; y: number } {
  return { x: n.year != null ? (n.year - 1700) * 42 : n.x, y: n.role === 'central' ? 0 : (n.localRef.charCodeAt(0) % 6) * 90 - 200 };
}

function Canvas(props: StudioProps) {
  const { graph, packageId, packageStatus, qaInvalidated, vocabulary, items, devMode } = props;
  const [selNode, setSelNode] = useState<GNode | null>(null);
  const [selEdge, setSelEdge] = useState<GEdge | null>(null);
  const [chronology, setChronology] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showSynthetic, setShowSynthetic] = useState(false);
  const [neighbourhood, setNeighbourhood] = useState(false);
  const [kindFilter, setKindFilter] = useState<Set<string>>(new Set());
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set());
  const [stateFilter, setStateFilter] = useState<'all' | 'candidate' | 'canonical'>('all');
  const [qaOnly, setQaOnly] = useState(false);

  const kindByRef = useMemo(() => new Map(graph.nodes.map((n) => [n.localRef, n.kind])), [graph.nodes]);

  // Direct-neighbour set of the selected node (for the expand/collapse focus).
  const neighbourRefs = useMemo(() => {
    if (!selNode) return null;
    const set = new Set<string>([selNode.localRef]);
    for (const e of graph.edges) {
      if (e.source === selNode.localRef) set.add(e.target);
      if (e.target === selNode.localRef) set.add(e.source);
    }
    return set;
  }, [selNode, graph.edges]);

  const visibleNodes = useMemo(() => graph.nodes.filter((n) => {
    // Synthetic nodes only exist here in dev mode; the checkbox toggles their
    // visibility but can never introduce data the server did not authorize.
    if (n.synthetic && !showSynthetic) return false;
    if (kindFilter.size && !kindFilter.has(n.kind)) return false;
    if (qaOnly && !n.qaFlagged && !n.held) return false;
    if (stateFilter === 'candidate' && n.matchEntityId) return false;
    if (stateFilter === 'canonical' && !n.matchEntityId) return false;
    if (neighbourhood && neighbourRefs && !neighbourRefs.has(n.localRef)) return false;
    return true;
  }), [graph.nodes, showSynthetic, kindFilter, qaOnly, stateFilter, neighbourhood, neighbourRefs]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.localRef)), [visibleNodes]);

  const rfNodes: Node[] = useMemo(() => visibleNodes.map((n) => ({
    id: n.localRef, type: 'studio',
    position: chronology ? chronologyPos(n) : { x: n.x, y: n.y },
    data: n as unknown as Record<string, unknown>,
  })), [visibleNodes, chronology]);

  const rfEdges: Edge[] = useMemo(() => graph.edges
    .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
    .filter((e) => catFilter.size === 0 || catFilter.has(e.category))
    .map((e) => ({
      id: e.localRef, source: e.source, target: e.target, label: e.forwardLabel, labelShowBg: true,
      markerEnd: e.directionality === 'directed' ? { type: 'arrowclosed' as never } : undefined,
      style: { stroke: e.held ? '#e6c069' : e.qaFlagged ? '#e6a869' : e.disputed ? '#e69090' : e.isProvisional ? '#9a8fb0' : '#5a637a', strokeDasharray: e.isProvisional ? '4 3' : undefined },
      data: e as unknown as Record<string, unknown>,
    })), [graph.edges, visibleIds, catFilter]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  // Deterministically re-lay out when the projection / filters / chronology
  // change — setNodes overrides React Flow's initialized positions.
  useEffect(() => { setNodes(rfNodes); }, [rfNodes, setNodes]);
  useEffect(() => { setEdges(rfEdges); }, [rfEdges, setEdges]);

  const onNodeClick = useCallback((_: unknown, node: Node) => { setSelEdge(null); setSelNode(graph.nodes.find((n) => n.localRef === node.id) ?? null); }, [graph.nodes]);
  const onEdgeClick = useCallback((_: unknown, edge: Edge) => { setSelNode(null); setSelEdge(graph.edges.find((e) => e.localRef === edge.id) ?? null); }, [graph.edges]);

  const allKinds = graph.facets.kinds;
  const allCats = graph.facets.categories;
  const editable = ['submitted', 'qa_pending', 'qa_complete', 'in_review', 'returned'].includes(packageStatus);
  const entityRefs = graph.nodes.map((n) => n.localRef);

  return (
    <div>
      {qaInvalidated && (
        <div data-testid="qa-invalidated" className={s.card} style={{ borderColor: '#6a5626' }}>
          <b>QA is stale.</b> A candidate was edited after QA. The package is <b>qa_pending</b> — re-run QA before approval. Approval is blocked until then.
        </div>
      )}
      <div className={s.form} style={{ marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.7rem' }}>
        <button className={`${s.btn} ${s.ghost}`} onClick={() => setChronology((v) => !v)} data-testid="toggle-chronology">{chronology ? 'Radial layout' : 'Chronology layout'}</button>
        <button className={`${s.btn} ${s.ghost}`} onClick={() => setShowTable((v) => !v)} data-testid="toggle-table">{showTable ? 'Hide table' : 'Table view'}</button>
        <label className={s.muted} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.72rem' }}>
          <input type="checkbox" checked={neighbourhood} onChange={(e) => setNeighbourhood(e.target.checked)} data-testid="filter-neighbourhood" /> focus neighbourhood of selection
        </label>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value as 'all' | 'candidate' | 'canonical')} data-testid="filter-state" style={{ fontSize: '0.75rem' }}>
          <option value="all">all nodes</option><option value="candidate">candidate-only</option><option value="canonical">canonical/matched</option>
        </select>
        <label className={s.muted} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.72rem' }}>
          <input type="checkbox" checked={qaOnly} onChange={(e) => setQaOnly(e.target.checked)} data-testid="filter-qa" /> QA-flagged/held only
        </label>
        {devMode && (
          <label className={s.muted} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.72rem' }} data-testid="dev-badge">
            <input type="checkbox" checked={showSynthetic} onChange={(e) => setShowSynthetic(e.target.checked)} data-testid="filter-synthetic" /> show synthetic (dev mode)
          </label>
        )}
        <span className={s.muted} style={{ fontSize: '0.7rem' }}>kinds:</span>
        {allKinds.map((k) => (
          <label key={k} className={s.muted} style={{ display: 'flex', gap: 3, alignItems: 'center', fontSize: '0.7rem' }}>
            <input type="checkbox" checked={kindFilter.size === 0 || kindFilter.has(k)} onChange={(e) => setKindFilter((prev) => { const n = new Set(prev.size ? prev : allKinds); if (e.target.checked) n.add(k); else n.delete(k); return n; })} /> {k}
          </label>
        ))}
        <span className={s.muted} style={{ fontSize: '0.7rem' }}>rel category:</span>
        {allCats.map((c) => (
          <label key={c} className={s.muted} style={{ display: 'flex', gap: 3, alignItems: 'center', fontSize: '0.7rem' }}>
            <input type="checkbox" checked={catFilter.size === 0 || catFilter.has(c)} onChange={(e) => setCatFilter((prev) => { const n = new Set(prev.size ? prev : allCats); if (e.target.checked) n.add(c); else n.delete(c); return n; })} /> {c}
          </label>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: '0.9rem' }}>
        <div data-testid="graph-canvas" style={{ height: 580, border: '1px solid #1b1f2a', borderRadius: 10, background: '#0b0d12' }}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} fitView minZoom={0.2} maxZoom={2}>
            <Background color="#1b1f2a" gap={22} /><Controls /><MiniMap pannable zoomable style={{ background: '#10131b' }} nodeColor="#39415a" />
          </ReactFlow>
        </div>
        <aside data-testid="inspector" className={s.card} style={{ maxHeight: 580, overflow: 'auto' }}>
          {!selNode && !selEdge && <p className={s.muted}>Select a node or edge to inspect and edit it.</p>}
          {selNode && <NodeInspector node={selNode} packageId={packageId} editable={editable} items={items} flags={graph.flags} />}
          {selEdge && <EdgeInspector edge={selEdge} packageId={packageId} editable={editable} vocabulary={vocabulary} items={items} flags={graph.flags} sourceKind={kindByRef.get(selEdge.source) ?? 'concept'} targetKind={kindByRef.get(selEdge.target) ?? 'concept'} entityRefs={entityRefs} />}
        </aside>
      </div>
      {showTable && <GraphTable graph={graph} onSelectNode={(n) => { setSelEdge(null); setSelNode(n); }} onSelectEdge={(e) => { setSelNode(null); setSelEdge(e); }} />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (<div style={{ display: 'grid', gridTemplateColumns: '7.5rem 1fr', gap: '0.3rem 0.6rem', fontSize: '0.82rem', padding: '0.15rem 0' }}>
    <span className={s.muted}>{k}</span><span>{v}</span></div>);
}
/** Human, QA and agent holds are INDEPENDENT and may co-exist. */
function HoldRow({ humanHeld, qaHeld, agentHeld }: { humanHeld: boolean; qaHeld: boolean; agentHeld: boolean }) {
  if (!humanHeld && !qaHeld && !agentHeld) return <Row k="hold" v="no" />;
  return <Row k="hold" v={<span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
    {humanHeld && <span data-testid="hold-human" className={`${s.pill} ${s.hold}`}>HUMAN hold</span>}
    {qaHeld && <span data-testid="hold-qa" className={`${s.pill} ${s.hold}`}>QA hold</span>}
    {agentHeld && <span data-testid="hold-agent" className={`${s.pill} ${s.hold}`}>AGENT hold</span>}
  </span>} />;
}

/** Functional canonical-match editor. Searches VALID targets server-side
 * (non-synthetic, kind-compatible; scales — no client-side row cap). The status
 * is DERIVED from the target and shown read-only; the server re-validates. */
function MatchEditor({ node, packageId }: { node: GNode; packageId: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<MatchTarget[]>([]);
  const [selected, setSelected] = useState<MatchTarget | null>(null);
  const [pending, startTransition] = useTransition();
  const runSearch = useCallback((term: string) => {
    startTransition(async () => {
      const r = await searchMatchTargetsAction(term, node.kind);
      setResults(r);
    });
  }, [node.kind]);
  useEffect(() => { runSearch(''); }, [runSearch]);
  return (
    <div data-testid="match-editor" className={s.card} style={{ marginTop: '0.4rem', background: '#0b0e14' }}>
      <div className={s.muted} style={{ fontSize: '0.72rem', marginBottom: 3 }} data-testid="match-current">
        current: {node.matchEntityId ? <>matched <b>{node.matchLabel ?? node.matchSlug ?? node.matchEntityId}</b> ({node.matchStatus ?? 'matched'})</> : 'no canonical match'}
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); runSearch(e.target.value); }} placeholder={`search ${node.kind}-compatible canonical entities…`} data-testid="match-search" style={{ fontSize: '0.74rem', width: '100%' }} />
      <div style={{ maxHeight: 130, overflow: 'auto', margin: '0.3rem 0' }} data-testid="match-results">
        {pending && <div className={s.muted} style={{ fontSize: '0.7rem' }}>searching…</div>}
        {!pending && results.length === 0 && <div className={s.muted} style={{ fontSize: '0.7rem' }}>no compatible non-synthetic targets</div>}
        {results.map((r) => (
          <button key={r.id} type="button" onClick={() => setSelected(r)} data-testid={`match-option-${r.slug}`}
            className={`${s.btn} ${s.ghost}`} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: '0.72rem', margin: '1px 0', outline: selected?.id === r.id ? '1px solid #3f7fd8' : undefined }}>
            {r.label} · {r.slug} ({r.kind}) → {r.matchStatus}
          </button>
        ))}
      </div>
      {selected && (
        <form action={correctMatchAction} className={s.form} style={{ gap: '0.3rem' }}>
          <input type="hidden" name="packageId" value={packageId} /><input type="hidden" name="itemId" value={node.itemId} />
          <input type="hidden" name="matchEntityId" value={selected.id} /><input type="hidden" name="matchStatus" value={selected.matchStatus} />
          <span data-testid="match-selected" className={s.muted} style={{ fontSize: '0.72rem' }}>selected <b>{selected.label}</b> → {selected.matchStatus} (server-derived)</span>
          <button className={s.btn} type="submit" data-testid="save-match">Save match</button>
        </form>
      )}
      <form action={correctMatchAction} style={{ marginTop: '0.3rem' }}>
        <input type="hidden" name="packageId" value={packageId} /><input type="hidden" name="itemId" value={node.itemId} />
        <input type="hidden" name="matchEntityId" value="" /><input type="hidden" name="matchStatus" value="no_match" />
        <button className={`${s.btn} ${s.ghost}`} type="submit" data-testid="clear-match">Clear match</button>
      </form>
      <p className={s.muted} style={{ fontSize: '0.66rem', marginTop: '0.3rem' }}>Only non-synthetic, kind-compatible entities are searchable; the match status is derived from the target and re-validated server-side.</p>
    </div>
  );
}

function NodeInspector({ node, packageId, editable, items, flags }: { node: GNode; packageId: string; editable: boolean; items: PkgItem[]; flags: Flag[] }) {
  const p = node.payload as { slug?: string; aliases?: { alias: string }[]; shortDescription?: string; externalIds?: { scheme: string; value: string }[] };
  const claims = items.filter((i) => i.section === 'claim' && (i.payload as { subjectRef?: string }).subjectRef === node.localRef);
  const srcRefs = new Set(claims.flatMap((c) => ((c.payload as { sourceLinks?: { sourceRef: string }[] }).sourceLinks ?? []).map((l) => l.sourceRef)));
  const sources = items.filter((i) => i.section === 'source' && srcRefs.has(i.localRef));
  const questions = items.filter((i) => i.section === 'question' && (i.payload as { relatedRef?: string }).relatedRef === node.localRef);
  const times = items.filter((i) => i.section === 'time' && (i.payload as { entityRef?: string }).entityRef === node.localRef);
  const nodeFlags = flags.filter((f) => f.section === 'entity' && f.localRef === node.localRef);
  return (
    <div>
      <h3 data-testid="inspector-title" className={s.h} style={{ marginTop: 0 }}>{node.label}</h3>
      <div style={{ marginBottom: '0.4rem' }}>{node.states.map((st) => <span key={st} className={s.pill}>{STATE_LABEL[st] ?? st}</span>)}</div>
      <Row k="slug" v={p.slug ?? '—'} /><Row k="kind" v={node.kind} />
      <Row k="aliases" v={(p.aliases ?? []).map((a) => a.alias).join(', ') || '—'} />
      <Row k="external ids" v={(p.externalIds ?? []).map((x) => `${x.scheme}:${x.value}`).join(', ') || '—'} />
      <Row k="description" v={p.shortDescription ?? <span className={s.muted}>— (no evidence)</span>} />
      <Row k="canonical match" v={node.matchEntityId
        ? <span>{node.matchStatus ?? 'matched'} · {node.matchSlug ? <Link href={`/crm/entities/${node.matchSlug}`} data-testid="match-link">{node.matchLabel ?? node.matchSlug} →</Link> : node.matchLabel ?? node.matchEntityId}</span>
        : 'none (new candidate)'} />
      <Row k="dates" v={times.length ? times.map((t) => `${(t.payload as { role?: string }).role} ${(t.payload as { startYear?: number }).startYear}`).join(', ') : <span className={s.muted}>— (none)</span>} />
      <Row k="decision" v={node.decision} /><HoldRow humanHeld={node.humanHeld} qaHeld={node.qaHeld} agentHeld={node.agentHeld} />
      <Row k="provenance" v={`package item · ${node.localRef}`} />
      <div style={{ marginTop: '0.4rem' }}>
        <b className={s.muted} style={{ fontSize: '0.72rem' }}>claims ({claims.length})</b>
        {claims.map((c) => <div key={c.id} className={s.muted} style={{ fontSize: '0.76rem' }}>• {(c.payload as { text?: string }).text}</div>)}
        <b className={s.muted} style={{ fontSize: '0.72rem' }}>sources ({sources.length})</b>
        {sources.length === 0 && <div className={s.muted} style={{ fontSize: '0.72rem' }}>— (no citations)</div>}
        {sources.map((c) => <div key={c.id} className={s.muted} style={{ fontSize: '0.76rem' }}>↳ {(c.payload as { title?: string }).title}</div>)}
        {nodeFlags.length > 0 && <><b className={s.muted} style={{ fontSize: '0.72rem' }}>QA flags</b>
          {nodeFlags.map((f, i) => <div key={i} className={`${s.pill} ${s.hold}`} style={{ display: 'block', margin: '2px 0' }}>{f.severity}: {f.explanation}</div>)}</>}
        {questions.length > 0 && <><b className={s.muted} style={{ fontSize: '0.72rem' }}>unresolved</b>
          {questions.map((q) => <div key={q.id} className={s.muted} style={{ fontSize: '0.76rem' }}>? {(q.payload as { detail?: string }).detail}</div>)}</>}
      </div>
      {editable && (
        <div className={s.card} style={{ marginTop: '0.5rem', background: '#0b0e14' }}>
          <form action={editItemFieldsAction} className={s.form} style={{ gap: '0.35rem' }}>
            <input type="hidden" name="packageId" value={packageId} /><input type="hidden" name="itemId" value={node.itemId} /><input type="hidden" name="field" value="label" />
            <input name="value" defaultValue={node.label} data-testid="edit-node-label" style={{ fontSize: '0.78rem' }} />
            <button className={s.btn} type="submit" data-testid="save-node">Save label</button>
          </form>
          <form action={editItemFieldsAction} className={s.form} style={{ gap: '0.35rem', marginTop: '0.35rem' }}>
            <input type="hidden" name="packageId" value={packageId} /><input type="hidden" name="itemId" value={node.itemId} /><input type="hidden" name="field" value="shortDescription" />
            <input name="value" defaultValue={p.shortDescription ?? ''} placeholder="short description" data-testid="edit-node-description" style={{ fontSize: '0.76rem' }} />
            <button className={`${s.btn} ${s.ghost}`} type="submit" data-testid="save-node-description">Save description</button>
          </form>
          {times.map((t) => (
            <form key={t.id} action={editItemFieldsAction} className={s.form} style={{ gap: '0.3rem', marginTop: '0.35rem', alignItems: 'center' }}>
              <input type="hidden" name="packageId" value={packageId} /><input type="hidden" name="itemId" value={t.id} /><input type="hidden" name="field" value="startYear" />
              <span className={s.muted} style={{ fontSize: '0.7rem' }}>{(t.payload as { role?: string }).role} year</span>
              <input name="value" type="number" defaultValue={String((t.payload as { startYear?: number }).startYear ?? '')} data-testid="edit-node-date" style={{ fontSize: '0.74rem', width: '5rem' }} />
              <button className={`${s.btn} ${s.ghost}`} type="submit" data-testid="save-node-date">Save year</button>
            </form>
          ))}
          <MatchEditor node={node} packageId={packageId} />
          <form action={holdItemAction} style={{ marginTop: '0.35rem' }}>
            <input type="hidden" name="packageId" value={packageId} /><input type="hidden" name="itemId" value={node.itemId} /><input type="hidden" name="held" value={(!node.humanHeld).toString()} />
            <button className={`${s.btn} ${s.ghost}`} type="submit" data-testid="hold-node">{node.humanHeld ? 'Remove human hold' : 'Human hold'} node</button>
          </form>
          <p className={s.muted} style={{ fontSize: '0.68rem', marginTop: '0.3rem' }}>Field/date/match edits are validated, atomic, audited, and invalidate QA. A human hold is independent of any QA hold.</p>
        </div>
      )}
    </div>
  );
}

function EdgeInspector({ edge, packageId, editable, vocabulary, items, flags, sourceKind, targetKind, entityRefs }: { edge: GEdge; packageId: string; editable: boolean; vocabulary: Vocab[]; items: PkgItem[]; flags: Flag[]; sourceKind: string; targetKind: string; entityRefs: string[] }) {
  const claims = items.filter((i) => i.section === 'claim' && (i.payload as { subjectSection?: string; subjectRef?: string }).subjectSection === 'relationship' && (i.payload as { subjectRef?: string }).subjectRef === edge.localRef);
  const edgeFlags = flags.filter((f) => f.section === 'relationship' && f.localRef === edge.localRef);
  const sources = items.filter((i) => i.section === 'source' && edge.sourceRefs.includes(i.localRef));
  const compatible = vocabulary.filter((v) => edgeCompatible(v, sourceKind, targetKind));
  return (
    <div>
      <h3 data-testid="inspector-title" className={s.h} style={{ marginTop: 0 }}>{edge.forwardLabel}</h3>
      <div style={{ marginBottom: '0.4rem' }}>{edge.states.map((st) => <span key={st} className={s.pill}>{STATE_LABEL[st] ?? st}</span>)}
        {edge.isProvisional && <span data-testid="provisional-warning" className={`${s.pill} ${s.hold}`}>imprecise — refine later</span>}</div>
      <Row k="type" v={edge.typeKey} /><Row k="forward" v={edge.forwardLabel} /><Row k="inverse" v={edge.inverseLabel} />
      <Row k="direction" v={edge.directionality} /><Row k="source → target" v={`${edge.source} (${sourceKind}) → ${edge.target} (${targetKind})`} />
      <Row k="category" v={edge.category} /><Row k="confidence" v={edge.confidence ?? '—'} /><Row k="assertion" v={edge.assertionClass ?? '—'} />
      <Row k="dates" v={<span data-testid="edge-dates">{edge.startYear != null ? `${edge.startYear}${edge.endYear != null ? `–${edge.endYear}` : ''}` : <span className={s.muted}>— (none)</span>}</span>} />
      <Row k="disputed" v={edge.disputed ? 'yes' : 'no'} /><HoldRow humanHeld={edge.humanHeld} qaHeld={edge.qaHeld} agentHeld={edge.agentHeld} />
      <Row k="endpoint valid" v={compatible.some((v) => v.key === edge.typeKey) ? <span className={`${s.pill} ${s.ok}`}>ok</span> : <span className={`${s.pill} ${s.warn}`} data-testid="endpoint-invalid">incompatible endpoints</span>} />
      <Row k="sources" v={<span data-testid="edge-sources">{sources.length ? sources.map((c) => (c.payload as { title?: string }).title).join('; ') : <span className={s.muted}>— (no citations)</span>}</span>} />
      <Row k="provenance" v={`package item · ${edge.localRef}`} />
      {claims.length > 0 && <div style={{ marginTop: '0.3rem' }}><b className={s.muted} style={{ fontSize: '0.72rem' }}>claims</b>{claims.map((c) => <div key={c.id} className={s.muted} style={{ fontSize: '0.76rem' }}>• {(c.payload as { text?: string }).text}</div>)}</div>}
      {edgeFlags.length > 0 && <div>{edgeFlags.map((f, i) => <div key={i} className={`${s.pill} ${s.hold}`} style={{ display: 'block', margin: '2px 0' }}>QA: {f.explanation}</div>)}</div>}
      {editable && (
        <div className={s.card} style={{ marginTop: '0.5rem', background: '#0b0e14' }}>
          <form action={changeRelTypeAction} className={s.form} style={{ gap: '0.35rem' }}>
            <input type="hidden" name="packageId" value={packageId} /><input type="hidden" name="itemId" value={edge.itemId} />
            <select name="typeKey" defaultValue={edge.typeKey} data-testid="edit-edge-type" style={{ fontSize: '0.76rem' }}>
              {compatible.map((v) => <option key={v.key} value={v.key}>{v.key} — {v.label}</option>)}
            </select>
            <button className={s.btn} type="submit" data-testid="save-edge-type">Change type</button>
          </form>
          <form action={changeRelEndpointsAction} className={s.form} style={{ gap: '0.3rem', marginTop: '0.35rem' }}>
            <input type="hidden" name="packageId" value={packageId} /><input type="hidden" name="itemId" value={edge.itemId} />
            <select name="sourceRef" defaultValue={edge.source} data-testid="edit-edge-source" style={{ fontSize: '0.74rem' }}>{entityRefs.map((r) => <option key={r} value={r}>{r}</option>)}</select>
            <select name="targetRef" defaultValue={edge.target} data-testid="edit-edge-target" style={{ fontSize: '0.74rem' }}>{entityRefs.map((r) => <option key={r} value={r}>{r}</option>)}</select>
            <button className={`${s.btn} ${s.ghost}`} type="submit" data-testid="save-endpoints">Change endpoints</button>
          </form>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
            <form action={holdItemAction}><input type="hidden" name="packageId" value={packageId} /><input type="hidden" name="itemId" value={edge.itemId} /><input type="hidden" name="held" value={(!edge.humanHeld).toString()} />
              <button className={`${s.btn} ${s.ghost}`} type="submit" data-testid="hold-edge">{edge.humanHeld ? 'Remove human hold' : 'Human hold'} edge</button></form>
            <form action={rejectItemAction}><input type="hidden" name="packageId" value={packageId} /><input type="hidden" name="itemId" value={edge.itemId} />
              <button className={`${s.btn} ${s.danger}`} type="submit" data-testid="reject-edge">Reject edge</button></form>
          </div>
          <p className={s.muted} style={{ fontSize: '0.68rem', marginTop: '0.3rem' }}>Type/endpoint changes are validated against the vocabulary, atomic, audited, and invalidate QA. The dropdown shows only types compatible with {sourceKind}→{targetKind}; the server is the final authority.</p>
        </div>
      )}
    </div>
  );
}

function GraphTable({ graph, onSelectNode, onSelectEdge }: { graph: StudioGraph; onSelectNode: (n: GNode) => void; onSelectEdge: (e: GEdge) => void }) {
  return (
    <div data-testid="graph-table" className={s.card} style={{ marginTop: '0.8rem' }}>
      <h3 className={s.h} style={{ marginTop: 0 }}>Accessible table (same graph — rows select the node/edge)</h3>
      <b className={s.muted}>Nodes</b>
      <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
        <thead><tr style={{ textAlign: 'left', color: '#7f8798' }}><th>ref</th><th>label</th><th>kind</th><th>state</th><th>match</th></tr></thead>
        <tbody>{graph.nodes.map((n) => <tr key={n.id} data-testid={`table-node-${n.localRef}`} onClick={() => onSelectNode(n)} style={{ cursor: 'pointer' }}><td>{n.localRef}</td><td>{n.label}</td><td>{n.kind}</td><td>{n.primaryState}</td><td>{n.matchSlug ?? (n.matchEntityId ? (n.matchStatus ?? 'matched') : '—')}</td></tr>)}</tbody>
      </table>
      <b className={s.muted}>Edges</b>
      <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
        <thead><tr style={{ textAlign: 'left', color: '#7f8798' }}><th>source</th><th>label</th><th>target</th><th>direction</th><th>state</th></tr></thead>
        <tbody>{graph.edges.map((e) => <tr key={e.id} data-testid={`table-edge-${e.localRef}`} onClick={() => onSelectEdge(e)} style={{ cursor: 'pointer' }}><td>{e.source}</td><td>{e.forwardLabel}</td><td>{e.target}</td><td>{e.directionality}</td><td>{e.primaryState}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export default function PackageStudio(props: StudioProps) {
  return (<ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>);
}
