/**
 * Cycle 8B — relationship vocabulary service. The registry is authoritative.
 * Provides read access for the CRM vocabulary page and endpoint-kind
 * validation for candidate relationship editing. Pure DB reads through the
 * repository layer; no writes here.
 */
import type { Db } from '../../db/repositories/types';
import type { RelationshipTypeRegistryRow } from '../../db/schema';
import { getRelationshipType, listRelationshipTypes } from '../../db/repositories/graph-ext';

export interface EndpointCheck {
  ok: boolean;
  reason?: string;
}

/** True if `kind` is allowed by an endpoint restriction (null/empty = any). */
export function kindAllowed(allowed: string[] | null | undefined, kind: string): boolean {
  if (allowed == null || allowed.length === 0) return true;
  return allowed.includes(kind);
}

/** Validate that a relationship type is active and accepts the endpoint kinds.
 * For a SYMMETRIC type, the endpoints are order-independent so either
 * assignment is acceptable. */
export function checkEndpoints(
  type: RelationshipTypeRegistryRow,
  sourceKind: string,
  targetKind: string,
): EndpointCheck {
  if (!type.isActive) return { ok: false, reason: `relationship type "${type.key}" is not active` };
  if (type.directionality === 'symmetric') {
    const forward = kindAllowed(type.allowedSourceKinds, sourceKind) && kindAllowed(type.allowedTargetKinds, targetKind);
    const swapped = kindAllowed(type.allowedSourceKinds, targetKind) && kindAllowed(type.allowedTargetKinds, sourceKind);
    if (!forward && !swapped) {
      return { ok: false, reason: `symmetric type "${type.key}" does not allow kinds ${sourceKind}/${targetKind}` };
    }
    return { ok: true };
  }
  if (!kindAllowed(type.allowedSourceKinds, sourceKind)) {
    return { ok: false, reason: `type "${type.key}" source kind "${sourceKind}" not allowed (${(type.allowedSourceKinds ?? []).join('/')})` };
  }
  if (!kindAllowed(type.allowedTargetKinds, targetKind)) {
    return { ok: false, reason: `type "${type.key}" target kind "${targetKind}" not allowed (${(type.allowedTargetKinds ?? []).join('/')})` };
  }
  return { ok: true };
}

/** DB-backed endpoint validation for a typeKey. */
export async function validateRelationshipEndpoints(
  db: Db,
  typeKey: string,
  sourceKind: string,
  targetKind: string,
): Promise<EndpointCheck> {
  const type = await getRelationshipType(db, typeKey);
  if (!type) return { ok: false, reason: `unregistered relationship type "${typeKey}"` };
  return checkEndpoints(type, sourceKind, targetKind);
}

/** Active registry types compatible with a source/target kind pair — powers
 * the candidate relationship-type dropdown so only valid types are offered. */
export async function compatibleRelationshipTypes(
  db: Db,
  sourceKind: string,
  targetKind: string,
): Promise<RelationshipTypeRegistryRow[]> {
  const all = await listRelationshipTypes(db);
  return all.filter((t) => t.isActive && checkEndpoints(t, sourceKind, targetKind).ok);
}

/** Full vocabulary for the read-only CRM vocabulary page, category-sorted. */
export async function getRelationshipVocabulary(db: Db): Promise<RelationshipTypeRegistryRow[]> {
  const all = await listRelationshipTypes(db);
  return [...all].sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
}
