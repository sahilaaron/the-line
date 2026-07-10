'use client';

import { useEffect, useRef, useState } from 'react';
import {
  YOL_CONTENT,
  YOL_EVENTS_1969,
  YOL_NEIGHBOURS_1969,
  YOL_QUOTE_1969,
} from '@/src/data/yol';
import { ANCHORS, INDEX_1969 } from '@/src/data/anchors';
import { getAsset, getYearIdentity } from '@/src/data/identity';
import { useExperience } from '../store';
import { motionPref, themeFocus, yolReveal, type ThemeFocusKey } from '../runtime';
import { identityCssVars } from './identity-css';
import { MediaFrame } from './media/MediaFrame';

/**
 * Theme lenses — STRUCTURAL identity, constant across years: each lens
 * carries the same colour as its theme sphere in Line View
 * (src/data/anchors.ts) and the same orb geometry, so `Computing` here is
 * visibly the Computing force seen around the Temporal Earth.
 */
const ANCHOR_1969_THEMES = ANCHORS[INDEX_1969].themes;
const themeColor = (key: string) =>
  ANCHOR_1969_THEMES.find((t) => t.id.replace('-', '') === key)?.color ??
  '#d8dee8';

const LENSES: { key: ThemeFocusKey; label: string; hue: string }[] = [
  { key: 'spaceflight', label: 'Spaceflight', hue: themeColor('spaceflight') },
  { key: 'computing', label: 'Computing', hue: themeColor('computing') },
  { key: 'signal', label: 'Signal', hue: themeColor('signal') },
  { key: 'coldwar', label: 'Cold War', hue: themeColor('coldwar') },
];

/** Which manifest asset illustrates each event section. */
const SECTION_ASSET: Record<string, string> = {
  spaceflight: 'spaceflight-main',
  signal: 'signal-main',
  computing: 'computing-main',
  coldwar: 'conflict-main',
  counterculture: 'counterculture-main',
  'ordinary-life': 'ordinary-life-main',
};

/**
 * The 1969 Year-on-Line page, rendered THROUGH the year's visual identity
 * (src/data/identity/year-1969.ts): space-age editorial modernism on warm
 * paper, documentary print for conflict, analogue broadcast/computing on
 * dark plates, counterculture colour only where it belongs. The Line strip
 * at the bottom, the active-year pulse, theme behaviour and caption
 * conventions are structural and shared with Line View.
 *
 * All period styling comes from `--yr-*` CSS variables set here from the
 * identity — components/sections carry no hard-coded year styling.
 */
