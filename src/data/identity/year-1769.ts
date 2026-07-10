import type { AssetRecord, YearVisualIdentity } from './types';

/**
 * 1769 — Year Visual Identity.
 *
 * Direction: the world rendered as mechanism, measurement and engraved
 * knowledge. Copperplate engraving and aged technical diagrams (plate
 * marks, crosshatching, measured annotation), cartographic archives
 * (graticules, rhumb-line geometry, faded blues), rag paper warmed by
 * oxidation and soot, asymmetric broadsheet composition with book-page
 * margins, engraved rules and folio marks. Motion is mechanical and
 * measured — pressure, registration and stamping rather than drift.
 *
 * Typography uses legally available local stacks that are also period-
 * plausible: Baskerville (a 1750s transitional serif) for display,
 * Palatino/Georgia as the bookish body, Copperplate-style engraved
 * capitals for annotation. If richer fonts are wanted later, document
 * them in docs/year-visual-identity.md before adding.
 *
 * All values are design decisions, not historical claims.
 */

const TRANSITIONAL_SERIF =
  "Baskerville, 'Baskerville Old Face', 'Libre Baskerville', 'Times New Roman', serif";
const BOOK_SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";
const ENGRAVED_CAPS =
  "Copperplate, 'Copperplate Gothic Light', 'Baskerville Old Face', Baskerville, serif";

/**
 * Asset manifest. All seven page slots now carry FINAL generated artwork
 * (project-directed, externally generated, web-optimised WebP under
 * public/yol1769/ — masters live outside the repository). The paper
 * texture tile remains the in-project SVG. Nothing here is archival media
 * and nothing carries baked-in interface text.
 */
const ASSETS_1769: AssetRecord[] = [
  {
    id: 'hero-1769',
    path: '/yol1769/hero-1769.webp',
    role: 'hero',
    section: 'hero',
    crop: 'focal',
    focal: { x: 0.74, y: 0.45 },
    aspectRatio: '21 / 9',
    treatment: 'engraved-plate',
    alt: 'Engraved workshop scene: an engineer adjusts a small steam apparatus on a workbench beside a sextant and drawings, a harbour with a tall ship visible through the window (generated illustration)',
    sourceType: 'generated',
    rights: 'not-applicable',
    attribution: 'Generated illustration, project-directed',
    assetState: 'final',
  },
  {
    id: 'steam-technical-plate',
    path: '/yol1769/steam-technical-plate.webp',
    role: 'diagram',
    section: 'steam',
    crop: 'contain',
    aspectRatio: '4 / 5',
    treatment: 'diagram-plate',
    alt: 'Engraved technical plate of a steam engine: elevation, cut-away section with piston and condenser vessel, and a row of sectioned valves, annotated with unlabelled leader lines (generated illustration)',
    caption: 'Fire-engine improved — sectioned plate',
    sourceType: 'generated',
    rights: 'not-applicable',
    attribution: 'Generated illustration, project-directed',
    assetState: 'final',
  },
  {
    id: 'knowledge-plate',
    path: '/yol1769/knowledge-plate.webp',
    role: 'editorial-illustration',
    section: 'knowledge',
    crop: 'cover',
    focal: { x: 0.5, y: 0.45 },
    aspectRatio: '4 / 3',
    treatment: 'engraved-plate',
    alt: 'Engraved encyclopaedia sheet in specimen rows: measuring instruments, gears and mill parts, then raw materials — cotton, cloth, rope, coal, ore, fruit and shells (generated illustration)',
    caption: 'A sheet of engraved knowledge',
    sourceType: 'generated',
    rights: 'not-applicable',
    attribution: 'Generated illustration, project-directed',
    assetState: 'final',
  },
  {
    id: 'trade-map',
    path: '/yol1769/trade-map.webp',
    role: 'map',
    section: 'trade',
    crop: 'cover',
    focal: { x: 0.5, y: 0.42 },
    aspectRatio: '2 / 1',
    treatment: 'map-sheet',
    alt: 'Engraved world chart with graticule and rhumb lines, voyage tracks crossing the oceans, a transit diagram inset at one corner and a sextant inset at the other (generated illustration)',
    caption: 'Ocean tracks and observations',
    sourceType: 'generated',
    rights: 'not-applicable',
    attribution: 'Generated illustration, project-directed',
    assetState: 'final',
  },
  {
    id: 'labour-scene',
    path: '/yol1769/labour-scene.webp',
    role: 'event',
    section: 'labour',
    crop: 'focal',
    focal: { x: 0.55, y: 0.45 },
    aspectRatio: '3 / 2',
    treatment: 'engraved-plate',
    alt: 'Engraved workshop interior: a woman at a spinning wheel, a man feeding cotton into a multi-bobbin spinning frame, baskets of raw cotton and wound spools on the bench (generated illustration)',
    caption: 'The frame and the hand',
    sourceType: 'generated',
    rights: 'not-applicable',
    attribution: 'Generated illustration, project-directed',
    assetState: 'final',
  },
  {
    id: 'closing-panorama-1769',
    path: '/yol1769/closing-panorama-1769.webp',
    role: 'atmosphere',
    section: 'closing',
    crop: 'cover',
    treatment: 'panorama',
    alt: 'Atmospheric aged-paper field: soot gathering in one corner, a faded blue wash in the other, faint construction lines across the sheet (generated illustration)',
    sourceType: 'generated',
    rights: 'not-applicable',
    attribution: 'Generated illustration, project-directed',
    assetState: 'final',
  },
  {
    id: 'transition-plate-1769',
    path: '/yol1769/transition-plate-1769.webp',
    role: 'transition-plate',
    section: 'interlude',
    crop: 'cover',
    aspectRatio: '16 / 9',
    treatment: 'engraved-plate',
    alt: 'Measured transit diagram: an engraved sun disc of concentric rings crossed by a dotted measurement line carrying the small black disc of Venus, held by brass instrument fittings (generated illustration)',
    caption: 'The transit, measured',
    sourceType: 'generated',
    rights: 'not-applicable',
    attribution: 'Generated illustration, project-directed',
    assetState: 'final',
  },
  {
    id: 'texture-paper-1769',
    path: '/yol1769/slots/texture-paper.svg',
    role: 'texture',
    alt: 'Rag-paper and soot texture tile (generated in-project, decorative)',
    sourceType: 'generated',
    rights: 'not-applicable',
    assetState: 'final',
  },
];

