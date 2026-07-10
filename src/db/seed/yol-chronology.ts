/**
 * Structured chronology descriptors for the prototype seed: the SAME
 * provisional 1769/1969 content that lives in src/data/yol, expressed with
 * machine-readable integer date parts (astronomical years; never JS Date).
 *
 * Event titles/summaries are pulled from the registry at seed time so the
 * copy has one authoring location; THIS module adds only what the registry
 * cannot express (date integers, entity kinds, context years).
 *
 * Everything seeded from here is draft/placeholder provisional content —
 * dates are well-established history but remain unsourced until the
 * research pipeline (issue #5) replaces them with claim/source-backed rows.
 * Do not add sources here; the seed must not pretend to be researched.
 */
import type { entityKindEnum } from '../schema/shared';

type EntityKind = (typeof entityKindEnum.enumValues)[number];

export interface SeedEventDate {
  /** 1-based month/day integer parts within the anchor year; omit = year-only */
  month?: number;
  day?: number;
  endMonth?: number;
  endDay?: number;
}

export interface SeedEventMeta {
  /** matches YolEvent.id in src/data/yol */
  eventId: string;
  kind: EntityKind;
  date: SeedEventDate;
}

export interface SeedContextYear {
  /** astronomical year of the neighbouring context point */
  year: number;
  /** matches NeighbourYear.label in src/data/yol */
  label: string;
}

export interface SeedYearChronology {
  anchorId: string;
  /** event metadata in the CURATED chronological display order */
  events: SeedEventMeta[];
  /** context years before/after the anchor year, oldest first */
  contextsBefore: SeedContextYear[];
  contextsAfter: SeedContextYear[];
  /** closing/transition point headline (presentation copy, placeholder) */
  closingHeadline: string;
}

export const YOL_CHRONOLOGY: Record<string, SeedYearChronology> = {
  '1769': {
    anchorId: '1769',
    events: [
      { eventId: 'watt-condenser', kind: 'event', date: { month: 1 } },
      { eventId: 'engraved-knowledge', kind: 'concept', date: {} },
      { eventId: 'transit-of-venus', kind: 'event', date: { month: 6 } },
      { eventId: 'water-frame', kind: 'event', date: {} },
    ],
    contextsBefore: [
      { year: 1765, label: 'The Stamp Act Crisis' },
      { year: 1768, label: 'The Endeavour Sails for the Pacific' },
    ],
    contextsAfter: [
      { year: 1770, label: 'Cook Charts Pacific Coasts' },
      { year: 1773, label: 'The Boston Tea Party' },
      { year: 1776, label: 'Independence Declared · The Wealth of Nations' },
    ],
    closingHeadline: '1769 hands back to the Line',
  },
  '1969': {
    anchorId: '1969',
    events: [
      { eventId: 'apollo11', kind: 'event', date: { month: 7, day: 20 } },
      { eventId: 'broadcast', kind: 'event', date: { month: 7, day: 20 } },
      { eventId: 'woodstock', kind: 'event', date: { month: 8, day: 15, endMonth: 8, endDay: 18 } },
      { eventId: 'moratorium', kind: 'event', date: { month: 10, day: 15 } },
      { eventId: 'arpanet', kind: 'event', date: { month: 10, day: 29 } },
      { eventId: 'world-in-motion', kind: 'concept', date: {} },
    ],
    contextsBefore: [
      { year: 1967, label: 'Six-Day War' },
      { year: 1968, label: 'Global Student Protests' },
    ],
    contextsAfter: [
      { year: 1970, label: 'Earth Day is Founded' },
      { year: 1971, label: 'Bangladesh Liberation War' },
      { year: 1972, label: 'Limits to Growth Published' },
      { year: 1973, label: 'Oil Crisis Begins' },
    ],
    closingHeadline: '1969 hands back to the Line',
  },
};

/** Renderer lens key for an anchor theme id ('cold-war' -> 'coldwar').
 *  Must stay in sync with src/experience/overlay/YolPage.tsx. */
export function lensKeyOf(themeId: string): string {
  return themeId.replace(/-/g, '');
}
