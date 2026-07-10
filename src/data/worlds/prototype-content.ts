/**
 * PROTOTYPE CONTENT for the 1760–1780 Historical Field and the four
 * demonstration Topic Worlds. Everything here is PROVISIONAL PLACEHOLDER
 * material for judging density, composition and movement — it is not
 * researched history, carries no sources, and must never be presented as
 * the final record. Real named subjects appear only where they are safely
 * established or required by the demonstration navigation chain
 * (Steam Engine → James Watt → University of Glasgow → Scottish
 * Enlightenment); everything else is a clearly labelled provisional record.
 *
 * Media entries use src: '' — the renderer draws a deterministic
 * PlaceholderPlate; no image files, downloads or rights questions in this
 * cycle (final imagery is a later, separately governed step).
 */
import type {
  HistoricalFieldItemVM,
  HistoricalFieldVM,
  HistoricalMediaVM,
  TopicWorldVM,
} from '../../domain/worlds';

function plate(id: string, aspectRatio: number, alt: string): HistoricalMediaVM {
  return {
    id,
    src: '',
    alt,
    aspectRatio,
    rightsStatus: 'not-applicable',
    mediaType: 'image',
    provenance: 'placeholder',
    placeholder: true,
  };
}

const DRAFT = { provenance: 'placeholder', editorialStatus: 'draft' } as const;

/* ------------------------------------------------------------------ */
/* Field records (minimal proof set — Opus expands to 40–60)           */
/* ------------------------------------------------------------------ */

