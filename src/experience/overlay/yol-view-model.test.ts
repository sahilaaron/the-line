import { describe, expect, it } from 'vitest';
import { ANCHORS } from '@/src/data/anchors';
import { getYolYear } from '@/src/data/yol';
import type { YolReadModel } from '@/src/domain/yol-read-model';
import { dbToViewModel, fallbackViewModel, lensKey, shortDateLabel } from './yol-view-model';

const anchor1969 = ANCHORS.find((a) => a.id === '1969')!;

function readModelFixture(): YolReadModel {
  return {
    anchorSlug: '1969',
    enteredYear: 1969,
    title: '1969',
    thesis: 'A test thesis.',
    supportingLine: 'Humans on the Moon',
    atmospherePreset: 'orbital',
    provenance: 'placeholder',
    editorialStatus: 'draft',
    themes: [
      { lensKey: 'spaceflight', label: 'Spaceflight', displayLabel: 'Spaceflight', colorHex: '#cfe4ff', importance: 100, displayOrder: 0 },
      { lensKey: 'coldwar', label: 'Cold War', displayLabel: 'Cold War', colorHex: null, importance: 70, displayOrder: 1 },
    ],
    points: [
      { id: 'c1', role: 'context', displayOrder: -20, sectionKey: null, headline: 'Six-Day War', summary: '', entity: { slug: 'ctx-1969-1967', kind: 'event', label: 'Six-Day War' }, date: { year: 1967, precision: 'exact', uncertain: false, display: '1967' }, themes: [], claims: [], media: [], provenance: 'placeholder', editorialStatus: 'draft' },
      { id: 'ov', role: 'overview', displayOrder: 0, sectionKey: 'overview', headline: '1969', summary: '', entity: null, date: { year: 1969, precision: 'exact', uncertain: false, display: '1969' }, themes: [], claims: [], media: [], provenance: 'placeholder', editorialStatus: 'draft' },
      { id: 'd1', role: 'development', displayOrder: 10, sectionKey: 'spaceflight', headline: 'Humans walk on the Moon', summary: 'Apollo 11.', entity: { slug: 'yolev-1969-apollo11', kind: 'event', label: 'Humans walk on the Moon' }, date: { year: 1969, month: 7, day: 20, precision: 'exact', uncertain: false, display: 'July 20, 1969' }, themes: ['spaceflight'], claims: [{ text: 'x', verificationStatus: 'verified', disputed: false, confidence: 90, sources: [{ title: 'A Book', type: 'book', publicationYear: 2001, locator: 'p. 3', quotation: null }] }], media: [], provenance: 'reviewed', editorialStatus: 'verified' },
      { id: 'cl', role: 'closing', displayOrder: 100000, sectionKey: 'closing', headline: 'Closing', summary: '', entity: null, date: null, themes: [], claims: [], media: [], provenance: 'placeholder', editorialStatus: 'draft' },
    ],
  };
}

describe('yol view model adapters', () => {
  it('maps the database read model, preserving order and initial position', () => {
    const vm = dbToViewModel(readModelFixture(), anchor1969);
    expect(vm.source).toBe('database');
    expect(vm.points.map((p) => p.id)).toEqual(['c1', 'ov', 'd1', 'cl']);
    expect(vm.initialIndex).toBe(1); // the entered year's overview
    // overview carries the composition's title + thesis
    expect(vm.points[1].headline).toBe('1969');
    expect(vm.points[1].summary).toBe('A test thesis.');
    // lens hue falls back to the anchor theme colour when DB has none
    const coldwar = vm.lenses.find((l) => l.key === 'coldwar')!;
    expect(coldwar.hue).toBe(anchor1969.themes.find((t) => t.id === 'cold-war')!.color);
    // sources flatten for honest provenance
    expect(vm.points[2].sources).toEqual([{ title: 'A Book', locator: 'p. 3' }]);
    expect(vm.points[2].tickLabel).toBe('Jul 20');
    expect(vm.points[0].tickLabel).toBe('1967');
  });

  it('builds the fallback model from the prototype registry with the same shape', () => {
    for (const id of ['1769', '1969']) {
      const anchor = ANCHORS.find((a) => a.id === id)!;
      const year = getYolYear(id)!;
      const vm = fallbackViewModel(year, anchor);
      expect(vm.source).toBe('fallback');
      // contexts before -> overview -> developments -> contexts after -> closing
      expect(vm.points[0].role).toBe('context');
      expect(vm.points[vm.initialIndex].role).toBe('overview');
      expect(vm.points.at(-1)!.role).toBe('closing');
      expect(vm.points.filter((p) => p.role === 'development')).toHaveLength(year.events.length);
      // strictly non-decreasing years along the local line
      const years = vm.points.filter((p) => p.role !== 'closing').map((p) => p.year);
      expect([...years].sort((a, b) => a - b)).toEqual(years);
      // every lens key is normalised (no hyphens)
      expect(vm.lenses.every((l) => !l.key.includes('-'))).toBe(true);
    }
  });

  it('shortens tick date labels without touching BCE years', () => {
    expect(shortDateLabel('July 20, 1969')).toBe('Jul 20');
    expect(shortDateLabel('August 15–18, 1969')).toBe('Aug 15–18');
    expect(shortDateLabel('January 1769')).toBe('Jan');
    expect(shortDateLabel('1969')).toBe('');
    expect(shortDateLabel('c. 10,000 BCE')).toBe('');
    expect(lensKey('cold-war')).toBe('coldwar');
  });
});
