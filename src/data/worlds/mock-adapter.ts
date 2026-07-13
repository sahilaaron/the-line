/**
 * The prototype implementation of `HistoricalWorldDataSource`, serving the
 * provisional placeholder content from ./prototype-content. The future
 * CRM/API adapter implements the SAME interface; nothing above this module
 * changes when it does (see docs/backend-crm-handoff.md).
 */
import type { HistoricalWorldDataSource } from '../../domain/worlds';
import { FIELD_1760_1780, TOPIC_WORLDS } from './prototype-content';

export const mockWorldDataSource: HistoricalWorldDataSource = {
  async getHistoricalField({ rangeStart, rangeEnd }) {
    if (rangeStart === FIELD_1760_1780.rangeStart && rangeEnd === FIELD_1760_1780.rangeEnd) {
      return FIELD_1760_1780;
    }
    throw new Error(`no prototype field for ${rangeStart}-${rangeEnd}`);
  },

  async getTopicWorld(slug: string) {
    const world = TOPIC_WORLDS[slug];
    if (!world) throw new Error(`no prototype topic world for "${slug}"`);
    return world;
  },
};

/** The active data source. Swapped for the CRM/API adapter in a later
 *  cycle; renderers only ever import THIS accessor. */
export function getWorldDataSource(): HistoricalWorldDataSource {
  return mockWorldDataSource;
}
