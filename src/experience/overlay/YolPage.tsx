'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ANCHORS } from '@/src/data/anchors';
import {
  getAsset,
  getRoleAsset,
  getSectionAsset,
  getYearIdentity,
} from '@/src/data/identity';
import { useExperience, useTuning } from '../store';
import {
  localTimeState,
  motionPref,
  setLocalTimeline,
  setThemeLenses,
  themeFocus,
  yolReveal,
} from '../runtime';
import { approach, stepIndex } from '../time';
import { identityCssVars } from './identity-css';
import { MediaFrame } from './media/MediaFrame';
import { useYolViewModel } from './useYolData';
import type { YolPointVM } from './yol-view-model';

/**
 * The Year-on-Line page: a NESTED LOCAL TIMELINE WORLD inside the year.
 *
 * Spatial grammar (mirrors the parent Line):
 * - the local Line sits near the bottom (~91.7vh, `yolLineVh`) with a FIXED
 *   local temporal marker; the chronology moves beneath it;
 * - wheel down = earlier, wheel up = later; ←/→ step points (inputs live in
 *   Experience.tsx and write `localTimeState`, exactly like the parent);
 * - the field above the Line travels with the same position at a deeper
 *   parallax, so changing the active point reads as moving through the
 *   year, not as paging a carousel.
 *
 * Content comes from ONE view model (useYolViewModel): database-backed when
 * a composition exists, the isolated prototype registry otherwise. The
 * renderer cannot tell the difference and never sees raw DB rows.
 *
 * Year styling still comes ONLY from the Year Visual Identity (`--yr-*`
 * vars + manifest assets) — 1969 stays space-age editorial, 1769 stays
 * engraved broadsheet; this component is year-agnostic.
 */

