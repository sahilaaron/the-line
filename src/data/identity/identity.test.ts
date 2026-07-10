import { describe, expect, it } from 'vitest';
import { ANCHORS } from '../anchors';
import {
  DEFAULT_IDENTITY,
  getAsset,
  getRoleAsset,
  getSectionAsset,
  getYearIdentity,
  IDENTITY_1769,
  IDENTITY_1969,
} from './index';

const DESIGNED = [IDENTITY_1969, IDENTITY_1769];

describe('year visual identity registry', () => {
  it('returns the 1969 identity for 1969', () => {
    expect(getYearIdentity('1969')).toBe(IDENTITY_1969);
  });

  it('returns the 1769 identity for 1769', () => {
    expect(getYearIdentity('1769')).toBe(IDENTITY_1769);
  });

  it('falls back to the default identity for un-designed years', () => {
    expect(getYearIdentity('1450')).toBe(DEFAULT_IDENTITY);
    expect(getYearIdentity('nope')).toBe(DEFAULT_IDENTITY);
  });

  it('assets all carry alt text, provenance and an asset state', () => {
    for (const id of DESIGNED) {
      for (const a of id.assets) {
        expect(a.alt.length, `${id.yearId}/${a.id}`).toBeGreaterThan(8);
        expect(['archival', 'generated', 'reconstructed', 'placeholder']).toContain(a.sourceType);
        expect(['placeholder', 'final'], `${id.yearId}/${a.id}`).toContain(a.assetState);
      }
    }
  });

  it('never claims rights for non-archival media', () => {
    for (const id of DESIGNED) {
      for (const a of id.assets) {
        if (a.sourceType !== 'archival') {
          expect(a.rights, `${id.yearId}/${a.id}`).not.toBe('cleared');
        }
      }
    }
  });

  it('has no archival assets yet (everything is reconstruction/placeholder)', () => {
    for (const id of DESIGNED) {
      expect(id.assets.some((a) => a.sourceType === 'archival')).toBe(false);
    }
  });

  it('placeholder-sourced assets are flagged placeholder-state', () => {
    for (const id of DESIGNED) {
      for (const a of id.assets) {
        if (a.sourceType === 'placeholder') {
          expect(a.assetState, `${id.yearId}/${a.id}`).toBe('placeholder');
        }
      }
    }
  });

  it('theme substyles cover every lens key of the year anchor', () => {
    const cases: [string, typeof IDENTITY_1969][] = [
      ['1969', IDENTITY_1969],
      ['1769', IDENTITY_1769],
    ];
    for (const [anchorId, identity] of cases) {
      const anchor = ANCHORS.find((a) => a.id === anchorId)!;
      for (const t of anchor.themes) {
        const key = t.id.replace(/-/g, '');
        expect(identity.themes[key], `${anchorId}/${key}`).toBeDefined();
      }
    }
  });

  it('getAsset finds manifest entries', () => {
    expect(getAsset(IDENTITY_1969, 'hero-opening')?.path).toContain('/yol1969/');
    expect(getAsset(IDENTITY_1769, 'hero-1769')?.path).toContain('/yol1769/');
    expect(getAsset(IDENTITY_1969, 'missing')).toBeNull();
  });

  it('resolves hero, atmosphere and texture roles for both years', () => {
    for (const id of DESIGNED) {
      expect(getRoleAsset(id, 'hero'), id.yearId).not.toBeNull();
      expect(getRoleAsset(id, 'atmosphere'), id.yearId).not.toBeNull();
      expect(getRoleAsset(id, 'texture'), id.yearId).not.toBeNull();
    }
  });

  it('resolves a section asset for every 1769 lens section', () => {
    for (const section of ['steam', 'knowledge', 'trade', 'labour']) {
      const a = getSectionAsset(IDENTITY_1769, section);
      expect(a, section).not.toBeNull();
      expect(a?.path).toContain('/yol1769/');
    }
  });

  it('the two designed years are materially distinct', () => {
    expect(IDENTITY_1769.palette.paper).not.toBe(IDENTITY_1969.palette.paper);
    expect(IDENTITY_1769.palette.accent).not.toBe(IDENTITY_1969.palette.accent);
    expect(IDENTITY_1769.typography.yearDisplay.family).not.toBe(
      IDENTITY_1969.typography.yearDisplay.family
    );
    expect(IDENTITY_1769.layout.heroSplit).not.toBe(IDENTITY_1969.layout.heroSplit);
    expect(IDENTITY_1769.motion.easing).not.toBe(IDENTITY_1969.motion.easing);
    // no motif overlap: engraved knowledge is not broadcast modernism
    const m69 = new Set(IDENTITY_1969.motifs);
    for (const m of IDENTITY_1769.motifs) {
      expect(m69.has(m), m).toBe(false);
    }
  });

  it('1769 has no baked-text or rights-claiming placeholder', () => {
    for (const a of IDENTITY_1769.assets) {
      expect(a.rights).toBe('not-applicable');
    }
  });
});
