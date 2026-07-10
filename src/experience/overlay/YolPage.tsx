'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ANCHORS } from '@/src/data/anchors';
import { getYolYear } from '@/src/data/yol';
import {
  getAsset,
  getRoleAsset,
  getSectionAsset,
  getYearIdentity,
} from '@/src/data/identity';
import { useExperience } from '../store';
import {
  motionPref,
  setThemeLenses,
  themeFocus,
  yolReveal,
} from '../runtime';
import { identityCssVars } from './identity-css';
import { MediaFrame } from './media/MediaFrame';

/**
 * The Year-on-Line page. Fully year-driven: the active anchor selects the
 * year's CONTENT (src/data/yol registry) and its VISUAL IDENTITY
 * (src/data/identity registry). Nothing here is specific to any single
 * year — 1969 and 1769 render through the same structure.
 *
 * Structural identity, constant across years: the Line strip and its pulse,
 * theme lenses carrying the same colours as their theme spheres in Line
 * View, caption/provenance conventions, the return control, arrival
 * choreography. Period styling comes ONLY from `--yr-*` CSS variables set
 * here from the identity.
 */

/** Lens keys are normalised anchor theme ids ('cold-war' → 'coldwar'). */
const lensKey = (themeId: string) => themeId.replace(/-/g, '');

