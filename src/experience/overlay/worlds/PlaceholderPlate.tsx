'use client';

/**
 * Deterministic placeholder media plate: no image files, no downloads, no
 * rights questions. A seeded gradient + kind-tinted treatment gives every
 * record a stable, visibly-provisional visual so density, proportion and
 * movement can be judged before real media exists. The SAME seed always
 * renders the SAME plate — the shared-element transition and exact
 * restoration rely on that.
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

export function plateStyle(seed: string, kind?: string): React.CSSProperties {
  const baseHue = KIND_HUES[kind ?? ''] ?? (hash32(seed) % 360);
  const h1 = (baseHue + unit(`${seed}:h1`) * 24 - 12 + 360) % 360;
  const h2 = (baseHue + 24 + unit(`${seed}:h2`) * 30 + 360) % 360;
  const angle = Math.round(unit(`${seed}:a`) * 360);
  const s1 = 22 + Math.round(unit(`${seed}:s`) * 16);
  const l1 = 26 + Math.round(unit(`${seed}:l`) * 14);
  return {
    background: `linear-gradient(${angle}deg, hsl(${h1} ${s1}% ${l1}%), hsl(${h2} ${s1 - 8}% ${l1 + 16}%))`,
  };
}

export function PlaceholderPlate({ seed, kind, aspectRatio, label }: PlaceholderPlateProps) {
  return (
    <span
      className="php-plate"
      aria-hidden
      style={{ ...plateStyle(seed, kind), aspectRatio: String(aspectRatio) }}
      data-kind={kind}
    >
      <i className="php-hatch" />
      <span className="php-tag">{label ?? 'placeholder'}</span>
    </span>
  );
}
