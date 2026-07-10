import type { AssetRecord, AssetRole, YearVisualIdentity } from './types';
import { IDENTITY_1969 } from './year-1969';
import { IDENTITY_1769 } from './year-1769';

export * from './types';
export { IDENTITY_1969 } from './year-1969';
export { IDENTITY_1769 } from './year-1769';

/**
 * Fallback identity: the restrained, near-timeless voice a year gets before
 * a period identity has been designed for it. Derived from the shared core
 * tokens so an un-designed year still feels like The Line.
 */
export const DEFAULT_IDENTITY: YearVisualIdentity = {
  yearId: 'default',
  label: 'Default (no period identity designed yet)',
  palette: {
    paper: '#efece4',
    plate: '#101216',
    sky: '#0b1420',
    inkStrong: '#26241e',
    inkBody: '#45423a',
    inkMuted: '#84806f',
    plateInk: '#d8dee8',
    plateInkMuted: '#8a94a6',
    accent: '#a4552e',
    accentAlt: '#e8b84a',
    signal: '#7fa8d9',
    warning: '#8f2116',
    surfaceAlt: '#e4e0d4',
  },
  typography: {
    yearDisplay: { family: "Georgia, 'Times New Roman', serif", weight: 400 },
    headline: { family: "Georgia, 'Times New Roman', serif", weight: 400 },
    body: { family: "Georgia, 'Times New Roman', serif", weight: 400 },
    themeLabel: {
      family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      weight: 500, letterSpacing: '0.14em', transform: 'uppercase',
    },
    technical: { family: "ui-monospace, 'SF Mono', Menlo, monospace", weight: 400 },
    caption: { family: "ui-monospace, 'SF Mono', Menlo, monospace", weight: 400 },
    metadata: {
      family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      weight: 500, letterSpacing: '0.26em', transform: 'uppercase',
    },
  },
  layout: {
    maxWidth: '70rem',
    gutter: '4vw',
    heroSplit: 'minmax(340px, 31vw) 1fr',
    alternate: true,
    sectionGap: '12vh',
  },
  media: {
    grainOpacity: 0.08,
    halftoneSize: '5px',
    hairline: 'rgba(40, 36, 28, 0.24)',
    cornerRadius: '3px',
    arcCorner: '58px',
    baseFilter: 'saturate(0.96)',
  },
  motion: {
    revealRise: '28px',
    revealDuration: '0.9s',
    easing: 'ease',
    pulsePeriod: '1.82s',
    sectionTransition: 'fade-rise',
  },
  motifs: [],
  themes: {},
  assets: [],
};

const IDENTITIES: Record<string, YearVisualIdentity> = {
  '1769': IDENTITY_1769,
  '1969': IDENTITY_1969,
};

/** Identity for a year; falls back to the neutral identity when a year has
 *  no designed period language yet. */
export function getYearIdentity(yearId: string): YearVisualIdentity {
  return IDENTITIES[yearId] ?? DEFAULT_IDENTITY;
}

/** Look up an asset in an identity's manifest. */
export function getAsset(identity: YearVisualIdentity, id: string) {
  return identity.assets.find((a) => a.id === id) ?? null;
}

/** First asset carrying a given role (hero, atmosphere, texture, …). */
export function getRoleAsset(
  identity: YearVisualIdentity,
  role: AssetRole
): AssetRecord | null {
  return identity.assets.find((a) => a.role === role) ?? null;
}

/** Roles that can illustrate an event/lens section. */
const SECTION_ROLES: AssetRole[] = [
  'event',
  'diagram',
  'map',
  'editorial-illustration',
  'invention',
  'person',
];

/** The asset that illustrates a page section, resolved from the manifest
 *  (never hard-coded per year in components). */
export function getSectionAsset(
  identity: YearVisualIdentity,
  section: string
): AssetRecord | null {
  return (
    identity.assets.find(
      (a) => a.section === section && SECTION_ROLES.includes(a.role)
    ) ?? null
  );
}
