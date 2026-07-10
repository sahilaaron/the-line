/**
 * The YoL read-model contract: the typed JSON shape `GET /api/yol/[anchorSlug]`
 * returns and the client accessor consumes. Deliberately independent of
 * Drizzle row types (src/db stays server-side) and of renderer view models
 * (src/experience adapts this into its own view model).
 *
 * Dates are astronomical-year integers plus optional 1-based month/day parts.
 * JS `Date` is never used — it cannot represent BCE or deep-past years safely.
 */

export type YolPointRole = 'overview' | 'development' | 'context' | 'closing';
export type YolProvenance = 'placeholder' | 'reviewed';

export interface YolDate {
  /** astronomical year (1 BCE = 0, 10,000 BCE = -9999) */
  year: number;
  month?: number;
  day?: number;
  endYear?: number;
  endMonth?: number;
  endDay?: number;
  precision: string;
  uncertain: boolean;
  /** human-readable, BCE-safe display string built server-side */
  display: string;
}

export interface YolSourceRef {
  title: string;
  type: string;
  publicationYear: number | null;
  /** where in the source (claim_sources.locator), if recorded */
  locator: string | null;
  quotation: string | null;
}

export interface YolClaimRef {
  text: string;
  verificationStatus: string;
  disputed: boolean;
  confidence: number;
  sources: YolSourceRef[];
}

export interface YolMediaRef {
  id: string;
  title: string;
  mediaType: string;
  rightsStatus: string;
  uri: string | null;
  attribution: string | null;
}

export interface YolThemeModel {
  /** stable renderer lens key (e.g. 'spaceflight', 'steam') */
  lensKey: string;
  /** structural anchor label (theme entity label) */
  label: string;
  /** long-form YoL label; falls back to `label` when uncurated */
  displayLabel: string;
  colorHex: string | null;
  importance: number;
  displayOrder: number;
}

export interface YolPointModel {
  id: string;
  role: YolPointRole;
  displayOrder: number;
  /** presentation bridge to the year identity's manifest section */
  sectionKey: string | null;
  headline: string;
  summary: string;
  entity: { slug: string; kind: string; label: string } | null;
  date: YolDate | null;
  /** lens keys of associated themes */
  themes: string[];
  claims: YolClaimRef[];
  media: YolMediaRef[];
  provenance: YolProvenance;
  editorialStatus: string;
}

export interface YolReadModel {
  anchorSlug: string;
  enteredYear: number;
  title: string;
  thesis: string;
  supportingLine: string | null;
  atmospherePreset: string;
  provenance: YolProvenance;
  editorialStatus: string;
  themes: YolThemeModel[];
  points: YolPointModel[];
}

/** API envelope. Failure shapes carry NO paths, SQL or stack traces. */
export type YolApiResponse =
  | { status: 'ok'; model: YolReadModel }
  | { status: 'not_found' }
  | { status: 'empty' }
  | { status: 'error' };

/* ---------------------------------------------------------------- */
/* BCE-safe date display formatting (pure; no JS Date anywhere)      */
/* ---------------------------------------------------------------- */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** "1969" / "c. 10,000 BCE" — matches src/experience/time.ts formatYear. */
export function formatAstronomicalYear(year: number, approximate = false): string {
  const prefix = approximate ? 'c. ' : '';
  if (year <= 0) return `${prefix}${(1 - year).toLocaleString('en-US')} BCE`;
  return `${prefix}${String(year)}`;
}

export interface DateParts {
  year: number;
  month?: number | null;
  day?: number | null;
  endYear?: number | null;
  endMonth?: number | null;
  endDay?: number | null;
  precision?: string;
}

/**
 * Builds "July 20, 1969", "August 15–18, 1969", "January 1769", "1769",
 * "c. 10,000 BCE" from integer date parts. Never touches JS Date.
 */
export function formatYolDate(p: DateParts): string {
  const approx = p.precision === 'approximate' || p.precision === 'era';
  const y = formatAstronomicalYear(p.year, approx);
  if (!p.month) return y;
  const m = MONTHS[p.month - 1] ?? `Month ${p.month}`;
  const sameYear = p.endYear == null || p.endYear === p.year;
  const sameMonth = p.endMonth == null || (p.endMonth === p.month && sameYear);
  if (!p.day) {
    if (!sameYear) return `${m} ${y} – ${formatAstronomicalYear(p.endYear!, approx)}`;
    if (!sameMonth) return `${m}–${MONTHS[(p.endMonth ?? p.month) - 1]} ${y}`;
    return `${m} ${y}`;
  }
  if (p.endDay != null && sameMonth && p.endDay !== p.day) {
    return `${m} ${p.day}–${p.endDay}, ${y}`;
  }
  if (p.endDay != null && !sameMonth && sameYear) {
    return `${m} ${p.day} – ${MONTHS[(p.endMonth ?? p.month) - 1]} ${p.endDay}, ${y}`;
  }
  return `${m} ${p.day}, ${y}`;
}
