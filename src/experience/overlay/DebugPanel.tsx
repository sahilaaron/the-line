'use client';

import { useEffect, useState } from 'react';
import { ANCHORS } from '@/src/data/anchors';
import { useExperience, useTuning } from '../store';
import { metricsState } from '../runtime';
import type { QualityTier, TuningKey } from '../config';

/**
 * Development tuning mode (?debug=1). Live sliders over the central tuning
 * store plus basic render metrics. Deliberately plain — a tool, not UI.
 */

interface SliderDef {
  key: TuningKey;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderDef[] = [
  { key: 'scrollSensitivity', label: 'scroll sensitivity', min: 0.0004, max: 0.005, step: 0.0001 },
  { key: 'snapStrength', label: 'snap strength', min: 0.5, max: 12, step: 0.1 },
  { key: 'snapDelayMs', label: 'snap delay ms', min: 0, max: 800, step: 10 },
  { key: 'lineVh', label: 'line height vh', min: 55, max: 90, step: 0.5 },
  { key: 'yolLineVh', label: 'yol line vh', min: 80, max: 97, step: 0.1 },
  { key: 'earthScale', label: 'earth scale', min: 0.4, max: 2, step: 0.01 },
  { key: 'earthVh', label: 'earth height vh', min: 15, max: 55, step: 0.5 },
  { key: 'orbitRadius', label: 'theme orbit radius', min: 0.8, max: 4, step: 0.05 },
  { key: 'descentDuration', label: 'descent duration s', min: 1, max: 8, step: 0.1 },
  { key: 'fogDensity', label: 'fog density', min: 0, max: 0.08, step: 0.001 },
  { key: 'cloudDensity', label: 'cloud density', min: 0, max: 1.5, step: 0.01 },
  { key: 'cameraDistance', label: 'camera distance', min: 6, max: 20, step: 0.1 },
  { key: 'particleBase', label: 'particle count', min: 100, max: 4000, step: 50 },
  { key: 'anchorSpacing', label: 'anchor spacing', min: 3, max: 10, step: 0.1 },
  { key: 'fov', label: 'fov', min: 30, max: 70, step: 1 },
  { key: 'signalsLead', label: 'signals lead', min: 0, max: 0.9, step: 0.01 },
  { key: 'localScrollSensitivity', label: 'local scroll sens', min: 0.0008, max: 0.01, step: 0.0002 },
  { key: 'localSnapStrength', label: 'local snap strength', min: 0.5, max: 12, step: 0.1 },
  { key: 'localSnapDelayMs', label: 'local snap delay ms', min: 0, max: 800, step: 10 },
  { key: 'localTickSpacingVw', label: 'local tick spacing vw', min: 6, max: 30, step: 0.5 },
  { key: 'localFieldTravelVw', label: 'local field travel vw', min: 30, max: 140, step: 2 },
  { key: 'fieldVwPerYear', label: 'field vw / year', min: 4, max: 30, step: 0.5 },
  { key: 'fieldYearsPerWheelPx', label: 'field wheel yrs/px', min: 0.001, max: 0.01, step: 0.0002 },
  { key: 'fieldSnapDelayMs', label: 'field snap delay ms', min: 0, max: 900, step: 10 },
  { key: 'fieldSnapStrength', label: 'field snap strength', min: 0.5, max: 12, step: 0.1 },
  { key: 'fieldVisibleRadiusYears', label: 'field visible radius yr', min: 3, max: 15, step: 0.5 },
  { key: 'fieldActiveRadiusYears', label: 'field active radius yr', min: 0.5, max: 6, step: 0.1 },
  { key: 'fieldOpacityFalloff', label: 'field opacity falloff', min: 0.02, max: 0.4, step: 0.01 },
  { key: 'fieldScaleFalloff', label: 'field scale falloff', min: 0, max: 0.12, step: 0.005 },
  { key: 'fieldParallax', label: 'field parallax', min: 0, max: 0.5, step: 0.01 },
  { key: 'topicChapterVw', label: 'topic chapter vw', min: 70, max: 100, step: 1 },
  { key: 'topicWheelSensitivity', label: 'topic wheel sens', min: 0.0005, max: 0.006, step: 0.0001 },
  { key: 'worldTransitionSec', label: 'world transition s', min: 0.2, max: 2.5, step: 0.05 },
  { key: 'arrivalStagger', label: 'arrival stagger s', min: 0, max: 1.5, step: 0.05 },
  { key: 'arrivalStageDur', label: 'arrival stage s', min: 0.2, max: 2.5, step: 0.05 },
  { key: 'subjectScale', label: 'subject scale', min: 0.5, max: 1.8, step: 0.02 },
];

export function DebugPanel() {
  const tuning = useTuning();
  const mode = useExperience((s) => s.mode);
  const activeIndex = useExperience((s) => s.activeIndex);
  const quality = useExperience((s) => s.quality);
  const [metrics, setMetrics] = useState({ ...metricsState });

  useEffect(() => {
    const id = setInterval(() => setMetrics({ ...metricsState }), 250);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className="debug-panel" data-testid="debug-panel">
      <div className="debug-title">
        tuning
        <button className="debug-reset" onClick={() => useTuning.getState().reset()}>
          reset
        </button>
      </div>

      {SLIDERS.map((s) => (
        <label key={s.key} className="debug-row">
          <span>{s.label}</span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={tuning[s.key]}
            onChange={(e) =>
              useTuning.getState().set({ [s.key]: Number(e.target.value) })
            }
          />
          <em>{formatVal(tuning[s.key])}</em>
        </label>
      ))}

      <label className="debug-row">
        <span>quality tier</span>
        <select
          value={quality}
          onChange={(e) =>
            useExperience.getState().setQuality(e.target.value as QualityTier)
          }
        >
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </label>

      <div className="debug-title">metrics</div>
      <div className="debug-metrics">
        <div>
          mode <b data-testid="metric-mode">{mode}</b>
        </div>
        <div>
          anchor <b>{ANCHORS[activeIndex].id}</b>
        </div>
        <div>
          fps <b>{metrics.fps}</b>
        </div>
        <div>
          dpr <b>{metrics.dpr.toFixed(2)}</b>
        </div>
        <div>
          quality <b>{quality}</b>
        </div>
        <div>
          draw calls <b>{metrics.drawCalls}</b>
        </div>
        <div>
          triangles <b>{metrics.triangles.toLocaleString()}</b>
        </div>
      </div>
    </aside>
  );
}

function formatVal(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v < 0.01 ? v.toFixed(4) : v.toFixed(2);
}
