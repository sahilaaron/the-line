import type { Anchor } from './types';

/**
 * PLACEHOLDER anchors for the physics prototype.
 * Ordered oldest → newest. The index in this array is the unit of scroll
 * space: `timePos` runs 0..ANCHORS.length-1. Subtitles/themes are mood
 * placeholders, not researched historical claims.
 */
export const ANCHORS: Anchor[] = [
  {
    id: 'bce-10000',
    year: -9999,
    label: 'c. 10,000 BCE',
    subtitle: 'The Emergence of Civilization',
    themes: [
      { id: 'settlement', label: 'Settlement', color: '#d4a24e' },
      { id: 'agriculture', label: 'Agriculture', color: '#a8c46a' },
      { id: 'kinship', label: 'Kinship', color: '#c98a6a' },
    ],
    era: {
      tint: '#d4a24e',
      accent: '#f0c987',
      fieldStyle: 'settlement',
      density: 0.45,
      order: 0.15,
    },
    placeholder: true,
  },
  {
    id: '1450',
    year: 1450,
    label: '1450',
    subtitle: 'Renaissance Begins',
    themes: [
      { id: 'print', label: 'Print', color: '#c9b28a' },
      { id: 'trade', label: 'Trade', color: '#7fa8c9' },
      { id: 'art', label: 'Art', color: '#c97fa0' },
    ],
    era: {
      tint: '#c9b28a',
      accent: '#e8dcc0',
      fieldStyle: 'print',
      density: 0.55,
      order: 0.4,
    },
    placeholder: true,
  },
  {
    id: '1769',
    year: 1769,
    label: '1769',
    subtitle: 'Age of Enlightenment',
    themes: [
      { id: 'steam', label: 'Steam', color: '#d97b3f' },
      { id: 'knowledge', label: 'Knowledge', color: '#e0c36a' },
      { id: 'trade', label: 'Trade', color: '#8fa8b8' },
      { id: 'labour', label: 'Labour', color: '#b08d6a' },
    ],
    era: {
      tint: '#d97b3f',
      accent: '#f2b380',
      fieldStyle: 'industrial',
      density: 0.6,
      order: 0.55,
    },
    placeholder: true,
  },
  {
    id: '1969',
    year: 1969,
    label: '1969',
    subtitle: 'Humans on the Moon',
    themes: [
      { id: 'spaceflight', label: 'Spaceflight', color: '#cfe4ff' },
      { id: 'computing', label: 'Computing', color: '#ffd479' },
      { id: 'signal', label: 'Signal', color: '#9fe8c8' },
      { id: 'cold-war', label: 'Cold War', color: '#d98a8a' },
    ],
    era: {
      tint: '#9fc3e8',
      accent: '#e8f2ff',
      fieldStyle: 'orbital',
      density: 0.7,
      order: 0.75,
    },
    placeholder: true,
  },
  {
    id: '2026',
    year: 2026,
    label: '2026',
    subtitle: 'The Connected Present',
    themes: [
      { id: 'ai', label: 'AI', color: '#8fb8ff' },
      { id: 'war', label: 'War', color: '#d98a7a' },
      { id: 'climate', label: 'Climate', color: '#8fd4a8' },
      { id: 'energy', label: 'Energy', color: '#f0cd7a' },
      { id: 'space', label: 'Space', color: '#b8a0e8' },
    ],
    era: {
      tint: '#9fd8e8',
      accent: '#ffffff',
      fieldStyle: 'network',
      density: 0.8,
      order: 0.9,
    },
    placeholder: true,
  },
];

export const ANCHOR_COUNT = ANCHORS.length;
export const MAX_INDEX = ANCHOR_COUNT - 1;
export const INDEX_1969 = ANCHORS.findIndex((a) => a.id === '1969');
export const INDEX_2026 = ANCHORS.findIndex((a) => a.id === '2026');
