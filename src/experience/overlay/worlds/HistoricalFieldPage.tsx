'use client';

/**
 * The Historical Field: a continuous 20-year world. The local Line stays
 * near the bottom with yearly + five-year ticks sliding beneath a fixed
 * central marker; above it, the temporal collage hangs in depth layers
 * whose horizontal position derives from historical time.
 *
 * Per-frame work: ease/snap the continuous time, translate 3 depth-layer
 * containers + the tick track, and write emphasis (opacity/scale/
 * interactivity) onto the visible plates. Layout itself is computed ONCE
 * per dataset by the deterministic algorithm in ../field/layout.ts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HistoricalFieldItemVM } from '@/src/domain/worlds';
import { useExperience, useTuning } from '../../store';
import {
  fieldTimeState,
  motionPref,
  setFieldRange,
  yolReveal,
} from '../../runtime';
import { approach } from '../../time';
import type { HistoricalFieldFrame, TopicFrame } from '../../worlds';
import {
  computeFieldLayout,
  emphasisAt,
  visiblePlacements,
  type FieldPlacement,
} from '../../field/layout';
import { useFieldVM } from '../useWorldData';
import { PlaceholderPlate } from './PlaceholderPlate';

const DEPTHS = [0, 1, 2] as const;

export function HistoricalFieldPage({ frame }: { frame: HistoricalFieldFrame }) {
  const { vm, status } = useFieldVM(frame);
  const vwPerYear = useTuning((s) => s.fieldVwPerYear);
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLSpanElement>(null);
  const lastYearShown = useRef<number>(NaN);
  const [windowYear, setWindowYear] = useState(() => Math.round(frame.restore.time));

  const layout = useMemo(
    () =>
      vm
        ? computeFieldLayout(vm.items, {
            rangeStart: frame.rangeStart,
            rangeEnd: frame.rangeEnd,
            vwPerYear,
            seed: frame.id,
          })
        : [],
    [vm, frame.rangeStart, frame.rangeEnd, frame.id, vwPerYear]
  );
  const itemById = useMemo(() => new Map((vm?.items ?? []).map((i) => [i.id, i])), [vm]);

  // install the continuous time axis; restore.time IS the exact position
  useEffect(() => {
    setFieldRange(frame.rangeStart, frame.rangeEnd, frame.restore.time);
    setWindowYear(Math.round(frame.restore.time));
  }, [frame.id, frame.rangeStart, frame.rangeEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // returning from a topic: re-focus the plate the visitor entered through
  useEffect(() => {
    const focused = frame.restore.focusedItemId;
    if (!focused || !rootRef.current) return;
    const el = rootRef.current.querySelector<HTMLButtonElement>(`[data-item-id="${focused}"]`);
    el?.focus({ preventScroll: true });
  }, [frame.id, frame.restore.focusedItemId, vm]);

  // the visible-window set only changes on discrete year boundaries
  const mounted = useMemo(() => {
    const t = useTuning.getState();
    return visiblePlacements(layout, windowYear, t.fieldVisibleRadiusYears, t.fieldOverscanYears);
  }, [layout, windowYear]);

  /** THE per-frame loop: time easing + 4 container transforms + emphasis. */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = useTuning.getState();
      if (fieldTimeState.rangeEnd === fieldTimeState.rangeStart) return;

      // idle snap to the nearest round year, then ease the travel
      const idle = now - fieldTimeState.lastInputMs;
      if (idle > t.fieldSnapDelayMs) {
        const snap = Math.round(fieldTimeState.target);
        fieldTimeState.target = approach(fieldTimeState.target, snap, t.fieldSnapStrength, dt);
        if (Math.abs(fieldTimeState.target - snap) < 0.0006) fieldTimeState.target = snap;
      }
      fieldTimeState.time = motionPref.reduced
        ? fieldTimeState.target
        : approach(fieldTimeState.time, fieldTimeState.target, 9, dt);
      const time = fieldTimeState.time;
      const travelled = (time - fieldTimeState.rangeStart) * t.fieldVwPerYear;

      // depth-layer parallax: deeper layers travel slower
      DEPTHS.forEach((depth) => {
        const el = layerRefs.current[depth];
        if (!el) return;
        const f = motionPref.reduced ? 1 : 1 - depth * t.fieldParallax;
        el.style.transform = `translateX(calc(50vw - ${(travelled * f).toFixed(3)}vw))`;
      });
      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(calc(50vw - ${travelled.toFixed(3)}vw))`;
      }

      // current-year label (writes only when the rounded year changes)
      const shown = Math.round(time);
      if (shown !== lastYearShown.current && yearRef.current) {
        lastYearShown.current = shown;
        yearRef.current.textContent = String(shown);
        setWindowYear(shown); // discrete: drives the mounted window
      }

      // emphasis on visible plates + arrival reveal
      const root = rootRef.current;
      if (root) {
        root.style.setProperty('--hf-reveal', String(Math.max(yolReveal.env, 0.001)));
        const lineEl = root.querySelector<HTMLElement>('.hf-line');
        if (lineEl) lineEl.style.opacity = String(0.25 + yolReveal.line * 0.75);
        const plates = root.querySelectorAll<HTMLElement>('.hf-item');
        const inWorld = useExperience.getState().mode === 'yol';
        plates.forEach((el) => {
          const mid = Number(el.dataset.midYear);
          const e = emphasisAt(mid - time, {
            activeRadius: t.fieldActiveRadiusYears,
            opacityFalloff: t.fieldOpacityFalloff,
            scaleFalloff: t.fieldScaleFalloff,
          });
          el.style.opacity = String(e.opacity);
          el.style.transform = `translate(-50%, 0) scale(${e.scale.toFixed(3)})`;
          el.style.pointerEvents = e.interactive && inWorld ? 'auto' : 'none';
          if (e.interactive) el.dataset.near = 'true';
          else delete el.dataset.near;
        });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const enterItem = (item: HistoricalFieldItemVM, el: HTMLElement) => {
    const s = useExperience.getState();
    if (s.locked) return;
    const dist = Math.abs(
      (item.endYear !== undefined ? (item.startYear + item.endYear) / 2 : item.startYear) -
        fieldTimeState.time
    );
    if (dist > useTuning.getState().fieldActiveRadiusYears || !item.topicWorldSlug) {
      // distant or worldless plates: travel to their moment instead
      fieldTimeState.target = Math.min(
        fieldTimeState.rangeEnd,
        Math.max(fieldTimeState.rangeStart, item.startYear)
      );
      fieldTimeState.lastInputMs = performance.now();
      return;
    }
    const rect = el.getBoundingClientRect();
    s.updateTopRestore({ time: fieldTimeState.time, focusedItemId: item.id });
    const topicFrame: TopicFrame = {
      type: 'topic',
      id: `topic-${item.topicWorldSlug}-${Date.now()}`,
      slug: item.topicWorldSlug,
      topicKind: item.kind === 'idea' ? 'intellectual-movement' : item.kind === 'person' ? 'person' : item.kind === 'organisation' ? 'organisation' : 'invention',
      title: item.title,
      restore: { chapterPos: 0 },
    };
    s.pushWorld(topicFrame, {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      seed: item.media[0]?.id ?? item.id,
    });
  };

  const renderPlate = (p: FieldPlacement) => {
    const item = itemById.get(p.id);
    if (!item) return null;
    const media = item.media[0];
    return (
      <button
        key={p.id}
        className="hf-item"
        data-testid={`field-item-${p.slug}`}
        data-item-id={p.id}
        data-mid-year={p.midYear}
        data-kind={item.kind}
        data-opens-world={item.topicWorldSlug ? 'true' : undefined}
        style={{
          left: `${p.xVw.toFixed(2)}vw`,
          top: `${p.yVh.toFixed(2)}vh`,
          width: `${p.widthVw.toFixed(2)}vw`,
          zIndex: p.zIndex,
        }}
        aria-label={`${item.title} — ${item.kind}, ${item.dateLabel}${
          item.topicWorldSlug ? '. Opens a topic world.' : ''
        }`}
        onClick={(e) => enterItem(item, e.currentTarget)}
      >
        {media && (
          <PlaceholderPlate
            seed={media.id}
            kind={item.kind}
            aspectRatio={media.aspectRatio}
          />
        )}
        <span className="hf-item-label">
          <span className="hf-item-kind">{item.kind}</span>
          <span className="hf-item-title">{item.title}</span>
          <span className="hf-item-date">{item.dateLabel}</span>
        </span>
      </button>
    );
  };

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = frame.rangeStart; y <= frame.rangeEnd; y++) list.push(y);
    return list;
  }, [frame.rangeStart, frame.rangeEnd]);

  return (
    <div
      ref={rootRef}
      className="hf-root"
      data-testid="historical-field"
      data-range={`${frame.rangeStart}-${frame.rangeEnd}`}
    >
      {status === 'error' && (
        <p className="hf-note hf-error">This range is not available yet.</p>
      )}

      {/* the temporal collage, in three parallax depth layers */}
      <div className="hf-field" aria-label={`Historical field, ${frame.title}`}>
        {DEPTHS.map((depth) => (
          <div
            key={depth}
            ref={(el) => {
              layerRefs.current[depth] = el;
            }}
            className="hf-layer"
            data-depth={depth}
          >
            {mounted.filter((p) => p.depth === depth).map(renderPlate)}
          </div>
        ))}
      </div>

      {/* the local Line: fixed marker, time slides beneath */}
      <footer className="hf-line" data-testid="field-line">
        <div className="hf-band" aria-hidden />
        <div ref={trackRef} className="hf-track">
          {years.map((y) => (
            <div
              key={y}
              className={`hf-tick${y % 5 === 0 ? ' major' : ''}`}
              style={{ ['--tx' as string]: `${((y - frame.rangeStart) * vwPerYear).toFixed(2)}vw` }}
            >
              <i className="hf-dot" aria-hidden />
              {y % 5 === 0 && <span className="hf-tick-y">{y}</span>}
            </div>
          ))}
        </div>
        <div className="hf-marker" aria-hidden>
          <i className="hf-marker-pulse" />
        </div>
        <span ref={yearRef} className="hf-current-year" data-testid="field-current-year">
          {Math.round(frame.restore.time)}
        </span>
      </footer>

      <p className="hf-note">
        Provisional field — placeholder plates and unverified records; nothing
        here is final or archival.
      </p>
    </div>
  );
}
