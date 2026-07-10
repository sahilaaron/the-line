import type { AssetRecord, YearVisualIdentity } from './types';

/**
 * 1969 — Year Visual Identity.
 *
 * Direction: space-age editorial modernism (geometric grids, strong
 * grotesque display type, technical/orbital diagrams, warm cream/rust/
 * ochre/black), documentary print (halftone, newspaper contrast, typed
 * captions, crop marks), analogue computing & broadcast (scanlines,
 * waveforms, punch-card patterns, oscilloscope green on dark plates), and
 * counterculture graphics used ONLY in music/youth/social-change sections.
 *
 * Typography uses legally available local stacks that are also period-
 * plausible: Helvetica (1957) for display/headline, Georgia as the
 * newspaper-serif body, Courier (1955) for typed captions and technical
 * annotation. If richer fonts are wanted later, document them in
 * docs/year-visual-identity.md before adding.
 *
 * All values are design decisions, not historical claims.
 */

const GROTESQUE = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const NEWS_SERIF = "Georgia, 'Times New Roman', serif";
const TYPEWRITER = "'Courier New', Courier, monospace";

/** Asset manifest. Existing crops are illustrative reconstructions from the
 * project-directed collage; `slots/*` are dev surfaces awaiting externally
 * generated imagery (named slots, no text baked into images, no rights
 * claims for non-archival media). */
const ASSETS_1969: AssetRecord[] = [
  {
    id: 'hero-opening',
    path: '/yol1969/hero.jpg',
    role: 'hero',
    section: 'hero',
    crop: 'cover',
    treatment: 'split',
    alt: 'Collage of 1969: a rocket launch, the Earth, protest crowds, musicians and city streets (illustrative reconstruction)',
    sourceType: 'reconstructed',
    rights: 'not-applicable',
    attribution: 'Illustrative reconstruction, project-directed',
    assetState: 'final',
  },
  {
    id: 'spaceflight-main',
    path: '/yol1969/rocket.jpg',
    role: 'event',
    section: 'spaceflight',
    crop: 'cover',
    focal: { x: 0.5, y: 0.3 },
    treatment: 'diagram-plate',
    alt: 'Rocket on a launch tower, stylised collage detail (illustrative reconstruction)',
    caption: 'Saturn-class launch vehicle — reconstruction',
    sourceType: 'reconstructed',
    rights: 'not-applicable',
    assetState: 'final',
  },
  {
    id: 'signal-main',
    path: '/yol1969/broadcast.jpg',
    role: 'event',
    section: 'signal',
    crop: 'cover',
    treatment: 'halftone',
    alt: 'Television sets and satellite dishes carrying the broadcast (illustrative reconstruction)',
    caption: 'The broadcast relay — reconstruction',
    sourceType: 'reconstructed',
    rights: 'not-applicable',
    assetState: 'final',
  },
  {
    id: 'computing-main',
    path: '/yol1969/globe.jpg',
    role: 'event',
    section: 'computing',
    crop: 'cover',
    treatment: 'archival-frame',
    alt: 'Globe with early network nodes drawn across it (illustrative reconstruction)',
    caption: 'Two nodes, one message — reconstruction',
    sourceType: 'reconstructed',
    rights: 'not-applicable',
    assetState: 'final',
  },
  {
    id: 'conflict-main',
    path: '/yol1969/protest.jpg',
    role: 'event',
    section: 'coldwar',
    crop: 'cover',
    treatment: 'halftone',
    alt: 'Protest crowd with placards (illustrative reconstruction)',
    caption: 'Moratorium day crowds — reconstruction',
    sourceType: 'reconstructed',
    rights: 'not-applicable',
    assetState: 'final',
  },
  {
    id: 'counterculture-main',
    path: '/yol1969/musician.jpg',
    role: 'event',
    section: 'counterculture',
    crop: 'cover',
    treatment: 'cutout',
    alt: 'Musician performing, saturated screen-print styling (illustrative reconstruction)',
    caption: 'Three days of music — reconstruction',
    sourceType: 'reconstructed',
    rights: 'not-applicable',
    assetState: 'final',
  },
  {
    id: 'ordinary-life-main',
    path: '/yol1969/streets.jpg',
    role: 'event',
    section: 'ordinary-life',
    crop: 'cover',
    treatment: 'contact-sheet',
    alt: 'Crowded city street in motion (illustrative reconstruction)',
    caption: 'A street, any street — reconstruction',
    sourceType: 'reconstructed',
    rights: 'not-applicable',
    assetState: 'final',
  },

  /* ---- named slots awaiting externally generated imagery ---- */
  {
    id: 'slot-civil-rights',
    path: '/yol1969/slots/civil-rights.svg',
    role: 'editorial-illustration',
    section: 'civil-rights',
    treatment: 'halftone',
    alt: 'Placeholder slot: civil rights and protest imagery (to be generated)',
    sourceType: 'placeholder',
    rights: 'not-applicable',
    assetState: 'placeholder',
  },
  {
    id: 'slot-vietnam',
    path: '/yol1969/slots/vietnam.svg',
    role: 'editorial-illustration',
    section: 'vietnam',
    treatment: 'halftone',
    alt: 'Placeholder slot: Vietnam and conflict imagery (to be generated)',
    sourceType: 'placeholder',
    rights: 'not-applicable',
    assetState: 'placeholder',
  },
  {
    id: 'slot-fashion',
    path: '/yol1969/slots/fashion.svg',
    role: 'editorial-illustration',
    section: 'counterculture',
    treatment: 'cutout',
    alt: 'Placeholder slot: fashion and counterculture imagery (to be generated)',
    sourceType: 'placeholder',
    rights: 'not-applicable',
    assetState: 'placeholder',
  },
  {
    id: 'slot-closing',
    path: '/yol1969/slots/closing.svg',
    role: 'atmosphere',
    section: 'closing',
    treatment: 'panorama',
    alt: 'Placeholder slot: closing reflection atmosphere (to be generated)',
    sourceType: 'placeholder',
    rights: 'not-applicable',
    assetState: 'placeholder',
  },
  {
    id: 'slot-transition-plate',
    path: '/yol1969/slots/transition-plate.svg',
    role: 'transition-plate',
    section: 'interlude',
    alt: 'Placeholder slot: graphic interlude / transition plate (to be generated)',
    sourceType: 'placeholder',
    rights: 'not-applicable',
    assetState: 'placeholder',
  },
  {
    id: 'texture-grain',
    path: '/yol1969/slots/texture-grain.svg',
    role: 'texture',
    alt: 'Film-grain texture tile (generated in-project, decorative)',
    sourceType: 'generated',
    rights: 'not-applicable',
    assetState: 'final',
  },
];