export function YolPage() {
  const mode = useExperience((s) => s.mode);
  const activeIndex = useExperience((s) => s.activeIndex);
  const anchor = ANCHORS[activeIndex];
  const yearId = anchor?.id ?? '';
  const identity = getYearIdentity(yearId);
  const { vm, state } = useYolViewModel(yearId);

  const [pinnedLens, setPinnedLens] = useState<string | null>(null);
  const [hoverLens, setHoverLens] = useState<string | null>(null);
  const activeLens = hoverLens ?? pinnedLens;
  const [activePoint, setActivePoint] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const mastRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLElement>(null);
  const activePointRef = useRef(0);
  const debug = useMemo(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === '1',
    []
  );

  // install this year's lens keys into the shared runtime focus state
  useEffect(() => {
    if (!vm) return;
    setThemeLenses(vm.lenses.map((l) => l.key));
    setPinnedLens(null);
    setHoverLens(null);
  }, [vm?.yearId, vm?.source]); // eslint-disable-line react-hooks/exhaustive-deps

  // install the local timeline; entering a year starts at ITS overview
  useEffect(() => {
    if (!vm) return;
    const untouched = localTimeState.lastInputMs < 0;
    if (mode === 'yol' && !untouched) {
      // source upgraded mid-visit (fallback -> database): keep the visitor's
      // position, clamped to the new chronology
      const clamped = Math.min(Math.round(localTimeState.pos), vm.points.length - 1);
      setLocalTimeline(vm.points.length, Math.max(0, clamped));
      localTimeState.lastInputMs = performance.now();
    } else {
      setLocalTimeline(vm.points.length, vm.initialIndex);
    }
    setActivePoint(Math.round(localTimeState.pos));
    activePointRef.current = Math.round(localTimeState.pos);
  }, [vm?.yearId, vm?.source, vm?.points.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // fresh entry resets to the entered year's overview
  useEffect(() => {
    if (mode === 'yol' && vm) {
      setLocalTimeline(vm.points.length, vm.initialIndex);
      setActivePoint(vm.initialIndex);
      activePointRef.current = vm.initialIndex;
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * The per-frame heart: eases pos toward target (parent-Line snap
   * discipline), then writes transforms for the track, ticks and field
   * stations. Per-frame values never touch React state; only the DISCRETE
   * active index (for aria + dim classes) crosses into a state update.
   */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = useTuning.getState();
      // keep the DOM local Line aligned with the 3D one and the yolLineVh
      // tunable (debug panel) — see globals.css .yw-line
      rootRef.current?.style.setProperty('--yw-line-vh', String(t.yolLineVh));
      const count = localTimeState.count;
      if (count === 0) return;

      // soft snap after idle, same grammar as LineScene
      const idle = now - localTimeState.lastInputMs;
      if (idle > t.localSnapDelayMs) {
        const snapTarget = Math.round(localTimeState.target);
        localTimeState.target = approach(
          localTimeState.target,
          snapTarget,
          t.localSnapStrength,
          dt
        );
        if (Math.abs(localTimeState.target - snapTarget) < 0.0008) {
          localTimeState.target = snapTarget;
        }
      }
      localTimeState.pos = motionPref.reduced
        ? localTimeState.target
        : approach(localTimeState.pos, localTimeState.target, 10, dt);
      const pos = localTimeState.pos;

      // the chronology slides beneath the fixed marker
      const track = trackRef.current;
      if (track) {
        track.style.setProperty('--yw-spacing', `${t.localTickSpacingVw}vw`);
        track.style.transform = `translateX(calc(50vw - ${(pos * t.localTickSpacingVw).toFixed(3)}vw))`;
        const ticks = track.children;
        for (let i = 0; i < ticks.length; i++) {
          const el = ticks[i] as HTMLElement;
          const d = Math.abs(i - pos);
          el.style.opacity = String(Math.max(0.25, 1 - d * 0.22));
          el.dataset.active = d < 0.5 ? 'true' : undefined as unknown as string;
          if (d >= 0.5) delete el.dataset.active;
        }
      }

      // the field above travels further per unit — nested-world parallax
      const field = fieldRef.current;
      if (field) {
        const stations = field.children;
        for (let i = 0; i < stations.length; i++) {
          const el = stations[i] as HTMLElement;
          const dx = i - pos;
          const d = Math.abs(dx);
          const visible = d < 1.6;
          el.style.visibility = visible ? 'visible' : 'hidden';
          if (!visible) continue;
          const travel = motionPref.reduced ? 0 : dx * t.localFieldTravelVw;
          const scale = motionPref.reduced ? 1 : 1 - Math.min(0.06, d * 0.045);
          el.style.transform = `translate(-50%, 0) translateX(${travel.toFixed(2)}vw) scale(${scale.toFixed(3)})`;
          el.style.opacity = String(Math.max(0, 1 - d * (motionPref.reduced ? 1 : 1.15)));
          // only interactive while the YoL world is actually front-of-house;
          // never steal clicks from the Line View canvas beneath
          el.style.pointerEvents =
            d < 0.5 && useExperience.getState().mode === 'yol' ? 'auto' : 'none';
        }
      }

      // arrival choreography (env → text → themes → line)
      const apply = (el: HTMLElement | null, v: number, rise = 14) => {
        if (!el) return;
        el.style.opacity = String(v);
        el.style.transform = `translateY(${((1 - v) * rise).toFixed(1)}px)`;
      };
      apply(mastRef.current, yolReveal.text);
      apply(chipsRef.current, yolReveal.themes, 10);
      if (fieldRef.current) {
        fieldRef.current.style.setProperty('--yw-reveal', String(yolReveal.subject));
      }
      if (lineRef.current) {
        lineRef.current.style.opacity = String(0.25 + yolReveal.line * 0.75);
      }

      // discrete active point (aria/dim/testids)
      const nearest = Math.min(count - 1, Math.max(0, Math.round(pos)));
      if (nearest !== activePointRef.current) {
        activePointRef.current = nearest;
        setActivePoint(nearest);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // touch/drag travel for narrow layouts (and mice that prefer dragging)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let dragging = false;
    let lastX = 0;
    const unitPx = () => (window.innerWidth * useTuning.getState().localTickSpacingVw) / 100;
    const down = (e: PointerEvent) => {
      if (useExperience.getState().locked) return;
      if ((e.target as HTMLElement).closest('button')) return;
      dragging = true;
      lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!dragging || localTimeState.count === 0) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      // dragging the world right moves you earlier — direct manipulation
      const next = localTimeState.target - dx / unitPx();
      localTimeState.target = Math.min(localTimeState.count - 1, Math.max(0, next));
      localTimeState.lastInputMs = performance.now();
    };
    const up = () => {
      dragging = false;
    };
    root.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      root.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const applyFocus = (key: string | null) => {
    Object.keys(themeFocus.target).forEach((k) => {
      themeFocus.target[k] = k === key ? 1 : 0;
    });
  };

  const step = (dir: -1 | 1) => {
    if (useExperience.getState().locked || localTimeState.count === 0) return;
    localTimeState.target = stepIndex(
      Math.round(localTimeState.target),
      dir,
      localTimeState.count - 1
    );
    localTimeState.lastInputMs = performance.now();
  };

  if (!vm) return null;

  const stationAsset = (p: YolPointVM) => {
    if (p.role === 'overview') return getRoleAsset(identity, 'hero');
    if (p.role === 'closing') return getRoleAsset(identity, 'atmosphere');
    if (!p.sectionKey) return null;
    return getSectionAsset(identity, p.sectionKey) ?? getAsset(identity, p.sectionKey);
  };

  const active = vm.points[activePoint];

  return (
    <div
      ref={rootRef}
      className="yol-page yol-world"
      data-lens={activeLens ?? undefined}
      data-year={yearId}
      data-source={vm.source}
      data-active-point={active?.id}
      data-testid="yol-page"
      style={identityCssVars(identity) as React.CSSProperties}
    >
      {/* masthead: the year, in its period voice */}
      <div ref={mastRef} className="yw-mast">
        <div className="yp-kicker">Year on Line</div>
        <h2 className="yp-title yw-title" data-testid="yol-title">
          {vm.title}
        </h2>
        <div className="yp-rule" aria-hidden />
        {debug && vm.source === 'fallback' && (
          <div className="yw-source-note">fallback content · {state.fallbackReason}</div>
        )}
      </div>

      {/* theme lenses — same colours as the theme spheres in Line View */}
      <div
        ref={chipsRef}
        className="yp-chips yw-chips"
        role="group"
        aria-label="Theme lenses — focus to re-weight the year"
      >
        {vm.lenses.map((lens) => (
          <button
            key={lens.key}
            className="yp-chip"
            style={{ ['--chip' as string]: lens.hue }}
            data-testid={`lens-${lens.key}`}
            data-active={activeLens === lens.key || undefined}
            aria-pressed={activeLens === lens.key}
            onClick={() => {
              // clicking pins a lens (toggles); hovering is transient
              const next = pinnedLens === lens.key ? null : lens.key;
              setPinnedLens(next);
              applyFocus(next);
            }}
            onMouseEnter={() => {
              setHoverLens(lens.key);
              applyFocus(lens.key);
            }}
            onMouseLeave={() => {
              setHoverLens(null);
              applyFocus(pinnedLens);
            }}
            onFocus={() => {
              setHoverLens(lens.key);
              applyFocus(lens.key);
            }}
            onBlur={() => {
              setHoverLens(null);
              applyFocus(pinnedLens);
            }}
          >
            <i className="yp-orb" aria-hidden />
            {lens.label}
          </button>
        ))}
      </div>

      {/* the field: the year's material above the local Line */}
      <div ref={fieldRef} className="yw-field" aria-live="polite">
        {vm.points.map((p, i) => {
          const sub = p.sectionKey ? identity.themes[p.sectionKey] : undefined;
          const surface = sub?.surface ?? 'paper';
          const asset = stationAsset(p);
          const dim =
            activeLens !== null &&
            p.role !== 'overview' &&
            p.role !== 'closing' &&
            !p.themes.includes(activeLens);
          return (
            <section
              key={p.id}
              className={`yw-station surface-${surface}${dim ? ' dim' : ''}`}
              data-role={p.role}
              data-section={p.sectionKey ?? undefined}
              data-motif={sub?.motif}
              data-themes={p.themes.join(' ')}
              data-testid={`station-${p.id}`}
              aria-hidden={i !== activePoint}
              style={
                sub
                  ? ({ '--yr-sub-accent': sub.accent } as React.CSSProperties)
                  : undefined
              }
            >
              {asset && (
                <MediaFrame
                  asset={asset}
                  identity={identity}
                  treatment={p.role === 'closing' ? 'panorama' : undefined}
                  captioned={p.role !== 'overview' && p.role !== 'closing'}
                  className="yw-station-media"
                />
              )}
              <div className="yw-station-body">
                {p.dateLabel && <div className="yp-event-date">{p.dateLabel}</div>}
                {p.role === 'context' && (
                  <div className="yp-event-date">{p.yearLabel}</div>
                )}
                {p.role !== 'overview' && (
                  <h3 className="yp-event-title">{p.headline}</h3>
                )}
                {p.summary && (
                  <p className={p.role === 'overview' ? 'yp-thesis yw-overview-thesis' : 'yp-event-text'}>
                    {p.summary}
                  </p>
                )}
                {p.role === 'overview' && vm.supportingLine && (
                  <p className="yw-context-note">{vm.supportingLine}</p>
                )}
                {p.role === 'context' && (
                  <p className="yw-context-note">
                    A neighbouring year on the Line — descend there for its own world.
                  </p>
                )}
                {p.role === 'closing' && (
                  <p className="yw-context-note">
                    Scroll back through the year, or return to the Line above.
                  </p>
                )}
                {p.themes.length > 0 && (
                  <div className="yp-event-tags">
                    {p.themes.map((tk) => {
                      const lens = vm.lenses.find((l) => l.key === tk);
                      return (
                        <span key={tk} style={{ ['--chip' as string]: lens?.hue }}>
                          <i className="yp-orb" aria-hidden />
                          {lens?.label ?? tk}
                        </span>
                      );
                    })}
                  </div>
                )}
                {p.sources.length > 0 && (
                  <div className="yw-sources" data-testid="point-sources">
                    {p.sources.map((s2, j) => (
                      <span key={j}>
                        {s2.title}
                        {s2.locator ? ` · ${s2.locator}` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {p.provenance === 'placeholder' && p.role !== 'closing' && (
                  <div className="yw-provenance">provisional · unsourced placeholder</div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* explicit stepping — the touch/narrow-safe control */}
      <div className="yw-nav" aria-hidden={false}>
        <button
          className="yw-step"
          data-testid="local-prev"
          aria-label="Earlier on the local timeline"
          onClick={() => step(-1)}
        >
          ←
        </button>
        <button
          className="yw-step"
          data-testid="local-next"
          aria-label="Later on the local timeline"
          onClick={() => step(1)}
        >
          →
        </button>
      </div>

      {/* The local Line: same object as the parent Line, one level deeper.
          The chronology track slides beneath a FIXED local temporal marker. */}
      <footer ref={lineRef} className="yw-line" data-testid="local-line">
        <div className="yw-line-band" aria-hidden />
        <div ref={trackRef} className="yw-track">
          {vm.points.map((p, i) => (
            <div
              key={p.id}
              className={`yw-tick role-${p.role}${
                activeLens !== null && p.role === 'development' && !p.themes.includes(activeLens)
                  ? ' dim'
                  : ''
              }`}
              style={{ ['--ti' as string]: String(i) }}
              data-testid={`tick-${p.id}`}
              onClick={() => {
                if (useExperience.getState().locked) return;
                localTimeState.target = i;
                localTimeState.lastInputMs = performance.now();
              }}
            >
              <i className="yw-dot" aria-hidden />
              <span className="yw-tick-y">{p.tickLabel}</span>
              <span className="yw-tick-s">{p.role === 'overview' ? vm.supportingLine ?? '' : p.headline}</span>
            </div>
          ))}
        </div>
        <div className="yw-marker" aria-hidden>
          <i className="yw-marker-pulse" />
        </div>
      </footer>

      {/* integrity note — structural convention, constant across years */}
      <p className="yw-note">
        Artwork is project-directed generated illustration or a placeholder
        slot — never archival media. Provisional summaries await editorial
        verification and sourcing.
      </p>
    </div>
  );
}
