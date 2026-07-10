import { describe, expect, it } from 'vitest';
import { ANCHORS } from '../anchors';
import { getYolYear, hasYol, YOL_CONTENT, YOL_YEAR_IDS, YOL_YEARS } from './index';

const lensKey = (id: string) => id.replace(/-/g, '');

describe('YoL content registry', () => {
  it('serves 1769 and 1969, and nothing else yet', () => {
    expect(YOL_YEAR_IDS.sort()).toEqual(['1769', '1969']);
    expect(hasYol('1969')).toBe(true);
    expect(hasYol('1769')).toBe(true);
    expect(hasYol('2026')).toBe(false);
    expect(getYolYear('1450')).toBeNull();
  });

  it('every registry year matches an existing anchor', () => {
    for (const id of YOL_YEAR_IDS) {
      expect(ANCHORS.some((a) => a.id === id), id).toBe(true);
    }
  });

  it('theme labels align 1:1 with the anchor theme spheres', () => {
    for (const [id, year] of Object.entries(YOL_YEARS)) {
      const anchor = ANCHORS.find((a) => a.id === id)!;
      expect(year.content.themeLabels.length, id).toBe(anchor.themes.length);
    }
  });

  it('event lens keys resolve to anchor themes', () => {
    for (const [id, year] of Object.entries(YOL_YEARS)) {
      const anchor = ANCHORS.find((a) => a.id === id)!;
      const keys = new Set(anchor.themes.map((t) => lensKey(t.id)));
      for (const ev of year.events) {
        expect(ev.themes.length, `${id}/${ev.id}`).toBeGreaterThan(0);
        for (const t of ev.themes) {
          // 1969 keeps two non-lens substyles (counterculture sections tag
          // lens themes only), so every tag must still be a real lens
          expect(keys.has(t), `${id}/${ev.id}/${t}`).toBe(true);
        }
      }
    }
  });

  it('1769 carries the four required thematic lenses', () => {
    const labels = YOL_YEARS['1769'].content.themeLabels;
    expect(labels).toEqual([
      'Steam & Mechanisation',
      'Knowledge & Enlightenment',
      'Empire, Trade & Exploration',
      'Labour & Social Transformation',
    ]);
    expect(YOL_YEARS['1769'].events.length).toBeGreaterThanOrEqual(4);
  });

  it('all content is flagged placeholder pending editorial verification', () => {
    for (const [id, year] of Object.entries(YOL_YEARS)) {
      expect(year.content.placeholder, id).toBe(true);
      for (const ev of year.events) expect(ev.placeholder, ev.id).toBe(true);
      for (const n of year.neighbours) expect(n.placeholder, n.year).toBe(true);
      if (year.quote) expect(year.quote.placeholder).toBe(true);
    }
  });

  it('1769 has no quote (no verified quotation fabricated)', () => {
    expect(YOL_YEARS['1769'].quote).toBeUndefined();
  });

  it('exactly one active neighbour per year, matching the year itself', () => {
    for (const [id, year] of Object.entries(YOL_YEARS)) {
      const active = year.neighbours.filter((n) => n.active);
      expect(active.length, id).toBe(1);
      expect(active[0].year, id).toBe(id);
    }
  });

  it('keeps the legacy YOL_CONTENT view for the DB seed layer', () => {
    expect(YOL_CONTENT['1969'].title).toBe('1969');
    expect(YOL_CONTENT['1769'].thesis).toContain('mechanism');
  });
});
