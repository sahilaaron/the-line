/**
 * Year Visual Identity — the typed model through which every Year on Line
 * defines its own period visual language (palette, typography, grid, media
 * treatment, motifs, motion), while The Line's structural identity
 * (navigation, the Line strip, active-year pulse, theme behaviour, caption
 * conventions) stays constant across years.
 *
 * Identity data is DESIGN data, not historical fact. Nothing here may be
 * presented as an archival claim; see AssetRecord.sourceType/rights.
 */

/* ---------- assets ---------- */

export type AssetRole =
  | 'hero'
  | 'atmosphere'
  | 'section-background'
  | 'editorial-illustration'
  | 'event'
  | 'person'
  | 'invention'
  | 'diagram'
  | 'map'
  | 'texture'
  | 'transition-plate';

/** Provenance of the image itself. Generated/reconstructed media must never
 *  be labelled archival, and placeholder slots carry no rights claims. */
export type AssetSourceType =
  | 'archival'
  | 'generated'
  | 'reconstructed'
  | 'placeholder';

export type AssetRights = 'cleared' | 'pending' | 'not-applicable';

export type CropBehaviour = 'cover' | 'contain' | 'focal' | 'top';

/** Reusable media presentation treatments (see overlay/media/MediaFrame). */
export type TreatmentPreset =
  | 'full-bleed'
  | 'split'
  | 'contact-sheet'
  | 'halftone'
  | 'diagram-plate'
  | 'engraved-plate'
  | 'map-sheet'
  | 'archival-frame'
  | 'collage'
  | 'panorama'
  | 'cutout'
  | 'captioned';

export interface AssetRecord {
  id: string;
  /** file under /public; placeholder slots point at dev surfaces */
  path: string;
  role: AssetRole;
  /** section/slot association, e.g. 'spaceflight', 'steam', 'closing' */
  section?: string;
  /** 0..1 focal point used by 'focal' cropping and responsive crops */
  focal?: { x: number; y: number };
  crop?: CropBehaviour;
  /** preferred aspect ratio for the final artwork, e.g. '4 / 3' */
  aspectRatio?: string;
  treatment?: TreatmentPreset;
  alt: string;
  caption?: string;
  sourceType: AssetSourceType;
  rights: AssetRights;
  attribution?: string;
  /**
   * Whether this record still points at a placeholder surface or at the
   * final artwork. Final generated images replace placeholders by swapping
   * `path` (+ flipping this) — never by rewriting layout.
   */
  assetState: 'placeholder' | 'final';
}

/* ---------- palette ---------- */

/** Semantic palette tokens; every value is a CSS colour. */
export interface IdentityPalette {
  /** primary editorial surface */
  paper: string;
  /** dark print/broadcast surface for plate sections */
  plate: string;
  /** the sky this year sits under (descent hand-off) */
  sky: string;
  inkStrong: string;
  inkBody: string;
  inkMuted: string;
  /** light inks for text on plate sections */
  plateInk: string;
  plateInkMuted: string;
  /** period accent (e.g. 1969 rust, 1769 oxide) */
  accent: string;
  /** secondary accent (e.g. ochre, brass) */
  accentAlt: string;
  /** analogue signal colour (e.g. oscilloscope green, cartographic blue) */
  signal: string;
  /** restrained warning red */
  warning: string;
  /** secondary light surface */
  surfaceAlt: string;
}

/* ---------- typography ---------- */

export interface TypographyRole {
  family: string;
  weight: number;
  letterSpacing?: string;
  transform?: 'uppercase' | 'none';
  style?: 'italic' | 'normal';
}

/** Period-appropriate roles. All text is DOM-rendered, never baked into
 *  images. Families must be legally available (local stacks or documented
 *  project fonts). */
export interface IdentityTypography {
  yearDisplay: TypographyRole;
  headline: TypographyRole;
  body: TypographyRole;
  themeLabel: TypographyRole;
  technical: TypographyRole;
  caption: TypographyRole;
  metadata: TypographyRole;
}

/* ---------- layout / media / motion ---------- */

export interface IdentityLayout {
  /** max content width for editorial sections */
  maxWidth: string;
  gutter: string;
  /** hero grid template (left column vs art) */
  heroSplit: string;
  /** alternate section sides (broadsheet years may keep one measured side) */
  alternate: boolean;
  sectionGap: string;
  /** border-radius shorthand for the hero art block (period shape language) */
  heroArtRadius?: string;
  /** decorative motif on the hero title block (e.g. crop marks, folios) */
  heroMotif?: MotifId;
}

export interface IdentityMedia {
  /** 0..1 period grain/paper strength over imagery */
  grainOpacity: number;
  /** halftone dot cell size (CSS length) */
  halftoneSize: string;
  /** hairline colour for frames/rules */
  hairline: string;
  cornerRadius: string;
  /** the recurring arc corner (structural echo of the hero) */
  arcCorner: string;
  /** base filter applied to period imagery (keep legibility!) */
  baseFilter: string;
}

export interface IdentityMotion {
  revealRise: string;
  revealDuration: string;
  easing: string;
  /** active-year pulse period — shared with the 3D LinePulse rhythm */
  pulsePeriod: string;
  sectionTransition: 'fade-rise' | 'cut';
}

/* ---------- motifs / themes ---------- */

export type MotifId =
  /* 1969 — print/broadcast modernism */
  | 'orbital-diagram'
  | 'scanlines'
  | 'halftone-dots'
  | 'punch-card'
  | 'waveform'
  | 'crop-marks'
  | 'registration-marks'
  | 'screen-print'
  | 'contact-sheet-strip'
  /* 1769 — mechanism / measurement / engraved knowledge */
  | 'engraved-rules'
  | 'plate-mark'
  | 'graticule'
  | 'gear-section'
  | 'hatching'
  | 'folio-marks';

/** Per-theme visual overrides inside the year (lens substyles). */
export interface ThemeSubstyle {
  accent: string;
  motif?: MotifId;
  /** section surface override: 'paper' | 'plate' */
  surface?: 'paper' | 'plate';
}

/* ---------- the identity ---------- */

export interface YearVisualIdentity {
  yearId: string;
  label: string;
  palette: IdentityPalette;
  typography: IdentityTypography;
  layout: IdentityLayout;
  media: IdentityMedia;
  motion: IdentityMotion;
  /** dominant motifs available to sections of this year */
  motifs: MotifId[];
  /** keyed by theme focus key (spaceflight, steam, …) or substyle name */
  themes: Record<string, ThemeSubstyle>;
  assets: AssetRecord[];
  /** short design rationale (docs, not UI) */
  notes?: string;
}
