/**
 * Cycle 8B — controlled relationship vocabulary v1.
 *
 * The relationship-type REGISTRY (not the legacy enum) is authoritative. This
 * module is the single source of truth for the v1 controlled vocabulary: the
 * 13 original built-in keys (seeded in migration 0002) PLUS the v1 additions
 * seeded forward-only in migration 0004. Each entry carries a human forward
 * label, an inverse label, one canonical direction, a category, allowed
 * endpoint kinds, an acyclic expectation, and active/built-in/provisional
 * status. The UI renders the inverse label for the reverse reading while ONE
 * canonical direction is stored.
 *
 * Extending the vocabulary is deliberate governance: add an entry here + a
 * forward-only seed. Never a destructive enum migration.
 */
import type { NewRelationshipTypeRegistryRow } from '../schema';

export type RelationshipVocabEntry = NewRelationshipTypeRegistryRow;

/** Original 13 built-ins (already seeded in migration 0002; listed for the
 * vocabulary page + tests). */
export const BUILTIN_RELATIONSHIP_KEYS = [
  'enabled', 'influenced', 'contributed_to', 'accelerated', 'responded_to',
  'opposed', 'replaced', 'spread_through', 'developed_by', 'improved_by',
  'occurred_in', 'associated_with', 'part_of',
] as const;

