/**
 * The single view model the YoL renderer consumes — whether the data came
 * from the database read model (primary) or the isolated TypeScript
 * prototype registry (emergency/development fallback). YolPage and the
 * local-timeline components read ONLY this shape; they never see raw DB
 * structures and never care which source produced it.
 */
import type { Anchor } from '@/src/data/types';
import type { YearYol } from '@/src/data/yol';
import type { YolPointRole, YolReadModel } from '@/src/domain/yol-read-model';
import { formatYear } from '../time';

export interface YolLensVM {
  key: string;
  label: string;
  hue: string;
}

export interface YolPointVM {
  id: string;
  role: YolPointRole;
  /** astronomical year, for ordering/labels along the local line */
  year: number;
  /** tick label on the local line ("1967", "c. 10,000 BCE") */
  yearLabel: string;
  /** full display date ("July 20, 1969"); empty for overview/closing */
  dateLabel: string;
  /** short label under the point's tick on the local Line ("Jul 20") */
  tickLabel: string;
  headline: string;
  summary: string;
  /** lens keys this point responds to; overview/closing never dim */
  themes: string[];
  /** presentation bridge to the year identity's manifest section */
  sectionKey: string | null;
  provenance: 'placeholder' | 'reviewed';
  /** flattened source references for honest provenance display */
  sources: { title: string; locator: string | null }[];
}

export interface YolViewModel {
  source: 'database' | 'fallback';
  yearId: string;
  title: string;
  thesis: string;
  supportingLine: string | null;
  lenses: YolLensVM[];
  points: YolPointVM[];
  /** index of the entered year's overview — the initial active position */
  initialIndex: number;
}

/** Lens keys are normalised anchor theme ids ('cold-war' -> 'coldwar'). */
export const lensKey = (themeId: string) => themeId.replace(/-/g, '');

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "July 20, 1969" -> "Jul 20"; "August 15–18, 1969" -> "Aug 15–18". */
export function shortDateLabel(dateLabel: string): string {
  const withoutYear = dateLabel.replace(/,?\s*(c\.\s*)?[\d,]+( BCE)?\s*$/, '').trim();
  if (!withoutYear) return '';
  return withoutYear.replace(/^([A-Za-z]+)/, (m) => {
    const idx = MONTH_ABBREV.findIndex((a) => m.startsWith(a));
    return idx >= 0 ? MONTH_ABBREV[idx] : m;
  });
}

function anchorHueByLens(anchor: Anchor): Map<string, string> {
  return new Map(anchor.themes.map((t) => [lensKey(t.id), t.color]));
}

/* ------------------------------------------------------------------ */
/* database read model -> view model                                   */
/* ------------------------------------------------------------------ */

export function dbToViewModel(model: YolReadModel, anchor: Anchor): YolViewModel {
  const hues = anchorHueByLens(anchor);
  const lenses: YolLensVM[] = model.themes.map((t) => ({
    key: t.lensKey,
    label: t.displayLabel,
    hue: t.colorHex ?? hues.get(t.lensKey) ?? '#c9b28a',
  }));

  const points: YolPointVM[] = model.points.map((p) => {
    const year = p.date?.year ?? anchor.year;
    const isYearOnly = !p.date?.month;
    const dateLabel =
      p.role === 'overview' || p.role === 'closing' || isYearOnly ? '' : (p.date?.display ?? '');
    return {
      id: p.id,
      role: p.role,
      year,
      yearLabel: formatYear(year),
      dateLabel,
      tickLabel:
        p.role === 'closing' ? '' : dateLabel ? shortDateLabel(dateLabel) : formatYear(year),
      headline: p.role === 'overview' ? model.title : p.headline,
      summary: p.role === 'overview' ? model.thesis : p.summary,
      themes: p.themes,
      sectionKey: p.sectionKey,
      provenance: p.provenance,
      sources: p.claims.flatMap((c) => c.sources.map((s) => ({ title: s.title, locator: s.locator }))),
    };
  });

  return {
    source: 'database',
    yearId: model.anchorSlug,
    title: model.title,
    thesis: model.thesis,
    supportingLine: model.supportingLine,
    lenses,
    points,
    initialIndex: Math.max(0, points.findIndex((p) => p.role === 'overview')),
  };
}

/* ------------------------------------------------------------------ */
/* prototype registry -> view model (fallback only)                    */
/* ------------------------------------------------------------------ */

export function fallbackViewModel(yearYol: YearYol, anchor: Anchor): YolViewModel {
  const lenses: YolLensVM[] = anchor.themes.map((t, i) => ({
    key: lensKey(t.id),
    label: yearYol.content.themeLabels[i] ?? t.label,
    hue: t.color,
  }));

  const points: YolPointVM[] = [];
  const push = (p: Omit<YolPointVM, 'yearLabel' | 'tickLabel'>) =>
    points.push({
      ...p,
      yearLabel: formatYear(p.year),
      tickLabel:
        p.role === 'closing' ? '' : p.dateLabel ? shortDateLabel(p.dateLabel) : formatYear(p.year),
    });

  const neighbours = yearYol.neighbours
    .filter((n) => !n.active)
    .map((n) => ({ ...n, yearNum: Number.parseInt(n.year, 10) }))
    .filter((n) => Number.isFinite(n.yearNum));

  for (const n of neighbours.filter((n) => n.yearNum < anchor.year)) {
    push({
      id: `ctx-${n.yearNum}`,
      role: 'context',
      year: n.yearNum,
      dateLabel: '',
      headline: n.label,
      summary: '',
      themes: [],
      sectionKey: null,
      provenance: 'placeholder',
      sources: [],
    });
  }

  push({
    id: 'overview',
    role: 'overview',
    year: anchor.year,
    dateLabel: '',
    headline: yearYol.content.title,
    summary: yearYol.content.thesis,
    themes: [],
    sectionKey: 'overview',
    provenance: 'placeholder',
    sources: [],
  });

  for (const ev of yearYol.events) {
    push({
      id: ev.id,
      role: 'development',
      year: anchor.year,
      dateLabel: ev.date === yearYol.content.title ? '' : ev.date,
      headline: ev.title,
      summary: ev.text,
      themes: ev.themes,
      sectionKey: ev.section,
      provenance: 'placeholder',
      sources: [],
    });
  }

  for (const n of neighbours.filter((n) => n.yearNum > anchor.year)) {
    push({
      id: `ctx-${n.yearNum}`,
      role: 'context',
      year: n.yearNum,
      dateLabel: '',
      headline: n.label,
      summary: '',
      themes: [],
      sectionKey: null,
      provenance: 'placeholder',
      sources: [],
    });
  }

  push({
    id: 'closing',
    role: 'closing',
    year: anchor.year,
    dateLabel: '',
    headline: `${yearYol.content.title} hands back to the Line`,
    summary: '',
    themes: [],
    sectionKey: 'closing',
    provenance: 'placeholder',
    sources: [],
  });

  return {
    source: 'fallback',
    yearId: anchor.id,
    title: yearYol.content.title,
    thesis: yearYol.content.thesis,
    supportingLine: anchor.subtitle,
    lenses,
    points,
    initialIndex: points.findIndex((p) => p.role === 'overview'),
  };
}
