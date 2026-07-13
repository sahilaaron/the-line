/**
 * Deterministic Steam Engine proof fixture. This is CLEARLY SYNTHETIC/
 * PROVISIONAL test data — it must never be mistaken for reviewed production
 * history. It promotes into PRIVATE canonical rows only (isPlaceholder=true,
 * editorialStatus in_review/draft, never published), proving the whole
 * workflow without asserting unsourced production history. The two citations
 * used are genuine, checkable references (Watt's 1769 patent and Hills 1989),
 * so nothing here is a fabricated source.
 *
 * It exercises: one central invention; aliases + an external id; multiple
 * typed time milestones; two existing-entity matches (james-watt,
 * thomas-newcomen — seed via seedSteamEngineExistingCanon) and two new
 * connected draft entities (university-of-glasgow, separate-condenser);
 * relationships in accepted and held states; multiple claims + sources with
 * locators; one attribution ambiguity; a QA hold; suggested frontier jobs; and
 * one synthetic item that must be excluded from promotion.
 */
import type { Db } from '../../../db/repositories/types';
import { createEntity } from '../../../db/repositories/entities';
import { addAlias, addExternalId } from '../../../db/repositories/graph-ext';

export const STEAM_ENGINE_ENVELOPE = {
  schemaVersion: 1 as const,
  submittedBy: 'fixture:steam-engine',
  job: { centralTitle: 'Steam engine (provisional record)', centralUrl: 'https://en.wikipedia.org/wiki/Steam_engine' },
  entities: [
    {
      ref: 'central',
      role: 'central' as const,
      slug: 'steam-engine',
      label: 'Steam engine (provisional record)',
      kind: 'invention' as const,
      classifications: ['invention', 'technology'],
      shortDescription: 'Heat engine converting steam pressure into mechanical work (provisional record).',
      aliases: [
        { alias: 'atmospheric engine', aliasType: 'alias' as const },
        { alias: 'steam-engine', aliasType: 'spelling' as const },
      ],
      externalIds: [
        { scheme: 'wikidata' as const, value: 'Q7644' },
        { scheme: 'wikipedia' as const, value: 'Steam_engine' },
      ],
    },
    // two EXISTING matches (seeded canon)
    { ref: 'watt', role: 'connected' as const, slug: 'james-watt', label: 'James Watt', kind: 'person' as const, classifications: ['person'], matchExistingSlug: 'james-watt' },
    { ref: 'newcomen', role: 'connected' as const, slug: 'thomas-newcomen', label: 'Thomas Newcomen', kind: 'person' as const, classifications: ['person'], matchExistingSlug: 'thomas-newcomen' },
    // two NEW connected draft entities
    { ref: 'glasgow', role: 'connected' as const, slug: 'university-of-glasgow', label: 'University of Glasgow (provisional record)', kind: 'organisation' as const, classifications: ['organisation', 'institution'] },
    { ref: 'condenser', role: 'connected' as const, slug: 'separate-condenser', label: 'Separate condenser (provisional record)', kind: 'invention' as const, classifications: ['invention'] },
    // a SYNTHETIC item that must be EXCLUDED from promotion
    { ref: 'synthnode', role: 'connected' as const, slug: 'synthetic-stress-node', label: 'SYNTHETIC stress node', kind: 'concept' as const, classifications: ['concept'], isSynthetic: true },
  ],
  chronology: [
    { ref: 't-demo', entityRef: 'central', role: 'demonstrated' as const, label: 'Newcomen atmospheric engine demonstrated', startYear: 1712, precision: 'approximate' as const, confidence: 60, note: 'provisional' },
    { ref: 't-patent', entityRef: 'central', role: 'patented' as const, label: 'Watt separate-condenser patent', startYear: 1769, precision: 'exact' as const, confidence: 80 },
    { ref: 't-comm', entityRef: 'central', role: 'commercialised' as const, label: 'Boulton & Watt commercial engines', startYear: 1776, precision: 'approximate' as const, confidence: 55, note: 'provisional' },
    { ref: 't-adopt', entityRef: 'central', role: 'adopted' as const, label: 'Widening industrial adoption', startYear: 1781, endYear: 1800, precision: 'range' as const, confidence: 45, note: 'provisional' },
  ],
  connections: [
    { ref: 'rel-watt', sourceRef: 'central', targetRef: 'watt', typeKey: 'improved_by', explanation: 'Watt improved the engine with the separate condenser (provisional).', confidence: 75, strength: 70, assertionClass: 'recorded_fact' as const },
    { ref: 'rel-condenser', sourceRef: 'condenser', targetRef: 'watt', typeKey: 'developed_by', explanation: 'The separate condenser was developed by Watt (provisional).', confidence: 70, strength: 65, assertionClass: 'recorded_fact' as const },
    { ref: 'rel-glasgow', sourceRef: 'watt', targetRef: 'glasgow', typeKey: 'associated_with', explanation: 'Watt worked at the University of Glasgow (provisional).', confidence: 60, assertionClass: 'interpretation' as const },
    // HELD relationship: attribution ambiguity flagged by QA
    { ref: 'rel-newcomen', sourceRef: 'central', targetRef: 'newcomen', typeKey: 'replaced', explanation: 'The engine "replaced" the Newcomen design (attribution ambiguous).', confidence: 30, assertionClass: 'interpretation' as const },
    // relationship onto the SYNTHETIC node — must not promote (cascade)
    { ref: 'rel-synth', sourceRef: 'central', targetRef: 'synthnode', typeKey: 'associated_with', assertionClass: 'recorded_fact' as const },
  ],
  sources: [
    { ref: 'src-patent', title: 'Watt, J. (1769). Patent GB 913: A Method of Lessening the Consumption of Steam and Fuel in Fire Engines.', type: 'primary_document' as const, identifier: 'GB176900913', publicationYear: 1769 },
    { ref: 'src-hills', title: 'Hills, R. L. (1989). Power from Steam: A History of the Stationary Steam Engine. Cambridge University Press.', type: 'book' as const, identifier: 'ISBN 0-521-45834-X', publicationYear: 1989 },
  ],
  claims: [
    { ref: 'c-patent', subjectRef: 'central', subjectSection: 'entity' as const, text: 'James Watt was granted a patent for a separate-condenser steam engine in 1769.', assertionClass: 'recorded_fact' as const, confidence: 85, verification: 'verified' as const, sourceLinks: [{ sourceRef: 'src-patent', locator: 'GB 913' }] },
    { ref: 'c-condenser', subjectRef: 'central', subjectSection: 'entity' as const, text: 'The separate condenser substantially improved the thermal efficiency of the steam engine.', assertionClass: 'interpretation' as const, confidence: 70, verification: 'corroborated' as const, sourceLinks: [{ sourceRef: 'src-hills', locator: 'ch. 3' }] },
    { ref: 'c-rel', subjectRef: 'rel-watt', subjectSection: 'relationship' as const, text: 'Watt\'s improvements are attributed to the 1769 patent work.', assertionClass: 'interpretation' as const, confidence: 60, verification: 'unverified' as const, sourceLinks: [{ sourceRef: 'src-hills', locator: 'ch. 3' }] },
  ],
  media: [
    { ref: 'm-plate', subjectRef: 'central', mediaType: 'image' as const, alt: 'Placeholder plate for the steam engine (no archival image).', rightsStatus: 'unknown' as const, status: 'placeholder' as const },
  ],
  questions: [
    { ref: 'q-attribution', category: 'ambiguity' as const, detail: 'Whether Watt "invented" vs "improved" the steam engine is an attribution ambiguity; Newcomen and Watt engines coexisted.', severity: 'major' as const, relatedSection: 'relationship' as const, relatedRef: 'rel-newcomen' },
  ],
  nextEntities: [
    { ref: 'n-boulton', title: 'Matthew Boulton', reason: 'Commercial partner in Boulton & Watt; unresearched neighbour.', suggestedPriority: 40 },
    { ref: 'n-industrial', title: 'Industrial Revolution', reason: 'Broader context the engine enabled; unresearched neighbour.', suggestedPriority: 30 },
  ],
};

