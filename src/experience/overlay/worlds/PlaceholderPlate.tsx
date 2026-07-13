'use client';

/**
 * Deterministic placeholder media plate: no image files, no downloads, no
 * rights questions. A seeded gradient + kind-tinted treatment gives every
 * record a stable, visibly-provisional visual so density, proportion and
 * movement can be judged before real media exists. The SAME seed always
 * renders the SAME plate — the shared-element transition and exact
 * restoration rely on that.
 *
 * Treatment variety (border construction, hatch direction, vignette,
 * registration marks, internal diagram geometry, line density) is derived
 * ONLY from the seed via stable hashes — never random, never reshuffled —
 * so a field of plates reads as a varied collage while remaining fully
 * deterministic. These are provisional graphics; they are never archival
 * or reconstructed media and always carry the `placeholder` tag.
 */
import { hash32, unit } from '../../field/layout';

const KIND_HUES: Record<string, number> = {
  person: 28,
  invention: 18,
  discovery: 205,
  event: 355,
  organisation: 45,
  place: 150,
  idea: 265,
};

export interface PlaceholderPlateProps {
  seed: string;
  kind?: string;
  aspectRatio: number;
  /** short label rendered inside the plate (dev/provisional signal) */
  label?: string;
}

const HATCH_ANGLES = [-45, 45, 18, 90, 135, 0] as const;

/** Stable per-seed treatment (0–2) and its parameters — no Math.random. */
export function plateTreatment(seed: string): {
  variant: 0 | 1 | 2;
  hatchAngle: number;
  lineDensity: number;
  vignette: boolean;
  marks: boolean;
  geo: 'orbit' | 'axis' | 'grid' | 'none';
} {
  const v = (hash32(`${seed}:v`) % 3) as 0 | 1 | 2;
  const hatchAngle = HATCH_ANGLES[hash32(`${seed}:ha`) % HATCH_ANGLES.length];
  const lineDensity = 6 + Math.round(unit(`${seed}:ld`) * 8); // 6–14px
  const vignette = unit(`${seed}:vg`) > 0.45;
  const marks = v === 2 || unit(`${seed}:mk`) > 0.7;
  const geoRoll = unit(`${seed}:geo`);
  const geo = geoRoll > 0.72 ? 'orbit' : geoRoll > 0.5 ? 'axis' : geoRoll > 0.3 ? 'grid' : 'none';
  return { variant: v, hatchAngle, lineDensity, vignette, marks, geo };
}

export function plateStyle(seed: string, kind?: string): React.CSSProperties {
  const baseHue = KIND_HUES[kind ?? ''] ?? (hash32(seed) % 360);
  const h1 = (baseHue + unit(`${seed}:h1`) * 24 - 12 + 360) % 360;
  const h2 = (baseHue + 24 + unit(`${seed}:h2`) * 30 + 360) % 360;
  const angle = Math.round(unit(`${seed}:a`) * 360);
  const s1 = 22 + Math.round(unit(`${seed}:s`) * 16);
  const l1 = 26 + Math.round(unit(`${seed}:l`) * 14);
  const t = plateTreatment(seed);
  return {
    background: `linear-gradient(${angle}deg, hsl(${h1} ${s1}% ${l1}%), hsl(${h2} ${s1 - 8}% ${l1 + 16}%))`,
    ['--php-hatch' as string]: `${t.hatchAngle}deg`,
    ['--php-line' as string]: `${t.lineDensity}px`,
  };
}

export function PlaceholderPlate({ seed, kind, aspectRatio, label }: PlaceholderPlateProps) {
  const t = plateTreatment(seed);
  return (
    <span
      className="php-plate"
      aria-hidden
      style={{ ...plateStyle(seed, kind), aspectRatio: String(aspectRatio) }}
      data-kind={kind}
      data-variant={t.variant}
      data-geo={t.geo}
    >
      <i className="php-hatch" />
      {t.geo !== 'none' && <i className={`php-geo php-geo-${t.geo}`} />}
      {t.vignette && <i className="php-vignette" />}
      {t.marks && <i className="php-marks" />}
      <span className="php-frame" />
      <span className="php-tag">{label ?? 'placeholder'}</span>
    </span>
  );
}
