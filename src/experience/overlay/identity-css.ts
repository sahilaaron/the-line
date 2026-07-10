import { getRoleAsset } from '@/src/data/identity';
import type {
  TypographyRole,
  YearVisualIdentity,
} from '@/src/data/identity';

/**
 * Bridges a YearVisualIdentity into CSS custom properties, applied once on
 * `.yol-page`. All period styling in globals.css reads `--yr-*` variables,
 * so components never hard-code year-specific colours/fonts/treatments.
 */

function roleVars(prefix: string, role: TypographyRole): Record<string, string> {
  return {
    [`--yr-${prefix}-family`]: role.family,
    [`--yr-${prefix}-weight`]: String(role.weight),
    [`--yr-${prefix}-ls`]: role.letterSpacing ?? 'normal',
    [`--yr-${prefix}-tt`]: role.transform ?? 'none',
    [`--yr-${prefix}-style`]: role.style ?? 'normal',
  };
}

export function identityCssVars(id: YearVisualIdentity): Record<string, string> {
  const p = id.palette;
  const texture = getRoleAsset(id, 'texture');
  return {
    /* palette */
    '--yr-paper': p.paper,
    '--yr-plate': p.plate,
    '--yr-sky': p.sky,
    '--yr-ink': p.inkStrong,
    '--yr-body': p.inkBody,
    '--yr-muted': p.inkMuted,
    '--yr-plate-ink': p.plateInk,
    '--yr-plate-muted': p.plateInkMuted,
    '--yr-accent': p.accent,
    '--yr-accent-alt': p.accentAlt,
    '--yr-signal': p.signal,
    '--yr-warning': p.warning,
    '--yr-surface-alt': p.surfaceAlt,
    /* media */
    '--yr-hairline': id.media.hairline,
    '--yr-grain': String(id.media.grainOpacity),
    '--yr-halftone': id.media.halftoneSize,
    '--yr-radius': id.media.cornerRadius,
    '--yr-arc': id.media.arcCorner,
    '--yr-filter': id.media.baseFilter,
    /* layout */
    '--yr-maxw': id.layout.maxWidth,
    '--yr-gutter': id.layout.gutter,
    '--yr-hero-split': id.layout.heroSplit,
    '--yr-hero-art-radius': id.layout.heroArtRadius ?? '0',
    '--yr-gap': id.layout.sectionGap,
    /* period paper/grain texture tile, from the manifest (role: texture) */
    '--yr-texture': texture ? `url('${texture.path}')` : 'none',
    /* motion */
    '--yr-rise': id.motion.revealRise,
    '--yr-dur': id.motion.revealDuration,
    '--yr-ease': id.motion.easing,
    '--yr-pulse': id.motion.pulsePeriod,
    /* typography roles */
    ...roleVars('year', id.typography.yearDisplay),
    ...roleVars('head', id.typography.headline),
    ...roleVars('body', id.typography.body),
    ...roleVars('theme', id.typography.themeLabel),
    ...roleVars('tech', id.typography.technical),
    ...roleVars('cap', id.typography.caption),
    ...roleVars('meta', id.typography.metadata),
  };
}

/** Substyle vars applied per section (theme accent + surface). */
export function substyleCssVars(
  id: YearVisualIdentity,
  key: string | undefined
): Record<string, string> {
  const sub = key ? id.themes[key] : undefined;
  if (!sub) return {};
  return { '--yr-sub-accent': sub.accent };
}
