/**
 * Per-anchor descent destinations. The parent Line's Earth click resolves
 * its destination here: 1969 keeps the database-backed YoL renderer
 * (issue #14); 1769 opens the 1760–1780 Historical Field. Other date
 * ranges adopt the field renderer by ADDING AN ENTRY — never by touching
 * navigation logic.
 */
import { hasYol } from '../yol';

export type AnchorDestination =
  | { world: 'yol' }
  | { world: 'historical-field'; rangeStart: number; rangeEnd: number };

const DESTINATIONS: Record<string, AnchorDestination> = {
  '1769': { world: 'historical-field', rangeStart: 1760, rangeEnd: 1780 },
  '1969': { world: 'yol' },
};

export function destinationForAnchor(anchorId: string): AnchorDestination | null {
  const explicit = DESTINATIONS[anchorId];
  if (explicit) return explicit;
  // any year with YoL content remains enterable through the YoL renderer
  return hasYol(anchorId) ? { world: 'yol' } : null;
}

/** Anchor ids that can currently be entered from the parent Line. */
export function enterableAnchorIds(all: string[]): string[] {
  return all.filter((id) => destinationForAnchor(id) !== null);
}