export const IDENTITY_1769: YearVisualIdentity = {
  yearId: '1769',
  label: '1769 — mechanism, measurement, engraved knowledge',
  palette: {
    /* starting palette from the product brief (paper/ink/oxide/brass/soot/
       faded blue); inkBody lightened a step from raw ink for long-form
       legibility on rag paper — documented adjustment. */
    paper: '#d8c7a3',
    plate: '#34302b',
    sky: '#241e17',
    inkStrong: '#211b16',
    inkBody: '#3a3229',
    inkMuted: '#7d6f58',
    plateInk: '#e2d5b8',
    plateInkMuted: '#9a8c72',
    accent: '#8e4d32',
    accentAlt: '#a57a3a',
    signal: '#65717a',
    warning: '#7a2a1a',
    surfaceAlt: '#cdbb94',
  },
  typography: {
    yearDisplay: { family: TRANSITIONAL_SERIF, weight: 400, letterSpacing: '0.01em' },
    headline: { family: TRANSITIONAL_SERIF, weight: 400, letterSpacing: '0.005em' },
    body: { family: BOOK_SERIF, weight: 400 },
    themeLabel: { family: ENGRAVED_CAPS, weight: 400, letterSpacing: '0.18em', transform: 'uppercase' },
    technical: { family: ENGRAVED_CAPS, weight: 400, letterSpacing: '0.12em', transform: 'uppercase' },
    caption: { family: BOOK_SERIF, weight: 400, style: 'italic' },
    metadata: { family: ENGRAVED_CAPS, weight: 400, letterSpacing: '0.3em', transform: 'uppercase' },
  },
  layout: {
    /* book-page margins, narrower measure, one measured (non-alternating)
       broadsheet side — a different grid language from 1969 */
    maxWidth: '64rem',
    gutter: '6vw',
    heroSplit: 'minmax(400px, 44vw) 1fr',
    alternate: false,
    sectionGap: '15vh',
    heroArtRadius: '0',
    heroMotif: 'folio-marks',
  },
  media: {
    grainOpacity: 0.22,
    halftoneSize: '3px',
    hairline: 'rgba(33, 27, 22, 0.42)',
    cornerRadius: '0px',
    arcCorner: '0px',
    baseFilter: 'sepia(0.14) saturate(0.8) contrast(1.06)',
  },
  motion: {
    /* mechanical: short, decisive pressure rather than airy drift */
    revealRise: '14px',
    revealDuration: '0.65s',
    easing: 'cubic-bezier(0.65, 0, 0.25, 1)',
    pulsePeriod: '1.82s',
    sectionTransition: 'fade-rise',
  },
  motifs: [
    'engraved-rules',
    'plate-mark',
    'graticule',
    'gear-section',
    'hatching',
    'folio-marks',
  ],
  themes: {
    steam: { accent: '#8e4d32', motif: 'gear-section', surface: 'plate' },
    knowledge: { accent: '#a57a3a', motif: 'engraved-rules', surface: 'paper' },
    trade: { accent: '#65717a', motif: 'graticule', surface: 'paper' },
    labour: { accent: '#6b5138', motif: 'hatching', surface: 'plate' },
  },
  assets: ASSETS_1769,
  notes:
    'Copperplate engraving as the base voice: plate marks, hatching, measured annotation. Cartographic archive for trade/exploration; soot plates for steam and labour; brass and oxide accents; no space-age arcs, no scanlines, no halftone dots. Motion is registration and pressure, not drift.',
};
