import type { YolContent } from '../types';
import { YOL_1769 } from './year-1769';
import { YOL_1969 } from './year-1969';

/**
 * Year-on-Line content registry. Every year that can be descended into has
 * an entry here; the experience resolves content from the ACTIVE anchor and
 * never hard-codes a year. All content is placeholder/provisional pending
 * editorial verification and sourcing — see the `placeholder` flags.
 */

/** A scroll-revealed event section on a YoL page. */
export interface YolEvent {
  id: string;
  /** display date, e.g. "July 20, 1969" (well-established, still flagged) */
  date: string;
  title: string;
  text: string;
  /** theme lens keys this event responds to (normalised anchor theme ids) */
  themes: string[];
  /**
   * Section identity key: which slice of the year's visual identity this
   * event belongs to (asset slot association + theme substyle). Purely
   * presentational, not a historical categorisation.
   */
  section: string;
  placeholder: true;
}

/** Neighbouring years for the bottom mini-timeline (display only). */
export interface NeighbourYear {
  year: string;
  label: string;
  active?: boolean;
  placeholder: true;
}

export interface YolQuote {
  text: string;
  attribution: string;
  placeholder: true;
}

/** Everything a year contributes to its YoL page (content, not styling —
 *  styling lives in the year's visual identity). */
export interface YearYol {
  content: YolContent;
  events: YolEvent[];
  neighbours: NeighbourYear[];
  /** optional — omitted when no verified quotation is available */
  quote?: YolQuote;
  /** manifest asset ids shown in the awaiting-imagery interlude */
  interludeAssetIds: string[];
}

export const YOL_YEARS: Record<string, YearYol> = {
  '1769': YOL_1769,
  '1969': YOL_1969,
};

/** Years that currently support the full descent journey, oldest first. */
export const YOL_YEAR_IDS = Object.keys(YOL_YEARS);

export function hasYol(anchorId: string): boolean {
  return anchorId in YOL_YEARS;
}

export function getYolYear(anchorId: string): YearYol | null {
  return YOL_YEARS[anchorId] ?? null;
}

/** Per-anchor YoL copy, keyed by anchor id (kept for the DB seed layer). */
export const YOL_CONTENT: Record<string, YolContent> = Object.fromEntries(
  Object.entries(YOL_YEARS).map(([id, y]) => [id, y.content])
);