/** v1 ADDITIONS — seeded forward-only in migration 0004 (isBuiltin=false). */
export const RELATIONSHIP_VOCABULARY_V1_ADDITIONS: RelationshipVocabEntry[] = [
  // Creation & attribution (canonical direction: created-thing -> creator).
  { key: 'invented_by', label: 'was invented by', inverseLabel: 'invented', directionality: 'directed', category: 'attribution', isAcyclic: true, allowedSourceKinds: ['invention', 'technology', 'product'], allowedTargetKinds: ['person', 'organisation'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Attributes an invention/technology/product to its inventor.' },
  { key: 'discovered_by', label: 'was discovered by', inverseLabel: 'discovered', directionality: 'directed', category: 'attribution', isAcyclic: true, allowedSourceKinds: ['discovery', 'concept', 'place'], allowedTargetKinds: ['person', 'organisation'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Attributes a discovery/concept/place to its discoverer.' },
  { key: 'authored_by', label: 'was authored by', inverseLabel: 'authored', directionality: 'directed', category: 'attribution', isAcyclic: true, allowedSourceKinds: ['publication', 'concept', 'law_policy'], allowedTargetKinds: ['person', 'organisation'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Attributes a publication/work/law to its author.' },
  { key: 'founded_by', label: 'was founded by', inverseLabel: 'founded', directionality: 'directed', category: 'attribution', isAcyclic: true, allowedSourceKinds: ['organisation', 'movement', 'civilisation'], allowedTargetKinds: ['person'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Attributes an organisation/movement to its founder.' },
  // Support.
  { key: 'funded_by', label: 'was funded by', inverseLabel: 'funded', directionality: 'directed', category: 'support', isAcyclic: false, allowedSourceKinds: null, allowedTargetKinds: ['person', 'organisation'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Financial support relationship.' },
  { key: 'commissioned_by', label: 'was commissioned by', inverseLabel: 'commissioned', directionality: 'directed', category: 'support', isAcyclic: false, allowedSourceKinds: null, allowedTargetKinds: ['person', 'organisation'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Commissioned/ordered by a patron.' },
  { key: 'sponsored_by', label: 'was sponsored by', inverseLabel: 'sponsored', directionality: 'directed', category: 'support', isAcyclic: false, allowedSourceKinds: null, allowedTargetKinds: ['person', 'organisation'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Sponsorship/patronage relationship.' },
  // Causality.
  { key: 'caused', label: 'caused', inverseLabel: 'was caused by', directionality: 'directed', category: 'causal', isAcyclic: true, allowedSourceKinds: null, allowedTargetKinds: null, isBuiltin: false, isActive: true, isProvisional: false, description: 'Direct causation (stronger than influence/contribution).' },
  { key: 'hindered', label: 'hindered', inverseLabel: 'was hindered by', directionality: 'directed', category: 'causal', isAcyclic: false, allowedSourceKinds: null, allowedTargetKinds: null, isBuiltin: false, isActive: true, isProvisional: false, description: 'Impeded or slowed a development.' },
  // Influence.
  { key: 'inspired', label: 'inspired', inverseLabel: 'was inspired by', directionality: 'directed', category: 'influence', isAcyclic: false, allowedSourceKinds: null, allowedTargetKinds: null, isBuiltin: false, isActive: true, isProvisional: false, description: 'Creative/intellectual inspiration.' },
  { key: 'derived_from', label: 'derived from', inverseLabel: 'was the source for', directionality: 'directed', category: 'influence', isAcyclic: true, allowedSourceKinds: null, allowedTargetKinds: null, isBuiltin: false, isActive: true, isProvisional: false, description: 'Derived/adapted from a prior subject.' },
  { key: 'based_on', label: 'based on', inverseLabel: 'was the basis for', directionality: 'directed', category: 'influence', isAcyclic: true, allowedSourceKinds: null, allowedTargetKinds: null, isBuiltin: false, isActive: true, isProvisional: false, description: 'Built directly upon a prior subject.' },
  // Succession.
  { key: 'preceded', label: 'preceded', inverseLabel: 'followed', directionality: 'directed', category: 'succession', isAcyclic: true, allowedSourceKinds: null, allowedTargetKinds: null, isBuiltin: false, isActive: true, isProvisional: false, description: 'Temporal/logical predecessor.' },
  { key: 'superseded', label: 'superseded', inverseLabel: 'was superseded by', directionality: 'directed', category: 'succession', isAcyclic: true, allowedSourceKinds: null, allowedTargetKinds: null, isBuiltin: false, isActive: true, isProvisional: false, description: 'Rendered a predecessor obsolete.' },
  // Structure & classification.
  { key: 'subtype_of', label: 'subtype of', inverseLabel: 'has subtype', directionality: 'directed', category: 'structural', isAcyclic: true, allowedSourceKinds: null, allowedTargetKinds: null, isBuiltin: false, isActive: true, isProvisional: false, description: 'Classification: a more specific kind of the target.' },
  { key: 'instance_of', label: 'instance of', inverseLabel: 'has instance', directionality: 'directed', category: 'structural', isAcyclic: true, allowedSourceKinds: null, allowedTargetKinds: null, isBuiltin: false, isActive: true, isProvisional: false, description: 'A concrete instance of a class/concept.' },
  // Institutional.
  { key: 'member_of', label: 'member of', inverseLabel: 'has member', directionality: 'directed', category: 'institutional', isAcyclic: false, allowedSourceKinds: ['person', 'organisation'], allowedTargetKinds: ['organisation', 'movement'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Membership in an organisation/movement.' },
  { key: 'affiliated_with', label: 'affiliated with', inverseLabel: 'affiliated with', directionality: 'symmetric', category: 'institutional', isAcyclic: false, allowedSourceKinds: null, allowedTargetKinds: null, isBuiltin: false, isActive: true, isProvisional: false, description: 'Loose institutional affiliation (symmetric).' },
  { key: 'owned_by', label: 'owned by', inverseLabel: 'owns', directionality: 'directed', category: 'institutional', isAcyclic: false, allowedSourceKinds: null, allowedTargetKinds: ['person', 'organisation'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Ownership relationship.' },
  // Human & organizational interaction.
  { key: 'collaborated_with', label: 'collaborated with', inverseLabel: 'collaborated with', directionality: 'symmetric', category: 'interaction', isAcyclic: false, allowedSourceKinds: ['person', 'organisation'], allowedTargetKinds: ['person', 'organisation'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Cooperative work (symmetric).' },
  { key: 'competed_with', label: 'competed with', inverseLabel: 'competed with', directionality: 'symmetric', category: 'interaction', isAcyclic: false, allowedSourceKinds: null, allowedTargetKinds: null, isBuiltin: false, isActive: true, isProvisional: false, description: 'Rivalry/competition (symmetric).' },
  // Spatial.
  { key: 'developed_in', label: 'was developed in', inverseLabel: 'was where it was developed', directionality: 'directed', category: 'spatial', isAcyclic: false, allowedSourceKinds: null, allowedTargetKinds: ['place', 'organisation'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Place/organisation where a subject was developed.' },
  { key: 'headquartered_in', label: 'is headquartered in', inverseLabel: 'is the headquarters of', directionality: 'directed', category: 'spatial', isAcyclic: false, allowedSourceKinds: ['organisation'], allowedTargetKinds: ['place'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Organisation headquarters location.' },
  // Diffusion & adoption.
  { key: 'adopted_by', label: 'was adopted by', inverseLabel: 'adopted', directionality: 'directed', category: 'diffusion', isAcyclic: false, allowedSourceKinds: null, allowedTargetKinds: null, isBuiltin: false, isActive: true, isProvisional: false, description: 'Adoption/uptake by a group or place.' },
  { key: 'commercialized_by', label: 'was commercialized by', inverseLabel: 'commercialized', directionality: 'directed', category: 'diffusion', isAcyclic: false, allowedSourceKinds: ['invention', 'technology', 'product'], allowedTargetKinds: ['organisation', 'person'], isBuiltin: false, isActive: true, isProvisional: false, description: 'Brought to market by an organisation/person.' },
];

/** Keys added by v1 (for tests / migration parity). */
export const V1_ADDITION_KEYS = RELATIONSHIP_VOCABULARY_V1_ADDITIONS.map((r) => r.key);
