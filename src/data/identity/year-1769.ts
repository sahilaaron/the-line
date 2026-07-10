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
 * Asset manifest. EVERY 1769 image is currently a named placeholder slot
 * (dev surface, no baked-in text, no rights claims): final artwork is
 * generated externally and swapped in by path without layout rewrites.
 */
const ASSETS_1769: AssetRecord[] = [
  {
    id: 'hero-1769',
    path: '/yol1769/slots/hero.svg',
    role: 'hero',
    section: 'hero',
    crop: 'cover',
    aspectRatio: '4 / 5',
    treatment: 'engraved-plate',
    alt: 'Placeholder slot: engraved composite of 1769 — beam engine, astronomical instruments, chart lines and mill wheels (awaiting generated artwork)',
    sourceType: 'placeholder',
    rights: 'not-applicable',
    assetState: 'placeholder',
  },
  {
    id: 'steam-technical-plate',
    path: '/yol1769/slots/steam-plate.svg',
    role: 'diagram',
    section: 'steam',
    crop: 'contain',
    aspectRatio: '4 / 3',
    treatment: 'diagram-plate',
    alt: 'Placeholder slot: engraved technical plate of a steam engine with separate condenser, sectioned and annotated (awaiting generated artwork)',
    caption: 'Fire-engine improved — technical plate',
    sourceType: 'placeholder',
    rights: 'not-applicable',
    assetState: 'placeholder',
  },
  {
    id: 'knowledge-plate',
    path: '/yol1769/slots/knowledge-plate.svg',
    role: 'editorial-illustration',
    section: 'knowledge',
    crop: 'cover',
    aspectRatio: '4 / 3',
    treatment: 'engraved-plate',
    alt: 'Placeholder slot: engraved encyclopaedia plate — instruments, mechanisms and specimen figures on one sheet (awaiting generated artwork)',
    caption: 'A sheet of engraved knowledge',
    sourceType: 'placeholder',
    rights: 'not-applicable',
    assetState: 'placeholder',
  },
  {
    id: 'trade-map',
    path: '/yol1769/slots/trade-map.svg',
    role: 'map',
    section: 'trade',
    crop: 'cover',
    aspectRatio: '16 / 10',
    treatment: 'map-sheet',
    alt: 'Placeholder slot: cartographic archive sheet — ocean tracks, graticule and coastline engraving (awaiting generated artwork)',
    caption: 'Ocean tracks and observations',
    sourceType: 'placeholder',
    rights: 'not-applicable',
    assetState: 'placeholder',
  },
  {
    id: 'labour-scene',
    path: '/yol1769/slots/labour-scene.svg',
    role: 'event',
    section: 'labour',
    crop: 'cover',
    focal: { x: 0.5, y: 0.42 },
    aspectRatio: '4 / 3',
    treatment: 'engraved-plate',
    alt: 'Placeholder slot: engraved scene of spinning frames and mill machinery beside hand workers (awaiting generated artwork)',
    caption: 'The frame and the hand',
    sourceType: 'placeholder',
    rights: 'not-applicable',
    assetState: 'placeholder',
  },
  {
    id: 'closing-panorama-1769',
    path: '/yol1769/slots/closing-panorama.svg',
    role: 'atmosphere',
    section: 'closing',
    treatment: 'panorama',
    alt: 'Placeholder slot: engraved panorama — a low horizon of mills, masts and smoke under a measured sky (awaiting generated artwork)',
    sourceType: 'placeholder',
    rights: 'not-applicable',
    assetState: 'placeholder',
  },
  {
    id: 'transition-plate-1769',
    path: '/yol1769/slots/transition-plate.svg',
    role: 'transition-plate',
    section: 'interlude',
    alt: 'Placeholder slot: mechanical transition asset — aperture of gears and plate rings (awaiting generated artwork)',
    sourceType: 'placeholder',
    rights: 'not-applicable',
    assetState: 'placeholder',
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