export const STEAM_ENGINE_QA = {
  recommendation: 'hold' as const,
  summary: 'Mostly sound; one attribution overstatement to hold.',
  toolName: 'fixture-qa',
  model: 'deterministic',
  qaRunRef: 'qa-steam-1',
  flags: [
    {
      targetSection: 'relationship' as const,
      targetRef: 'rel-newcomen',
      severity: 'major' as const,
      category: 'attribution',
      explanation: '"replaced" overstates: Newcomen and Watt engines coexisted for decades.',
      correctiveSource: 'Hills 1989, ch. 2',
      state: 'hold' as const,
    },
  ],
};

export const STEAM_ENGINE_DECISION = {
  decision: 'approve_with_holds' as const,
  reviewer: 'Sahil',
  heldItemRefs: ['rel-newcomen'],
};

/** Seed the two existing canonical entities the fixture matches against. */
export async function seedSteamEngineExistingCanon(db: Db): Promise<{ wattId: string; newcomenId: string }> {
  const watt = await createEntity(db, {
    slug: 'james-watt',
    kind: 'person',
    label: 'James Watt',
    isPlaceholder: true,
    isSynthetic: false,
    editorialStatus: 'in_review',
    graphStatus: 'canonical_incomplete',
  });
  await addAlias(db, { entityId: watt.id, alias: 'James Watt', aliasType: 'alias' });
  await addExternalId(db, { entityId: watt.id, scheme: 'wikidata', value: 'Q8447' });
  const newcomen = await createEntity(db, {
    slug: 'thomas-newcomen',
    kind: 'person',
    label: 'Thomas Newcomen',
    isPlaceholder: true,
    isSynthetic: false,
    editorialStatus: 'in_review',
    graphStatus: 'canonical_incomplete',
  });
  await addAlias(db, { entityId: newcomen.id, alias: 'Thomas Newcomen', aliasType: 'alias' });
  return { wattId: watt.id, newcomenId: newcomen.id };
}
