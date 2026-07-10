import { describe, expect, it } from 'vitest';
import type { HistoricalFieldItemVM } from '../../domain/worlds';
import {
  computeFieldLayout,
  emphasisAt,
  midYearOf,
  visiblePlacements,
  type FieldLayoutConfig,
} from './layout';
import { FIELD_1760_1780 } from '../../data/worlds/prototype-content';

const CFG: FieldLayoutConfig = {
  rangeStart: 1760,
  rangeEnd: 1780,
  vwPerYear: 11,
  seed: 'field-1760-1780',
};

function fakeItem(over: Partial<HistoricalFieldItemVM>): HistoricalFieldItemVM {
  return {
    id: over.id ?? 'x',
    slug: over.slug ?? over.id ?? 'x',
    kind: 'event',
    title: 't',
    startYear: 1770,
    dateLabel: '1770',
    datePrecision: 'year',
    themeKeys: [],
    prominence: 50,
    media: [],
    provenance: 'placeholder',
    editorialStatus: 'draft',
    ...over,
  };
}

describe('temporal collage layout', () => {
  it('is deterministic — identical inputs produce identical arrangements', () => {
    const a = computeFieldLayout(FIELD_1760_1780.items, CFG);
    const b = computeFieldLayout(FIELD_1760_1780.items, CFG);
    expect(a).toEqual(b);
    // and stays identical when the input array order is shuffled
    const shuffled = [...FIELD_1760_1780.items].reverse();
    const c = computeFieldLayout(shuffled, CFG);
    expect(new Map(c.map((p) => [p.id, p]))).toEqual(new Map(a.map((p) => [p.id, p])));
  });

  it('derives horizontal position from historical time', () => {
    const layout = computeFieldLayout(FIELD_1760_1780.items, CFG);
    const byId = new Map(layout.map((p) => [p.id, p]));
    for (const item of FIELD_1760_1780.items) {
      const p = byId.get(item.id)!;
      const trueX = (midYearOf(item) - CFG.rangeStart) * CFG.vwPerYear;
      // within jitter + bounded nudge + editorial offset of its true time
      expect(Math.abs(p.xVw - trueX)).toBeLessThanOrEqual(
        0.35 * CFG.vwPerYear + 3.2 + Math.abs(item.composition?.offsetX ?? 0) + 1e-9
      );
    }
    // strictly monotonic in expectation: an item 5+ years later is further right
    const early = byId.get('hf-prov-canals')!; // c. 1761
    const late = byId.get('hf-independence')!; // 1776
    expect(late.xVw).toBeGreaterThan(early.xVw);
  });

  it('never overlaps two plates in the same depth+lane', () => {
    const layout = computeFieldLayout(FIELD_1760_1780.items, CFG);
    const byLane = new Map<string, typeof layout>();
    for (const p of layout) {
      const key = `${p.depth}:${p.lane}`;
      byLane.set(key, [...(byLane.get(key) ?? []), p]);
    }
    for (const group of byLane.values()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          const gap = Math.abs(a.xVw - b.xVw);
          expect(gap).toBeGreaterThanOrEqual(a.widthVw / 2 + b.widthVw / 2);
        }
      }
    }
  });

  it('respects editorial composition overrides', () => {
    const item = fakeItem({
      id: 'editorial',
      prominence: 20,
      composition: { preferredLane: 0, sizeClass: 'large', depth: 0, offsetX: 4 },
    });
    const [p] = computeFieldLayout([item], CFG);
    expect(p.lane).toBe(0);
    expect(p.depth).toBe(0);
    expect(p.widthVw).toBeGreaterThan(14); // large base 17 * >=0.9
    expect(p.xVw).toBeGreaterThan((1770 - 1760) * 11); // offsetX pushed it right
  });

  it('handles a dense same-year cluster without same-lane collisions (scale proof)', () => {
    // 60 records over the 20-year range (the final content target),
    // with a deliberate 12-record hotspot on 1769
    const cluster = Array.from({ length: 60 }, (_, i) =>
      fakeItem({
        id: `c${i}`,
        startYear: i < 12 ? 1769 : 1760 + (i % 20),
        prominence: (i * 7) % 100,
      })
    );
    const layout = computeFieldLayout(cluster, CFG);
    expect(layout).toHaveLength(60);
    const byLane = new Map<string, typeof layout>();
    for (const p of layout) {
      const key = `${p.depth}:${p.lane}`;
      byLane.set(key, [...(byLane.get(key) ?? []), p]);
    }
    let overlapsFound = 0;
    for (const group of byLane.values()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          if (Math.abs(a.xVw - b.xVw) < a.widthVw / 2 + b.widthVw / 2 - 1e-9) overlapsFound++;
        }
      }
    }
    // the deepest layer may accept residual overlap by design; the front
    // two layers must stay clean
    const frontGroups = [...byLane.entries()].filter(([k]) => !k.startsWith('2:'));
    for (const [, group] of frontGroups) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          expect(Math.abs(a.xVw - b.xVw)).toBeGreaterThanOrEqual(
            a.widthVw / 2 + b.widthVw / 2 - 1e-9
          );
        }
      }
    }
    expect(overlapsFound).toBeLessThan(20);
  });

  it('windows the mounted set by temporal distance', () => {
    const layout = computeFieldLayout(FIELD_1760_1780.items, CFG);
    const at1769 = visiblePlacements(layout, 1769, 8, 3);
    expect(at1769.length).toBeGreaterThan(0);
    for (const p of at1769) expect(Math.abs(p.midYear - 1769)).toBeLessThanOrEqual(11);
    const far = visiblePlacements(layout, 1900, 8, 3);
    expect(far).toHaveLength(0);
  });

  it('emphasis fades and de-activates with temporal distance, never to zero', () => {
    const cfg = { activeRadius: 2.4, opacityFalloff: 0.13, scaleFalloff: 0.035 };
    const near = emphasisAt(0.5, cfg);
    expect(near.opacity).toBe(1);
    expect(near.interactive).toBe(true);
    const far = emphasisAt(9, cfg);
    expect(far.opacity).toBeLessThan(near.opacity);
    expect(far.opacity).toBeGreaterThan(0); // the field never empties
    expect(far.interactive).toBe(false);
  });
});
