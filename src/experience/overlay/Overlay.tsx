'use client';

import { useEffect, useRef, useState } from 'react';
import { ANCHORS } from '@/src/data/anchors';
import { useExperience, useTuning } from '../store';
import { descentState, timeState, yolReveal } from '../runtime';
import { formatYear, yearAt } from '../time';
import { DebugPanel } from './DebugPanel';
import { YolPage } from './YolPage';
import { DataLayer } from './DataLayer';
import { LineAnchorData } from './LineAnchorData';

const YEARS = ANCHORS.map((a) => a.year);

/**
 * DOM overlay: fixed temporal lens, active year label, hints, notices,
 * the scrollable Year on Line page (YolPage, year-driven) and the return
 * control.
 * Readable text lives in the DOM, not in the 3D scene.
 */
export function Overlay({ debug }: { debug: boolean }) {
  const mode = useExperience((s) => s.mode);
  const activeIndex = useExperience((s) => s.activeIndex);
  const notice = useExperience((s) => s.notice);
  const lineVh = useTuning((s) => s.lineVh);
  const anchor = ANCHORS[activeIndex];

  const [hintVisible, setHintVisible] = useState(true);
  const readoutRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLButtonElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);

  // per-frame DOM work: year readout + return-button reveal
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = readoutRef.current;
      if (el) {
        const offAnchor =
          Math.abs(timeState.pos - Math.round(timeState.pos)) > 0.02;
        el.textContent = offAnchor
          ? formatYear(yearAt(timeState.pos, YEARS))
          : '';
      }
      if (timeState.hasScrolled) setHintVisible(false);

      const btn = returnRef.current;
      if (btn) {
        const v = Math.max(yolReveal.env, yolReveal.text);
        btn.style.opacity = String(v);
      }

      // The cloud passage darkens the paper world beneath it, so the page
      // never pops at full brightness mid-transition. Sits BELOW the Line
      // strip (z-index), so The Line stays lit until the swap — on return,
      // the Line visibly "regains control" before the world dissolves.
      const dim = dimRef.current;
      if (dim) {
        dim.style.opacity = String(Math.min(1, descentState.cloud * 0.92));
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // auto-clear notices
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useExperience.getState().setNotice(null), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  const inLineWorld = mode === 'line' || mode === 'descending';

  return (
    <div
      className="overlay"
      style={{ ['--line-vh' as string]: String(lineVh) }}
    >
      {/* fixed temporal lens */}
      <div className={`lens ${inLineWorld ? '' : 'hidden'}`}>
        <div className="lens-stem" />
        <div className="lens-ring" />
      </div>

      {/* Line View UI */}
      <div className={`line-ui ${inLineWorld ? '' : 'hidden'}`}>
        <header className="masthead">
          <h1>The Line</h1>
          <span className="masthead-tag">Temporal Lens · Prototype</span>
        </header>

        <div className="year-block">
          <div className="year-active" data-testid="year-label">
            {anchor.label}
          </div>
          <div className="year-sub">{anchor.subtitle}</div>
          <div className="year-readout" ref={readoutRef} />
          <LineAnchorData />
        </div>

        <div className={`hint ${hintVisible ? '' : 'hidden'}`}>
          <span className="hint-key">scroll</span> travel backward ·{' '}
          <span className="hint-key">←→</span> step anchors ·{' '}
          <span className="hint-key">click Earth</span> enter the year
        </div>
      </div>

      {/* seeded data layer, woven into Line View (fetches /api/line-data) */}
      <DataLayer active={inLineWorld} debug={debug} />

      {/* Year on Line: scrollable collage page */}
      <div
        className={`yol-ui ${mode === 'yol' ? '' : 'hidden'}`}
        data-testid="yol-ui"
      >
        <YolPage />
        <div ref={dimRef} className="yol-dimmer" aria-hidden />
        <button
          ref={returnRef}
          className="return-btn"
          data-testid="return-btn"
          onClick={() => useExperience.getState().requestReturn()}
        >
          ↑ Return to the Line
        </button>
      </div>

      {/* notices */}
      <div className={`notice ${notice ? '' : 'hidden'}`} data-testid="notice">
        {notice}
      </div>

      {debug && <DebugPanel />}
    </div>
  );
}