export function YolPage() {
  const mode = useExperience((s) => s.mode);
  const activeIndex = useExperience((s) => s.activeIndex);
  const anchor = ANCHORS[activeIndex];
  const yearId = anchor?.id ?? '';
  const year = getYolYear(yearId);
  const identity = getYearIdentity(yearId);

  /** Theme lenses: same colour + orb as the theme spheres orbiting the
   *  Temporal Earth (structural); long-form labels from the year content. */
  const lenses = useMemo(() => {
    if (!anchor || !year) return [];
    return anchor.themes.map((t, i) => ({
      key: lensKey(t.id),
      label: year.content.themeLabels[i] ?? t.label,
      hue: t.color,
    }));
  }, [anchor, year]);

  const [activeLens, setActiveLens] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const thesisRef = useRef<HTMLParagraphElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLElement>(null);

  // install this year's lens keys into the shared runtime focus state
  useEffect(() => {
    setThemeLenses(lenses.map((l) => l.key));
    setActiveLens(null);
  }, [lenses]);

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
  }, [yearId]);

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
        const fx = hero.dataset.fx ?? '50%';
        const fy = hero.dataset.fy ?? '50%';
        hero.style.backgroundPosition = `${fx} calc(${fy} + ${(
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
  }, [yearId]);

  const focusLens = (key: string | null) => {
    Object.keys(themeFocus.target).forEach((k) => {
      themeFocus.target[k] = k === key ? 1 : 0;
    });
    setActiveLens(key);
  };

  if (!year) return null;

  const heroAsset = getRoleAsset(identity, 'hero');
  const closingAsset = getRoleAsset(identity, 'atmosphere');
  const interludeAssets = year.interludeAssetIds
    .map((id) => getAsset(identity, id))
    .filter((a): a is NonNullable<typeof a> => a !== null);
  const heroMotifClass = identity.layout.heroMotif
    ? ` motif-${identity.layout.heroMotif}`
    : '';

  return (
    <div
      ref={scrollRef}
      className="yol-page"
      data-lens={activeLens ?? undefined}
      data-year={yearId}
      data-testid="yol-page"
      style={identityCssVars(identity) as React.CSSProperties}
    >
      {/* hero: period display type; decorations come from the identity */}
      <section className={`yp-hero${heroMotifClass}`}>
        <div className="yp-col">
          <div ref={headRef} className="yp-head">
            <div className="yp-kicker">Year on Line</div>
            <h2 className="yp-title" data-testid="yol-title">
              {year.content.title}
            </h2>
            <div className="yp-rule" aria-hidden />
          </div>
          <p ref={thesisRef} className="yp-thesis">
            {year.content.thesis}
          </p>
          <div
            ref={chipsRef}
            className="yp-chips"
            role="group"
            aria-label="Theme lenses — focus to re-weight the year"
          >
            {lenses.map((lens) => (
              <button
                key={lens.key}
                className="yp-chip"
                style={{ ['--chip' as string]: lens.hue }}
                data-testid={`lens-${lens.key}`}
                data-active={activeLens === lens.key || undefined}
                aria-pressed={activeLens === lens.key}
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
          data-state={heroAsset?.assetState}
          data-fx={heroAsset?.focal ? `${Math.round(heroAsset.focal.x * 100)}%` : undefined}
          data-fy={heroAsset?.focal ? `${Math.round(heroAsset.focal.y * 100)}%` : undefined}
          style={
            heroAsset
              ? {
                  backgroundImage: `url('${heroAsset.path}')`,
                  backgroundPosition: heroAsset.focal
                    ? `${Math.round(heroAsset.focal.x * 100)}% ${Math.round(heroAsset.focal.y * 100)}%`
                    : undefined,
                }
              : undefined
          }
        />
      </section>

      {/* event sections, each through its identity substyle; the asset that
          illustrates a section is resolved from the manifest, never by id */}
      <div className="yp-events">
        {year.events.map((ev, i) => {
          const sub = identity.themes[ev.section];
          const asset = getSectionAsset(identity, ev.section);
          const surface = sub?.surface ?? 'paper';
          const flip = identity.layout.alternate && i % 2 === 1;
          const dim =
            activeLens !== null && !ev.themes.includes(activeLens);
          return (
            <section
              key={ev.id}
              className={`yp-event reveal${flip ? ' flip' : ''} surface-${surface}${
                dim ? ' dim' : ''
              }`}
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
                    const lens = lenses.find((l) => l.key === t);
                    return (
                      <span key={t} style={{ ['--chip' as string]: lens?.hue }}>
                        <i className="yp-orb" aria-hidden />
                        {lens?.label ?? t}
                      </span>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* interlude plates: finished assets read as a quiet measured moment;
          placeholder slots stay visibly provisional dev surfaces */}
      {interludeAssets.length > 0 && (
        <section
          className={`yp-interlude reveal${
            interludeAssets.length === 1 ? ' single' : ''
          }`}
          aria-label="Interlude plates"
        >
          {interludeAssets.map((slot) => (
            <div key={slot.id} className="yp-slot">
              <MediaFrame
                asset={slot}
                identity={identity}
                treatment={
                  slot.assetState === 'placeholder' ? 'archival-frame' : undefined
                }
              />
              {slot.assetState === 'placeholder' && (
                <span className="yp-slot-id">slot: {slot.section}</span>
              )}
            </div>
          ))}
        </section>
      )}

      {/* pull-quote — only when the year has a VERIFIED quotation */}
      {year.quote && (
        <section className="yp-quote reveal">
          <blockquote>
            <span className="yp-qmark">“</span>
            {year.quote.text}
            <span className="yp-qmark">”</span>
          </blockquote>
          <cite>— {year.quote.attribution}</cite>
        </section>
      )}

      {/* closing reflection: panoramic atmosphere + integrity note */}
      <section className="yp-closing reveal">
        {closingAsset && (
          <MediaFrame
            asset={closingAsset}
            identity={identity}
            treatment="panorama"
            captioned={false}
          />
        )}
        <p className="yp-note">
          Artwork is project-directed generated illustration, illustrative
          reconstruction or a placeholder slot — never archival media. Event
          summaries are placeholders pending editorial verification.
        </p>
      </section>

      {/* The Line, inside the year — structural identity, shared with Line
          View: gold at the active year, cooling with temporal distance, the
          same pulse rhythm. It resolves back into the main Line on return. */}
      <footer ref={lineRef} className="yp-timeline">
        <div className="yp-tl-line" aria-hidden />
        {year.neighbours.map((n) => (
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
