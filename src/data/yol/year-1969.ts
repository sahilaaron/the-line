import type { YearYol } from './index';

/**
 * Year-on-Line content for 1969 (collage page).
 * Event dates/titles are well-established history, but every entry is still
 * flagged `placeholder: true` pending editorial verification and sourcing.
 * The collage artwork referenced here is an ILLUSTRATIVE RECONSTRUCTION
 * (generated art directed by the project) — never present it as archival.
 */
export const YOL_1969: YearYol = {
  content: {
    anchorId: '1969',
    title: '1969',
    thesis:
      'A world in motion — people connect, question, create, and reach beyond the horizons of the past.',
    themeLabels: ['Spaceflight', 'Computing', 'Signal', 'Cold War'],
    placeholder: true,
  },

  events: [
    {
      id: 'apollo11',
      section: 'spaceflight',
      date: 'July 20, 1969',
      title: 'Humans walk on the Moon',
      text:
        'Apollo 11 carries Neil Armstrong, Buzz Aldrin and Michael Collins to the Moon. Armstrong and Aldrin walk its surface — the first people ever to stand on another world.',
      themes: ['spaceflight'],
      placeholder: true,
    },
    {
      id: 'broadcast',
      section: 'signal',
      date: 'July 20, 1969',
      title: 'The world watches, live',
      text:
        'The moonwalk is broadcast live across continents to hundreds of millions of viewers — one shared planetary moment, carried by antennas, relays and living-room television sets.',
      themes: ['signal', 'spaceflight'],
      placeholder: true,
    },
    {
      id: 'arpanet',
      section: 'computing',
      date: 'October 29, 1969',
      title: 'The first ARPANET message',
      text:
        'A computer at UCLA sends the first message over ARPANET to Stanford Research Institute. The system crashes after two letters — "LO" — and the networked age quietly begins.',
      themes: ['computing', 'signal'],
      placeholder: true,
    },
    {
      id: 'moratorium',
      section: 'coldwar',
      date: 'October 15, 1969',
      title: 'Moratorium to End the War in Vietnam',
      text:
        'Millions of Americans pause work and school in one of the largest demonstrations in US history, demanding an end to the war — a divided world questioning itself out loud.',
      themes: ['coldwar'],
      placeholder: true,
    },
    {
      id: 'woodstock',
      section: 'counterculture',
      date: 'August 15–18, 1969',
      title: 'Woodstock',
      text:
        'Roughly 400,000 people gather on a dairy farm in Bethel, New York for three days of music — a generation hearing itself, amplified, for the first time.',
      themes: ['signal'],
      placeholder: true,
    },
    {
      id: 'world-in-motion',
      section: 'ordinary-life',
      date: '1969',
      title: 'A world in motion',
      text:
        'Cities grow, borders strain, screens flicker in new colours. The same year that reaches the Moon is lived on crowded streets by people connecting faster than ever before.',
      themes: ['signal', 'coldwar'],
      placeholder: true,
    },
  ],

  neighbours: [
    { year: '1967', label: 'Six-Day War', placeholder: true },
    { year: '1968', label: 'Global Student Protests', placeholder: true },
    { year: '1969', label: 'A Year of Change and Connection', active: true, placeholder: true },
    { year: '1970', label: 'Earth Day is Founded', placeholder: true },
    { year: '1971', label: 'Bangladesh Liberation War', placeholder: true },
    { year: '1972', label: 'Limits to Growth Published', placeholder: true },
    { year: '1973', label: 'Oil Crisis Begins', placeholder: true },
  ],

  quote: {
    text: 'The arc of the moral universe is long, but it bends toward justice.',
    attribution: 'Martin Luther King Jr. · after Theodore Parker',
    placeholder: true,
  },

  interludeAssetIds: ['slot-vietnam', 'slot-civil-rights', 'slot-fashion'],
};
