/**
 * PROTOTYPE CONTENT for the 1760–1780 Historical Field and the four
 * demonstration Topic Worlds. Everything here is PROVISIONAL PLACEHOLDER
 * material for judging density, composition and movement — it is not
 * researched history, carries no sources, and must never be presented as
 * the final record. Real named subjects appear only where they are safely
 * established or required by the demonstration navigation chain
 * (Steam Engine → James Watt → University of Glasgow → Scottish
 * Enlightenment); everything else is a clearly labelled "(provisional
 * record)" whose title, category and rough date exist ONLY to populate the
 * collage — no specific claim, quotation, inventor, cause or source is
 * asserted by any of them.
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

/**
 * Compact record builder — keeps ~55 records readable. `ar` is the plate
 * aspect ratio (width / height); the mix below spans portrait (~0.66),
 * narrow document (~0.6), square (1.0), object plate (~1.1), landscape
 * (~1.5) and panoramic (~2.2) so proportion variety can be judged.
 */
function item(
  o: {
    id: string;
    slug: string;
    kind: HistoricalFieldItemVM['kind'];
    title: string;
    summary: string;
    year: number;
    endYear?: number;
    dateLabel?: string;
    precision?: HistoricalFieldItemVM['datePrecision'];
    themes: string[];
    prominence: number;
    ar: number;
    topicWorldSlug?: string;
    composition?: HistoricalFieldItemVM['composition'];
  }
): HistoricalFieldItemVM {
  return {
    id: o.id,
    slug: o.slug,
    kind: o.kind,
    title: o.title,
    summary: o.summary,
    startYear: o.year,
    endYear: o.endYear,
    dateLabel: o.dateLabel ?? (o.endYear ? `${o.year}–${o.endYear}` : String(o.year)),
    datePrecision: o.precision ?? (o.endYear ? 'range' : 'year'),
    themeKeys: o.themes,
    prominence: o.prominence,
    media: [plate(`m-${o.id}`, o.ar, `Placeholder plate — ${o.title}`)],
    topicWorldSlug: o.topicWorldSlug,
    composition: o.composition,
    ...DRAFT,
  };
}

/* ------------------------------------------------------------------ */
/* Field records — ~55 across 1760–1780.                               */
/*                                                                     */
/* Anchor subjects (safely-established names / the demonstration chain) */
/* keep their original ids so the kernel specs and layout tests stay    */
/* valid; everything else is a "(provisional record)" placeholder.      */
/* ------------------------------------------------------------------ */