export const IDENTITY_1969: YearVisualIdentity = {
  yearId: '1969',
  label: '1969 — space-age editorial',
  palette: {
    paper: '#f0e9d8',
    plate: '#161310',
    sky: '#0d1522',
    inkStrong: '#211c14',
    inkBody: '#40382a',
    inkMuted: '#82755c',
    plateInk: '#e8e0cc',
    plateInkMuted: '#938b76',
    accent: '#a4552e',
    accentAlt: '#c9962e',
    signal: '#3fa877',
    warning: '#8f2116',
    surfaceAlt: '#e5dcc4',
  },
  typography: {
    yearDisplay: { family: GROTESQUE, weight: 700, letterSpacing: '-0.035em' },
    headline: { family: GROTESQUE, weight: 700, letterSpacing: '-0.015em' },
    body: { family: NEWS_SERIF, weight: 400 },
    themeLabel: { family: GROTESQUE, weight: 600, letterSpacing: '0.14em', transform: 'uppercase' },
    technical: { family: TYPEWRITER, weight: 400 },
    caption: { family: TYPEWRITER, weight: 400 },
    metadata: { family: GROTESQUE, weight: 500, letterSpacing: '0.26em', transform: 'uppercase' },
  },
  layout: {
    maxWidth: '72rem',
    gutter: '4vw',
    heroSplit: 'minmax(340px, 31vw) 1fr',
    alternate: true,
    sectionGap: '12vh',
    heroArtRadius: '0 0 0 260px',
    heroMotif: 'crop-marks',
  },
  media: {
    grainOpacity: 0.13,
    halftoneSize: '5px',
    hairline: 'rgba(33, 28, 20, 0.26)',
    cornerRadius: '3px',
    arcCorner: '58px',
    baseFilter: 'saturate(0.94) contrast(1.03)',
  },
  motion: {
    revealRise: '30px',
    revealDuration: '0.85s',
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    pulsePeriod: '1.82s',
    sectionTransition: 'fade-rise',
  },
  motifs: [
    'orbital-diagram',
    'halftone-dots',
    'scanlines',
    'punch-card',
    'waveform',
    'crop-marks',
    'registration-marks',
  ],
  themes: {
    spaceflight: { accent: '#8fb3cc', motif: 'orbital-diagram', surface: 'paper' },
    computing: { accent: '#3fa877', motif: 'punch-card', surface: 'plate' },
    signal: { accent: '#57b8a0', motif: 'scanlines', surface: 'plate' },
    coldwar: { accent: '#8f2116', motif: 'halftone-dots', surface: 'paper' },
    /** substyle only — not a lens; music/youth/social-change sections */
    counterculture: { accent: '#c85a8e', motif: 'screen-print', surface: 'paper' },
  },
  assets: ASSETS_1969,
  notes:
    'Space-age editorial modernism as the base voice; documentary print for conflict and protest; analogue broadcast/computing plates in the dark; counterculture colour reserved for Woodstock/youth. Not generic sepia, not global psychedelia.',
};
