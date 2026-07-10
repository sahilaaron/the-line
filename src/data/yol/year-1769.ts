import type { YearYol } from './index';

/**
 * Year-on-Line content for 1769 (engraved broadsheet page).
 * PROTOTYPE CONTENT: event dates/titles are well-established history, but
 * every entry is flagged `placeholder: true` pending editorial verification
 * and sourcing. No quotation is included because no verified 1769 quotation
 * has been sourced yet. All referenced imagery is a named placeholder slot
 * awaiting externally generated artwork — nothing here is archival media.
 */
export const YOL_1769: YearYol = {
  content: {
    anchorId: '1769',
    title: '1769',
    thesis:
      'The world rendered as mechanism, measurement and engraved knowledge.',
    themeLabels: [
      'Steam & Mechanisation',
      'Knowledge & Enlightenment',
      'Empire, Trade & Exploration',
      'Labour & Social Transformation',
    ],
    placeholder: true,
  },

  events: [
    {
      id: 'watt-condenser',
      section: 'steam',
      date: 'January 1769',
      title: 'Watt patents the separate condenser',
      text:
        'James Watt is granted a patent for his improved steam engine with a separate condenser — an engine that wastes far less heat, and begins to turn steam from a pump at a mine into a general source of power.',
      themes: ['steam', 'labour'],
      placeholder: true,
    },
    {
      id: 'engraved-knowledge',
      section: 'knowledge',
      date: '1769',
      title: 'Knowledge, engraved and bound',
      text:
        'Encyclopaedias, technical plates and printed diagrams circulate through Europe — mechanisms cut into copper, pressed onto paper, and carried far beyond the workshops they describe.',
      themes: ['knowledge'],
      placeholder: true,
    },
    {
      id: 'transit-of-venus',
      section: 'trade',
      date: 'June 1769',
      title: 'The transit of Venus, measured from Tahiti',
      text:
        'From Tahiti, the Endeavour expedition under James Cook observes the transit of Venus across the Sun — a voyage of measurement that is also an instrument of empire, charting oceans, coasts and claims.',
      themes: ['trade', 'knowledge'],
      placeholder: true,
    },
    {
      id: 'water-frame',
      section: 'labour',
      date: '1769',
      title: 'Arkwright patents the water frame',
      text:
        'Richard Arkwright patents a spinning frame driven by water power. Thread once spun by hand in cottages begins moving toward the mill — and with it, the shape of working life itself.',
      themes: ['labour', 'steam'],
      placeholder: true,
    },
  ],

  neighbours: [
    { year: '1765', label: 'The Stamp Act Crisis', placeholder: true },
    { year: '1768', label: 'The Endeavour Sails for the Pacific', placeholder: true },
    { year: '1769', label: 'Mechanism, Measurement, Engraving', active: true, placeholder: true },
    { year: '1770', label: 'Cook Charts Pacific Coasts', placeholder: true },
    { year: '1773', label: 'The Boston Tea Party', placeholder: true },
    { year: '1776', label: 'Independence Declared · The Wealth of Nations', placeholder: true },
  ],

  /* no quote: no verified 1769 quotation sourced yet — do not fabricate */

  interludeAssetIds: [],
};