const ITEMS: HistoricalFieldItemVM[] = [
  /* ---- the four demonstration-chain subjects (Topic World doorways) ---- */
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
    themeKeys: ['steam', 'knowledge'],
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
    composition: { preferredLane: 1, depth: 1 },
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
    themeKeys: ['knowledge', 'society'],
    prominence: 74,
    media: [plate('m-scoten', 2.3, 'Placeholder plate — the Scottish Enlightenment')],
    topicWorldSlug: 'scottish-enlightenment',
    composition: { preferredLane: 0, depth: 1 },
    ...DRAFT,
  },

  /* ---- other established/proof subjects (original ids retained) ---- */
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
    summary: 'A Pacific voyage of survey and observation departs. (Provisional.)',
    startYear: 1768,
    dateLabel: '1768',
    datePrecision: 'year',
    themeKeys: ['navigation', 'empire'],
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
    themeKeys: ['knowledge', 'navigation'],
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
    themeKeys: ['labour', 'steam'],
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
    themeKeys: ['trade', 'reform'],
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
    themeKeys: ['reform', 'society'],
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
    themeKeys: ['knowledge', 'trade'],
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
    themeKeys: ['labour', 'trade'],
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
    themeKeys: ['knowledge', 'print'],
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
    themeKeys: ['labour', 'art'],
    prominence: 34,
    media: [plate('m-ceramics', 1.05, 'Placeholder plate — ceramics (provisional)')],
    ...DRAFT,
  },

  /* ---- density fill: ~40 provisional records across the range ---- */
  /* 1760 */
  item({ id: 'hf-p-observatory', slug: 'prov-observatory', kind: 'place', title: 'A New Observatory (provisional record)', summary: 'Provisional record — an instrument of the sky.', year: 1760, themes: ['knowledge', 'nature'], prominence: 42, ar: 2.0 }),
  item({ id: 'hf-p-loom', slug: 'prov-loom-patent', kind: 'invention', title: 'A Loom Patent (provisional record)', summary: 'Provisional record — a mechanism for cloth.', year: 1760, themes: ['labour'], prominence: 36, ar: 1.0 }),
  /* 1761 */
  item({ id: 'hf-p-comet', slug: 'prov-predicted-return', kind: 'discovery', title: 'A Predicted Return (provisional record)', summary: 'Provisional record — a calculation confirmed in the sky.', year: 1761, themes: ['knowledge', 'nature'], prominence: 44, ar: 0.68 }),
  item({ id: 'hf-p-harbour', slug: 'prov-harbour-works', kind: 'place', title: 'Harbour Works (provisional record)', summary: 'Provisional record — stone against the tide.', year: 1761, themes: ['trade', 'labour'], prominence: 33, ar: 1.6 }),
  /* 1762 */
  item({ id: 'hf-p-education', slug: 'prov-treatise-education', kind: 'idea', title: 'A Treatise on Education (provisional record)', summary: 'Provisional record — an argument about how the young should learn.', year: 1762, themes: ['knowledge', 'society'], prominence: 50, ar: 0.62 }),
  item({ id: 'hf-p-society-arts', slug: 'prov-society-of-arts', kind: 'organisation', title: 'A Society of Arts (provisional record)', summary: 'Provisional record — prizes for useful improvement.', year: 1762, themes: ['art', 'society'], prominence: 46, ar: 1.5 }),
  item({ id: 'hf-p-chronometer', slug: 'prov-sea-clock', kind: 'invention', title: 'A Sea-Clock Trial (provisional record)', summary: 'Provisional record — longitude sought in gears.', year: 1762, themes: ['navigation', 'trade'], prominence: 55, ar: 1.1 }),
  /* 1763 */
  item({ id: 'hf-p-peace', slug: 'prov-treaty-of-peace', kind: 'event', title: 'A Treaty of Peace (provisional record)', summary: 'Provisional record — a war formally ended.', year: 1763, themes: ['empire'], prominence: 60, ar: 2.15, composition: { preferredLane: 3, sizeClass: 'large' } }),
  item({ id: 'hf-p-botanic', slug: 'prov-botanic-garden', kind: 'place', title: 'A Botanic Garden (provisional record)', summary: 'Provisional record — the world ordered in beds.', year: 1763, themes: ['nature', 'knowledge'], prominence: 40, ar: 1.45 }),
  item({ id: 'hf-p-almanac', slug: 'prov-almanac', kind: 'idea', title: 'An Almanac in Print (provisional record)', summary: 'Provisional record — the year foretold in tables.', year: 1763, themes: ['print', 'knowledge'], prominence: 32, ar: 0.6 }),
  /* 1764 */
  item({ id: 'hf-p-portrait', slug: 'prov-portrait-commission', kind: 'person', title: 'A Portrait Commission (provisional record)', summary: 'Provisional record — a face fixed in oil.', year: 1764, themes: ['art'], prominence: 36, ar: 0.72 }),
  item({ id: 'hf-p-canal-lock', slug: 'prov-canal-lock', kind: 'invention', title: 'A Canal Lock (provisional record)', summary: 'Provisional record — water raised by degrees.', year: 1764, themes: ['labour', 'trade'], prominence: 42, ar: 1.15 }),
  /* 1765 */
  item({ id: 'hf-p-stamp', slug: 'prov-stamp-on-paper', kind: 'event', title: 'A Stamp on Paper (provisional record)', summary: 'Provisional record — a tax that reached every page.', year: 1765, themes: ['trade', 'reform'], prominence: 52, ar: 1.0 }),
  item({ id: 'hf-p-anatomy', slug: 'prov-anatomy-lectures', kind: 'idea', title: 'Anatomy Lectures (provisional record)', summary: 'Provisional record — the body taught from the table.', year: 1765, themes: ['medicine', 'knowledge'], prominence: 44, ar: 1.4 }),
  /* 1766 */
  item({ id: 'hf-p-airs', slug: 'prov-inflammable-air', kind: 'discovery', title: 'Inflammable Air Weighed (provisional record)', summary: 'Provisional record — an unseen gas put on the balance.', year: 1766, themes: ['knowledge'], prominence: 54, ar: 0.7 }),
  item({ id: 'hf-p-repeal', slug: 'prov-repeal-debated', kind: 'event', title: 'A Repeal Debated (provisional record)', summary: 'Provisional record — a tax argued away.', year: 1766, themes: ['reform', 'trade'], prominence: 48, ar: 1.55 }),
  /* 1767 */
  item({ id: 'hf-p-spinning-shop', slug: 'prov-spinning-workshop', kind: 'place', title: 'A Spinning Workshop (provisional record)', summary: 'Provisional record — thread by the roomful.', year: 1767, themes: ['labour'], prominence: 40, ar: 1.5 }),
  item({ id: 'hf-p-telescope', slug: 'prov-reflecting-telescope', kind: 'invention', title: 'A Reflecting Telescope (provisional record)', summary: 'Provisional record — light folded onto a mirror.', year: 1767, themes: ['knowledge', 'nature'], prominence: 50, ar: 1.05 }),
  item({ id: 'hf-p-duties', slug: 'prov-import-duties', kind: 'event', title: 'New Import Duties (provisional record)', summary: 'Provisional record — the ledger reaches the colonies.', year: 1767, themes: ['trade'], prominence: 45, ar: 0.64 }),
  /* 1768 */
  item({ id: 'hf-p-academy-arts', slug: 'prov-academy-of-arts', kind: 'organisation', title: 'An Academy of Arts (provisional record)', summary: 'Provisional record — a school for the eye and hand.', year: 1768, themes: ['art', 'society'], prominence: 58, ar: 1.6, composition: { preferredLane: 0 } }),
  item({ id: 'hf-p-reference', slug: 'prov-reference-work', kind: 'idea', title: 'A Reference Work Begun (provisional record)', summary: 'Provisional record — knowledge gathered by the alphabet.', year: 1768, themes: ['print', 'knowledge'], prominence: 50, ar: 0.66 }),
  /* 1769 (hotspot) */
  item({ id: 'hf-p-condenser', slug: 'prov-condenser-patent', kind: 'invention', title: 'A Patent for a Condenser (provisional record)', summary: 'Provisional record — a claim registered on paper.', year: 1769, themes: ['steam', 'knowledge'], prominence: 70, ar: 1.2, composition: { offsetX: 3.5 } }),
  item({ id: 'hf-p-parties', slug: 'prov-observation-parties', kind: 'event', title: 'Observation Parties Abroad (provisional record)', summary: 'Provisional record — instruments carried across oceans.', year: 1769, themes: ['knowledge', 'navigation'], prominence: 52, ar: 2.25 }),
  item({ id: 'hf-p-nautical', slug: 'prov-nautical-table', kind: 'idea', title: 'A Nautical Table (provisional record)', summary: 'Provisional record — the sky reduced to columns.', year: 1769, themes: ['navigation'], prominence: 48, ar: 0.62 }),
  /* 1770 */
  item({ id: 'hf-p-landfall', slug: 'prov-pacific-landfall', kind: 'event', title: 'A Pacific Landfall (provisional record)', summary: 'Provisional record — a distant coast charted.', year: 1770, themes: ['empire', 'navigation'], prominence: 56, ar: 1.7 }),
  item({ id: 'hf-p-disturbance', slug: 'prov-urban-disturbance', kind: 'event', title: 'An Urban Disturbance (provisional record)', summary: 'Provisional record — a crowd in a narrow street.', year: 1770, themes: ['society', 'reform'], prominence: 42, ar: 1.0 }),
  /* 1771 */
  item({ id: 'hf-p-mill', slug: 'prov-water-mill', kind: 'place', title: 'A Water-Powered Mill (provisional record)', summary: 'Provisional record — a river set to work.', year: 1771, themes: ['labour', 'steam'], prominence: 62, ar: 1.5 }),
  item({ id: 'hf-p-philosopher', slug: 'prov-philosopher-portrait', kind: 'person', title: "A Philosopher's Portrait (provisional record)", summary: 'Provisional record — thought given a face.', year: 1771, themes: ['knowledge', 'art'], prominence: 44, ar: 0.7 }),
  /* 1772 */
  item({ id: 'hf-p-gases', slug: 'prov-airs-distinguished', kind: 'discovery', title: 'Airs Distinguished (provisional record)', summary: 'Provisional record — one gas told from another.', year: 1772, themes: ['knowledge', 'medicine'], prominence: 54, ar: 0.68 }),
  item({ id: 'hf-p-partition', slug: 'prov-partition-agreed', kind: 'event', title: 'A Partition Agreed (provisional record)', summary: 'Provisional record — a map redrawn by treaty.', year: 1772, themes: ['empire'], prominence: 50, ar: 2.0 }),
  /* 1773 */
  item({ id: 'hf-p-tea-act', slug: 'prov-tea-act', kind: 'event', title: 'A Tea Act Passed (provisional record)', summary: 'Provisional record — a cargo made political.', year: 1773, themes: ['trade', 'reform'], prominence: 50, ar: 0.63 }),
  item({ id: 'hf-p-foundry', slug: 'prov-iron-foundry', kind: 'place', title: 'An Iron Foundry (provisional record)', summary: 'Provisional record — heat, ore and iron.', year: 1773, themes: ['steam', 'labour'], prominence: 58, ar: 1.55 }),
  /* 1774 */
  item({ id: 'hf-p-air-isolated', slug: 'prov-new-air-isolated', kind: 'discovery', title: 'A New Air Isolated (provisional record)', summary: 'Provisional record — a gas caught over water.', year: 1774, themes: ['knowledge', 'medicine'], prominence: 60, ar: 0.7 }),
  item({ id: 'hf-p-congress', slug: 'prov-continental-congress', kind: 'organisation', title: 'A Continental Congress (provisional record)', summary: 'Provisional record — delegates in a shared room.', year: 1774, themes: ['reform', 'society'], prominence: 56, ar: 1.5 }),
  item({ id: 'hf-p-novel', slug: 'prov-novel-of-sentiment', kind: 'idea', title: 'A Novel of Sentiment (provisional record)', summary: 'Provisional record — feeling printed and bound.', year: 1774, themes: ['art', 'society'], prominence: 40, ar: 0.62 }),
  /* 1775 */
  item({ id: 'hf-p-skirmish', slug: 'prov-skirmish-at-dawn', kind: 'event', title: 'A Skirmish at Dawn (provisional record)', summary: 'Provisional record — a first exchange of fire.', year: 1775, themes: ['reform', 'empire'], prominence: 58, ar: 1.6 }),
  item({ id: 'hf-p-engine-ordered', slug: 'prov-engine-ordered', kind: 'event', title: 'An Engine Ordered (provisional record)', summary: 'Provisional record — power bought by contract.', year: 1775, themes: ['steam', 'trade'], prominence: 52, ar: 1.1 }),
  item({ id: 'hf-p-survey', slug: 'prov-county-survey', kind: 'idea', title: 'A County Survey (provisional record)', summary: 'Provisional record — land measured and drawn.', year: 1775, themes: ['knowledge', 'nature'], prominence: 42, ar: 2.2 }),
  /* 1777 */
  item({ id: 'hf-p-bridge-proposed', slug: 'prov-iron-bridge-proposed', kind: 'invention', title: 'An Iron Bridge Proposed (provisional record)', summary: 'Provisional record — a span drawn in metal.', year: 1777, themes: ['steam', 'labour'], prominence: 60, ar: 1.7 }),
  item({ id: 'hf-p-surrender', slug: 'prov-army-surrenders', kind: 'event', title: 'An Army Surrenders (provisional record)', summary: 'Provisional record — a campaign decided.', year: 1777, themes: ['empire', 'reform'], prominence: 56, ar: 1.5 }),
  /* 1778 */
  item({ id: 'hf-p-naturalist', slug: 'prov-naturalist-remembered', kind: 'person', title: 'A Naturalist Remembered (provisional record)', summary: 'Provisional record — a life spent naming the world.', year: 1778, themes: ['nature', 'knowledge'], prominence: 46, ar: 0.72 }),
  item({ id: 'hf-p-alliance', slug: 'prov-alliance-signed', kind: 'event', title: 'An Alliance Signed (provisional record)', summary: 'Provisional record — two powers make common cause.', year: 1778, themes: ['empire', 'trade'], prominence: 50, ar: 0.64 }),
  /* 1779 */
  item({ id: 'hf-p-bridge-built', slug: 'prov-iron-bridge-built', kind: 'place', title: 'An Iron Bridge Built (provisional record)', summary: 'Provisional record — the span stands over the river.', year: 1779, themes: ['steam', 'labour'], prominence: 62, ar: 2.1, composition: { sizeClass: 'large', depth: 0 } }),
  item({ id: 'hf-p-mule', slug: 'prov-spinning-mule', kind: 'invention', title: 'A Spinning Mule (provisional record)', summary: 'Provisional record — two machines made one.', year: 1779, themes: ['labour'], prominence: 54, ar: 1.1 }),
  /* 1780 */
  item({ id: 'hf-p-city-disturbances', slug: 'prov-city-disturbances', kind: 'event', title: 'City Disturbances (provisional record)', summary: 'Provisional record — several days of unrest.', year: 1780, themes: ['society', 'reform'], prominence: 48, ar: 1.55 }),
  item({ id: 'hf-p-royal-observation', slug: 'prov-royal-observation', kind: 'discovery', title: 'A Royal Observation (provisional record)', summary: 'Provisional record — the heavens noted from a garden.', year: 1780, themes: ['knowledge', 'nature'], prominence: 44, ar: 0.68 }),
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
/* Topic Worlds — four demonstration worlds, 5–6 provisional chapters   */
/* each. Copy is short, editorial and explicitly provisional; exactly    */
/* one onward doorway per world runs the demonstration chain, and it is  */
/* placed in chapter index 1 so the kernel chain spec (ArrowRight →      */
/* chapter 1 → doorway) stays valid.                                     */
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
          'Beam, cylinder, condenser and valve gear — the engine as a physical presence in the workshop, felt as much as understood. Provisional copy; the researched chapter replaces this.',
        media: [plate('se-m1', 1.5, 'Placeholder plate — the engine as an object')],
      },
      {
        id: 'se-watt',
        title: 'James Watt and the separate condenser',
        body:
          'A repair job on a model engine becomes a decade of refinement. Provisional copy — the person behind the improvement has a world of his own, one doorway away.',
        media: [plate('se-m2', 0.78, 'Placeholder plate — Watt and the condenser')],
        relatedTopicSlug: 'james-watt',
        relatedTopicTitle: 'James Watt',
      },
      {
        id: 'se-before',
        title: 'The world before the improvement',
        body:
          'Atmospheric engines already drained mines, slow and hungry for coal. Provisional copy — the improvement answered a problem people could already name.',
        media: [plate('se-m3', 1.35, 'Placeholder plate — the earlier engine')],
      },
      {
        id: 'se-heat',
        title: 'Heat, pressure and motion',
        body:
          'Steam expands, condenses and pushes; the engine is an argument in metal about how heat becomes work. Provisional copy pending research.',
        media: [plate('se-m4', 1.1, 'Placeholder plate — heat and pressure')],
      },
      {
        id: 'se-manufacture',
        title: 'Manufacture and application',
        body:
          'From a single improved engine to a trade in power: foundries, fitters and customers who bought motion by contract. Provisional copy pending research.',
        media: [plate('se-m5', 1.7, 'Placeholder plate — manufacture and application')],
      },
      {
        id: 'se-descendants',
        title: 'Consequences and descendants',
        body:
          'Later machines trace their lineage here, though the line is rarely as straight as it is told. Provisional copy — influence is noted, not asserted as direct cause.',
        media: [plate('se-m6', 2.0, 'Placeholder plate — consequences and descendants')],
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
          'Instrument maker, measurer, improver — a career of paper, brass and calculation rather than sudden inspiration. Provisional copy pending research.',
        media: [plate('jw-m1', 0.74, 'Placeholder plate — portrait of James Watt')],
      },
      {
        id: 'jw-places',
        title: 'Places of work',
        body:
          'A workshop within a university: rooms, instruments and colleagues at Glasgow. Provisional copy — the institution opens into its own world, one doorway away.',
        media: [plate('jw-m2', 1.6, 'Placeholder plate — the Glasgow workshop')],
        relatedTopicSlug: 'university-of-glasgow',
        relatedTopicTitle: 'University of Glasgow',
      },
      {
        id: 'jw-formation',
        title: 'Formation and instrument making',
        body:
          'A training in precise, small work — dividing scales, fitting brass — that taught the habits a larger machine would need. Provisional copy pending research.',
        media: [plate('jw-m3', 1.0, 'Placeholder plate — instrument making')],
      },
      {
        id: 'jw-problem',
        title: 'The steam-engine problem',
        body:
          'An encounter with a wasteful engine becomes a question that will not let go. Provisional copy — a problem met before it was solved.',
        media: [plate('jw-m4', 1.2, 'Placeholder plate — the steam-engine problem')],
      },
      {
        id: 'jw-collaboration',
        title: 'Collaboration and manufacture',
        body:
          'Refinement needed capital, workshops and partners; the improvement was made real by more hands than one. Provisional copy pending research.',
        media: [plate('jw-m5', 1.5, 'Placeholder plate — collaboration and manufacture')],
      },
      {
        id: 'jw-oversimplification',
        title: 'Influence and oversimplification',
        body:
          'Later stories compress a long, shared, uneven effort into a single moment of genius. Provisional copy — the flattening is itself worth noticing.',
        media: [plate('jw-m6', 0.9, 'Placeholder plate — influence and oversimplification')],
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
          'The university as one room in a much larger conversation across Scotland. Provisional copy — that conversation is a world of its own, one doorway away.',
        media: [plate('ug-m2', 1.15, 'Placeholder plate — the wider environment')],
        relatedTopicSlug: 'scottish-enlightenment',
        relatedTopicTitle: 'The Scottish Enlightenment',
      },
      {
        id: 'ug-workshops',
        title: 'Workshops and instruments',
        body:
          'Rooms where knowledge was made with the hands as well as the head; where a maker of instruments could find both problems and tools. Provisional copy pending research.',
        media: [plate('ug-m3', 1.3, 'Placeholder plate — workshops and instruments')],
      },
      {
        id: 'ug-networks',
        title: 'Scholarly networks',
        body:
          'Teachers, students and correspondents whose letters carried the institution far beyond its walls. Provisional copy pending research.',
        media: [plate('ug-m4', 1.6, 'Placeholder plate — scholarly networks')],
      },
      {
        id: 'ug-science-trade',
        title: 'Science, trade and philosophy',
        body:
          'A city of merchants and a college of philosophers shared streets and interests. Provisional copy — proximity is described, not claimed as cause.',
        media: [plate('ug-m5', 1.45, 'Placeholder plate — science, trade and philosophy')],
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
        id: 'sce-cities',
        title: 'Cities and institutions',
        body:
          'Clubs, universities and printing houses gave the conversation places to happen. Provisional copy pending research.',
        media: [plate('sce-m2', 1.5, 'Placeholder plate — cities and institutions')],
      },
      {
        id: 'sce-philosophy',
        title: 'Philosophy and science',
        body:
          'Questions about mind, nature and knowledge pursued with unusual concentration. Provisional copy pending research.',
        media: [plate('sce-m3', 1.1, 'Placeholder plate — philosophy and science')],
      },
      {
        id: 'sce-economy',
        title: 'Political economy',
        body:
          'A new way of describing markets, labour and value took shape here. Provisional copy — an influence noted without a single origin claimed.',
        media: [plate('sce-m4', 0.7, 'Placeholder plate — political economy')],
      },
      {
        id: 'sce-correspondence',
        title: 'Correspondence and social networks',
        body:
          'Letters, dinners and disagreements moved ideas as much as any book. Provisional copy pending research.',
        media: [plate('sce-m5', 1.7, 'Placeholder plate — correspondence and networks')],
      },
      {
        id: 'sce-influence',
        title: 'Influence, limitations and later interpretation',
        body:
          'What travelled outward, what stayed local, and how later readers simplified it. Provisional copy — limits are kept in view alongside reach.',
        media: [plate('sce-m6', 0.9, 'Placeholder plate — influence and interpretation')],
      },
    ],
    relatedTopics: [],
    provenance: 'placeholder',
  },
};