export function YolPage() {
  const mode = useExperience((s) => s.mode);
  const yol = YOL_CONTENT['1969'];
  const identity = getYearIdentity('1969');

  const [activeLens, setActiveLens] = useState<ThemeFocusKey | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const thesisRef = useRef<HTMLParagraphElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLElement>(null);

  // arrival choreography: hero elements read yolReveal each frame
  useEffect(() => {
    let raf = 0;
    const apply = (el: HTMLElement | null, v: number, rise = 16) => {
      if (!el) return;
      el.style.opacity = String(v);
      el.style.transform = `translateY(${(1 - v) * rise}px)`;
    };
    const tick = () => {
      apply(headRef.current, yolReveal.text);
      apply(thesisRef.current, yolReveal.text, 12);
      apply(chipsRef.current, yolReveal.themes, 10);
      apply(hintRef.current, yolReveal.line, 6);
      // the Line strip resolves last, as The Line hands over to the year
      if (lineRef.current) {
        lineRef.current.style.opacity = String(0.25 + yolReveal.line * 0.75);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // fresh entry starts at the top of the page
  useEffect(() => {
    if (mode === 'yol') scrollRef.current?.scrollTo({ top: 0 });
  }, [mode]);

  // scroll-triggered reveals
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('in-view');
        });
      },
      { root, threshold: 0.18 }
    );
    root.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Restrained depth: imagery drifts slightly slower than the page.
  // Transform-only, one rAF per scroll burst, skipped under reduced motion.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || motionPref.reduced) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const vh = root.clientHeight;
      root.querySelectorAll<HTMLElement>('.yp-event .mf').forEach((fig) => {
        const r = fig.getBoundingClientRect();
        const off = (r.top + r.height / 2 - vh / 2) / vh;
        fig.style.transform = `translateY(${(-off * 16).toFixed(1)}px)`;
      });
      const hero = root.querySelector<HTMLElement>('.yp-hero-art');
      if (hero) {
        hero.style.backgroundPosition = `center calc(50% + ${(
          root.scrollTop * 0.06
        ).toFixed(1)}px)`;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    apply();
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const focusLens = (key: ThemeFocusKey | null) => {
    (Object.keys(themeFocus.target) as ThemeFocusKey[]).forEach((k) => {
      themeFocus.target[k] = k === key ? 1 : 0;
    });
    setActiveLens(key);
  };

  const heroAsset = getAsset(identity, 'hero-opening');
  const vietnamSlot = getAsset(identity, 'slot-vietnam');
  const civilRightsSlot = getAsset(identity, 'slot-civil-rights');
  const fashionSlot = getAsset(identity, 'slot-fashion');
  const closingSlot = getAsset(identity, 'slot-closing');

  return (
    <div
      ref={scrollRef}
      className="yol-page"
      data-lens={activeLens ?? undefined}
      data-testid="yol-page"
      style={identityCssVars(identity) as React.CSSProperties}
    >
      {/* hero: split editorial, crop-marked title column, period display type */}
      <section className="yp-hero motif-cropmarks">
        <div className="yp-col">
          <div ref={headRef} className="yp-head">
            <div className="yp-kicker">Year on Line</div>
            <h2 className="yp-title" data-testid="yol-title">
              {yol.title}
            </h2>
            <div className="yp-rule" aria-hidden />
          </div>
          <p ref={thesisRef} className="yp-thesis">
            {yol.thesis}
          </p>
          <div
            ref={chipsRef}
            className="yp-chips"
            role="group"
            aria-label="Theme lenses — focus to re-weight the year"
          >
            {LENSES.map((lens) => (
              <button
                key={lens.key}
                className="yp-chip"
                style={{ ['--chip' as string]: lens.hue }}
                data-testid={`lens-${lens.key}`}
                data-active={activeLens === lens.key || undefined}
                onMouseEnter={() => focusLens(lens.key)}
                onMouseLeave={() => focusLens(null)}
                onFocus={() => focusLens(lens.key)}
                onBlur={() => focusLens(null)}
              >
                <i className="yp-orb" aria-hidden />
                {lens.label}
              </button>
            ))}
          </div>
          <div ref={hintRef} className="yp-scrollhint">
            Scroll to explore the year ↓
          </div>
        </div>
        <div
          className="yp-hero-art"
          role="img"
          aria-label={heroAsset?.alt}
          style={
            heroAsset
              ? { backgroundImage: `url('${heroAsset.path}')` }
              : undefined
          }
        />
      </section>

      {/* event sections, each through its identity substyle */}
      <div className="yp-events">
        {YOL_EVENTS_1969.map((ev, i) => {
          const sub = identity.themes[ev.section];
          const asset = getAsset(identity, SECTION_ASSET[ev.section] ?? '');
          const surface = sub?.surface ?? 'paper';
          return (
            <section
              key={ev.id}
              className={`yp-event reveal${i % 2 ? ' flip' : ''} surface-${surface}`}
              data-themes={ev.themes.join(' ')}
              data-section={ev.section}
              data-motif={sub?.motif}
              style={
                sub
                  ? ({ '--yr-sub-accent': sub.accent } as React.CSSProperties)
                  : undefined
              }
            >
              {asset && <MediaFrame asset={asset} identity={identity} />}
              <div className="yp-event-body">
                <div className="yp-event-date">{ev.date}</div>
                <h3 className="yp-event-title">{ev.title}</h3>
                <p className="yp-event-text">{ev.text}</p>
                <div className="yp-event-tags">
                  {ev.themes.map((t) => {
                    const lens = LENSES.find((l) => l.key === t);
                    return (
                      <span key={t} style={{ ['--chip' as string]: lens?.hue }}>
                        <i className="yp-orb" aria-hidden />
                        {lens?.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* documentary interlude: named slots awaiting externally generated
          imagery (dev surfaces, clearly labelled in the DOM, no baked text) */}
      <section className="yp-interlude reveal" aria-label="Image slots awaiting generated imagery">
        {[vietnamSlot, civilRightsSlot, fashionSlot].map(
          (slot) =>
            slot && (
              <div key={slot.id} className="yp-slot">
                <MediaFrame asset={slot} identity={identity} treatment="archival-frame" />
                <span className="yp-slot-id">slot: {slot.section}</span>
              </div>
            )
        )}
      </section>

      {/* quote: newspaper pull-quote */}
      <section className="yp-quote reveal">
        <blockquote>
          <span className="yp-qmark">“</span>
          {YOL_QUOTE_1969.text}
          <span className="yp-qmark">”</span>
        </blockquote>
        <cite>— {YOL_QUOTE_1969.attribution}</cite>
      </section>

      {/* closing reflection: panoramic atmosphere + integrity note */}
      <section className="yp-closing reveal">
        {closingSlot && (
          <MediaFrame
            asset={closingSlot}
            identity={identity}
            treatment="panorama"
            captioned={false}
          />
        )}
        <p className="yp-note">
          Collage artwork and illustrations are illustrative reconstructions,
          not archival media. Event summaries are placeholders pending
          editorial verification.
        </p>
      </section>

      {/* The Line, inside the year — structural identity, shared with Line
          View: gold at the active year, cooling with temporal distance, the
          same pulse rhythm. It resolves back into the main Line on return. */}
      <footer ref={lineRef} className="yp-timeline">
        <div className="yp-tl-line" aria-hidden />
        {YOL_NEIGHBOURS_1969.map((n) => (
          <div key={n.year} className={`yp-tl-year${n.active ? ' active' : ''}`}>
            <i className="yp-tl-tick" aria-hidden />
            {n.active && <i className="yp-tl-pulse" aria-hidden />}
            <span className="yp-tl-y">{n.year}</span>
            <span className="yp-tl-s">{n.label}</span>
          </div>
        ))}
      </footer>
    </div>
  );
}
