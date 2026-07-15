/**
 * Canonical-match compatibility rules, shared by the edit service and the
 * server-side match-target search so the UI picker and the server validator use
 * ONE source of truth.
 */
export const MATCH_STATUSES_WITH_ENTITY = ['canonical_complete', 'canonical_incomplete'] as const;
export const MATCH_STATUSES_WITHOUT_ENTITY = ['new_candidate', 'no_match'] as const;
export const ALL_MATCH_STATUSES = [...MATCH_STATUSES_WITH_ENTITY, ...MATCH_STATUSES_WITHOUT_ENTITY] as const;

/**
 * Kind-compatibility families. A candidate may match a canonical entity of the
 * SAME kind or one in the same family. Exact equality is the default; the only
 * deliberate cross-kind family is the artefact family. Extend explicitly here.
 */
export const KIND_MATCH_FAMILIES: readonly (readonly string[])[] = [
  ['invention', 'technology', 'product'],
];

export function kindsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  return KIND_MATCH_FAMILIES.some((fam) => fam.includes(a) && fam.includes(b));
}

/** All kinds compatible with the candidate kind (itself + any family members). */
export function compatibleKinds(candidateKind: string): string[] {
  const set = new Set<string>([candidateKind]);
  for (const fam of KIND_MATCH_FAMILIES) if (fam.includes(candidateKind)) fam.forEach((k) => set.add(k));
  return [...set];
}

/** Derive the match status from the target's canonical completeness. */
export function deriveMatchStatus(graphStatus: string): (typeof MATCH_STATUSES_WITH_ENTITY)[number] {
  return graphStatus === 'canonical_complete' ? 'canonical_complete' : 'canonical_incomplete';
}