const ITEMS: HistoricalFieldItemVM[] = [
  {
    id: 'hf-steam-engine',
    slug: 'steam-engine',
    kind: 'invention',
    title: 'The Steam Engine',
    summary:
      'Watt patents the separate condenser — steam begins its move from mine pump to general power. (Provisional summary.)',
    startYear: 1769,
    dateLabel: '1769',
    datePrecision: 'year',
    themeKeys: ['steam'],
    prominence: 95,
    media: [plate('m-steam', 1.35, 'Placeholder plate — the steam engine')],
    topicWorldSlug: 'steam-engine',
    ...DRAFT,
  },
  {
    id: 'hf-james-watt',
    slug: 'james-watt',
    kind: 'person',
    title: 'James Watt',
    summary: 'Instrument maker at Glasgow; improver of the steam engine. (Provisional.)',
    startYear: 1764,
    dateLabel: 'c. 1764',
    datePrecision: 'approximate',
    themeKeys: ['steam', 'knowledge'],
    prominence: 80,
    media: [plate('m-watt', 0.74, 'Placeholder plate — James Watt')],
    topicWorldSlug: 'james-watt',
    ...DRAFT,
  },
  {
    id: 'hf-university-of-glasgow',
    slug: 'university-of-glasgow',
    kind: 'organisation',
    title: 'University of Glasgow',
    summary: 'Teaching, instruments and workshops in the eighteenth century. (Provisional.)',
    startYear: 1760,
    endYear: 1780,
    dateLabel: '18th century',
    datePrecision: 'range',
    themeKeys: ['knowledge'],
    prominence: 68,
    media: [plate('m-glasgow', 1.55, 'Placeholder plate — University of Glasgow')],
    topicWorldSlug: 'university-of-glasgow',
    ...DRAFT,
  },
  {
    id: 'hf-scottish-enlightenment',
    slug: 'scottish-enlightenment',
    kind: 'idea',
    title: 'The Scottish Enlightenment',
    summary: 'Ideas moving through cities, institutions and correspondence. (Provisional.)',
    startYear: 1760,
    endYear: 1780,
    dateLabel: '1760–1780',
    datePrecision: 'range',
    themeKeys: ['knowledge'],
    prominence: 74,
    media: [plate('m-scoten', 2.3, 'Placeholder plate — the Scottish Enlightenment')],
    topicWorldSlug: 'scottish-enlightenment',
    composition: { preferredLane: 0, depth: 1 },
    ...DRAFT,
  },
  {
    id: 'hf-spinning-jenny',
    slug: 'spinning-jenny',
    kind: 'invention',
    title: 'The Spinning Jenny',
    summary: 'Multi-spindle spinning arrives in the cottage. (Provisional.)',
    startYear: 1765,
    dateLabel: 'c. 1765',
    datePrecision: 'approximate',
    themeKeys: ['labour'],
    prominence: 62,
    media: [plate('m-jenny', 1.0, 'Placeholder plate — the spinning jenny')],
    ...DRAFT,
  },
  {
    id: 'hf-endeavour',
    slug: 'endeavour-sails',
    kind: 'event',
    title: 'The Endeavour Sails',
    summary: 'Cook departs for the Pacific. (Provisional.)',
    startYear: 1768,
    dateLabel: '1768',
    datePrecision: 'year',
    themeKeys: ['trade'],
    prominence: 58,
    media: [plate('m-endeavour', 1.7, 'Placeholder plate — the Endeavour')],
    ...DRAFT,
  },
  {
    id: 'hf-transit-venus',
    slug: 'transit-of-venus',
    kind: 'discovery',
    title: 'Transit of Venus Observed',
    summary: 'A worldwide campaign of measurement. (Provisional.)',
    startYear: 1769,
    dateLabel: '1769',
    datePrecision: 'year',
    themeKeys: ['knowledge'],
    prominence: 56,
    media: [plate('m-venus', 0.62, 'Placeholder plate — transit of Venus')],
    ...DRAFT,
  },
  {
    id: 'hf-water-frame',
    slug: 'water-frame',
    kind: 'invention',
    title: 'The Water Frame',
    summary: 'Water-powered spinning; thread moves toward the mill. (Provisional.)',
    startYear: 1769,
    dateLabel: '1769',
    datePrecision: 'year',
    themeKeys: ['labour'],
    prominence: 54,
    media: [plate('m-frame', 1.2, 'Placeholder plate — the water frame')],
    ...DRAFT,
  },
  {
    id: 'hf-boston-tea-party',
    slug: 'boston-tea-party',
    kind: 'event',
    title: 'The Boston Tea Party',
    summary: 'Colonial protest in Boston harbour. (Provisional.)',
    startYear: 1773,
    dateLabel: '1773',
    datePrecision: 'year',
    themeKeys: ['trade'],
    prominence: 60,
    media: [plate('m-tea', 1.45, 'Placeholder plate — Boston Tea Party')],
    ...DRAFT,
  },
  {
    id: 'hf-independence',
    slug: 'american-independence',
    kind: 'event',
    title: 'Independence Declared',
    summary: 'The American colonies declare independence. (Provisional.)',
    startYear: 1776,
    dateLabel: '1776',
    datePrecision: 'year',
    themeKeys: ['trade'],
    prominence: 66,
    media: [plate('m-independence', 0.8, 'Placeholder plate — independence declared')],
    ...DRAFT,
  },
  {
    id: 'hf-wealth-nations',
    slug: 'wealth-of-nations',
    kind: 'idea',
    title: 'The Wealth of Nations',
    summary: 'Political economy in print. (Provisional.)',
    startYear: 1776,
    dateLabel: '1776',
    datePrecision: 'year',
    themeKeys: ['knowledge'],
    prominence: 58,
    media: [plate('m-wealth', 0.66, 'Placeholder plate — The Wealth of Nations')],
    ...DRAFT,
  },
  {
    id: 'hf-prov-canals',
    slug: 'prov-canal-building',
    kind: 'place',
    title: 'Canal Building (provisional record)',
    summary: 'Provisional record — inland navigation works.',
    startYear: 1761,
    dateLabel: 'c. 1761',
    datePrecision: 'approximate',
    themeKeys: ['labour'],
    prominence: 40,
    media: [plate('m-canals', 2.1, 'Placeholder plate — canal building (provisional)')],
    ...DRAFT,
  },
  {
    id: 'hf-prov-encyclopedie',
    slug: 'prov-encyclopedie',
    kind: 'idea',
    title: 'Encyclopédie Volumes (provisional record)',
    summary: 'Provisional record — engraved knowledge in circulation.',
    startYear: 1765,
    dateLabel: 'c. 1765',
    datePrecision: 'approximate',
    themeKeys: ['knowledge'],
    prominence: 46,
    media: [plate('m-encyc', 0.72, 'Placeholder plate — Encyclopédie (provisional)')],
    ...DRAFT,
  },
  {
    id: 'hf-prov-porcelain',
    slug: 'prov-ceramics',
    kind: 'invention',
    title: 'Ceramics Manufacture (provisional record)',
    summary: 'Provisional record — industrialised pottery works.',
    startYear: 1770,
    dateLabel: 'c. 1770',
    datePrecision: 'approximate',
    themeKeys: ['labour'],
    prominence: 34,
    media: [plate('m-ceramics', 1.05, 'Placeholder plate — ceramics (provisional)')],
    ...DRAFT,
  },
];

export const FIELD_1760_1780: HistoricalFieldVM = {
  id: 'field-1760-1780',
  rangeStart: 1760,
  rangeEnd: 1780,
  title: '1760–1780',
  items: ITEMS,
  provenance: 'placeholder',
};

/* ------------------------------------------------------------------ */
/* Topic Worlds (minimal 2-chapter proofs — Opus expands to 4–7)       */
/* ------------------------------------------------------------------ */

