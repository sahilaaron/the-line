import { describe, expect, it } from 'vitest';
import { DEFAULT_IDENTITY, getAsset, getYearIdentity, IDENTITY_1969 } from './index';

describe('year visual identity registry', () => {
  it('returns the 1969 identity for 1969', () => {
    expect(getYearIdentity('1969')).toBe(IDENTITY_1969);
  });

  it('falls back to the default identity for un-designed years', () => {
    expect(getYearIdentity('1450')).toBe(DEFAULT_IDENTITY);
    expect(getYearIdentity('nope')).toBe(DEFAULT_IDENTITY);
  });

  it('1969 assets all carry alt text and a provenance', () => {
    for (const a of IDENTITY_1969.assets) {
      expect(a.alt.length, a.id).toBeGreaterThan(8);
      expect(['archival', 'generated', 'reconstructed', 'placeholder']).toContain(a.sourceType);
    }
  });

  it('never claims rights for non-archival media', () => {
    for (const a of IDENTITY_1969.assets) {
      if (a.sourceType !== 'archival') {
        expect(a.rights, a.id).not.toBe('cleared');
      }
    }
  });

  it('1969 has no archival assets yet (everything is reconstruction/placeholder)', () => {
    expect(IDENTITY_1969.assets.some((a) => a.sourceType === 'archival')).toBe(false);
  });

  it('theme substyles cover every 1969 lens key', () => {
    for (const k of ['spaceflight', 'computing', 'signal', 'coldwar']) {
      expect(IDENTITY_1969.themes[k], k).toBeDefined();
    }
  });

  it('getAsset finds manifest entries', () => {
    expect(getAsset(IDENTITY_1969, 'hero-opening')?.path).toContain('/yol1969/');
    expect(getAsset(IDENTITY_1969, 'missing')).toBeNull();
  });
});