export const TOPIC_WORLDS: Record<string, TopicWorldVM> = {
  'steam-engine': {
    id: 'tw-steam-engine',
    slug: 'steam-engine',
    kind: 'invention',
    title: 'The Steam Engine',
    supportingLine: 'Iron, steam and pressure become general power',
    dateLabel: '1769',
    identity: {
      background: '#141110',
      foreground: '#e8ddc8',
      muted: '#8a7d68',
      accent: '#c98a3f',
      secondaryAccent: '#7f9aa8',
      surface: '#201b18',
      atmosphere: 'workshop-dark',
      typeTreatment: 'mechanical',
      motionCharacter: 'rhythmic',
      textureTreatment: 'iron-grain',
    },
    chapters: [
      {
        id: 'se-object',
        title: 'The machine as an object',
        body:
          'Beam, cylinder, condenser and valve gear — the engine as a physical presence in the workshop. Provisional copy; the researched chapter replaces this.',
        media: [plate('se-m1', 1.5, 'Placeholder plate — the engine as an object')],
      },
      {
        id: 'se-watt',
        title: 'James Watt and the separate condenser',
        body:
          'A repair job on a model engine becomes a decade of refinement. Provisional copy — the person behind the improvement has a world of his own.',
        media: [plate('se-m2', 0.78, 'Placeholder plate — Watt and the condenser')],
        relatedTopicSlug: 'james-watt',
        relatedTopicTitle: 'James Watt',
      },
    ],
    relatedTopics: [{ slug: 'james-watt', title: 'James Watt', kind: 'person' }],
    provenance: 'placeholder',
  },

  'james-watt': {
    id: 'tw-james-watt',
    slug: 'james-watt',
    kind: 'person',
    title: 'James Watt',
    supportingLine: 'Invention as prolonged refinement',
    dateLabel: '1736–1819',
    identity: {
      background: '#efe9dc',
      foreground: '#2a2620',
      muted: '#867d6b',
      accent: '#8f4f2a',
      secondaryAccent: '#5d7486',
      surface: '#e4dccb',
      atmosphere: 'paper-measured',
      typeTreatment: 'measured',
      motionCharacter: 'precise',
      textureTreatment: 'laid-paper',
    },
    chapters: [
      {
        id: 'jw-identity',
        title: 'Portrait and identity',
        body:
          'Instrument maker, measurer, improver — a career of paper, brass and calculation. Provisional copy pending research.',
        media: [plate('jw-m1', 0.74, 'Placeholder plate — portrait of James Watt')],
      },
      {
        id: 'jw-places',
        title: 'Places of work',
        body:
          'A workshop within a university: rooms, instruments and colleagues at Glasgow. Provisional copy — the institution opens into its own world.',
        media: [plate('jw-m2', 1.6, 'Placeholder plate — the Glasgow workshop')],
        relatedTopicSlug: 'university-of-glasgow',
        relatedTopicTitle: 'University of Glasgow',
      },
    ],
    relatedTopics: [
      { slug: 'university-of-glasgow', title: 'University of Glasgow', kind: 'organisation' },
    ],
    provenance: 'placeholder',
  },

  'university-of-glasgow': {
    id: 'tw-university-of-glasgow',
    slug: 'university-of-glasgow',
    kind: 'organisation',
    title: 'University of Glasgow',
    supportingLine: 'Stone, books and workshops',
    dateLabel: '18th century',
    identity: {
      background: '#1d2126',
      foreground: '#dfe4e8',
      muted: '#8b939c',
      accent: '#b9a15e',
      secondaryAccent: '#6f8a99',
      surface: '#272d34',
      atmosphere: 'institutional-stone',
      typeTreatment: 'institutional',
      motionCharacter: 'stately',
      textureTreatment: 'ashlar',
    },
    chapters: [
      {
        id: 'ug-institution',
        title: 'The institution in the eighteenth century',
        body:
          'Courts, lecture rooms and instrument workshops — teaching and practical skill under one roof. Provisional copy pending research.',
        media: [plate('ug-m1', 1.8, 'Placeholder plate — the university buildings')],
      },
      {
        id: 'ug-environment',
        title: 'The wider intellectual environment',
        body:
          'The university as one room in a much larger conversation across Scotland. Provisional copy — that conversation is a world of its own.',
        media: [plate('ug-m2', 1.15, 'Placeholder plate — the wider environment')],
        relatedTopicSlug: 'scottish-enlightenment',
        relatedTopicTitle: 'The Scottish Enlightenment',
      },
    ],
    relatedTopics: [
      { slug: 'scottish-enlightenment', title: 'The Scottish Enlightenment', kind: 'intellectual-movement' },
    ],
    provenance: 'placeholder',
  },

  'scottish-enlightenment': {
    id: 'tw-scottish-enlightenment',
    slug: 'scottish-enlightenment',
    kind: 'intellectual-movement',
    title: 'The Scottish Enlightenment',
    supportingLine: 'Ideas moving through networks',
    dateLabel: '18th century',
    identity: {
      background: '#f0ead9',
      foreground: '#33291d',
      muted: '#94886f',
      accent: '#6d3f22',
      secondaryAccent: '#41618a',
      surface: '#e7dfc9',
      atmosphere: 'correspondence',
      typeTreatment: 'correspondence',
      motionCharacter: 'flowing',
      textureTreatment: 'manuscript',
    },
    chapters: [
      {
        id: 'sce-movement',
        title: 'The intellectual movement',
        body:
          'Philosophy, science, medicine and political economy in conversation across a small country. Provisional copy pending research.',
        media: [plate('sce-m1', 2.2, 'Placeholder plate — the movement')],
      },
      {
        id: 'sce-influence',
        title: 'Influence and later interpretation',
        body:
          'What travelled outward, and how later readers simplified it. Provisional copy pending research.',
        media: [plate('sce-m2', 0.9, 'Placeholder plate — influence and interpretation')],
      },
    ],
    relatedTopics: [],
    provenance: 'placeholder',
  },
};
