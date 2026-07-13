'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MAX_INDEX } from '@/src/data/anchors';
import { useExperience, useTuning } from './store';
import {
  descentState,
  fieldTimeState,
  localTimeState,
  topicScrollState,
  destinationStyle,
  metricsState,
  motionPref,
  timeState,
} from './runtime';
import { applyWheel, stepIndex } from './time';
import { PALETTE, QUALITY, TUNING_DEFAULTS, type Tuning } from './config';
import { cssVariables } from './tokens';
import { LineScene } from './scenes/LineScene';
import { DescentController } from './scenes/DescentController';
import { CloudLayer } from './three/CloudLayer';
import { DestinationSignals } from './three/DestinationSignals';
import { Overlay } from './overlay/Overlay';

/** Fog/background blending, camera housekeeping and metrics sampling. */
function SceneRoot() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);

  const colors = useMemo(
    () => ({
      bg: new THREE.Color(PALETTE.lineBg),
      line: new THREE.Color(PALETTE.lineBg),
      yol: new THREE.Color(PALETTE.yolBg),
      fog: new THREE.FogExp2(PALETTE.lineBg, TUNING_DEFAULTS.fogDensity),
    }),
    []
  );

  useEffect(() => {
    scene.background = colors.bg;
    scene.fog = colors.fog;
  }, [scene, colors]);

  const fpsRef = useRef({ frames: 0, last: 0 });
  const skyRef = useRef('');

  useFrame((state, dt) => {
    const tuning = useTuning.getState();
    const exp = useExperience.getState();
    const cam = state.camera as THREE.PerspectiveCamera;

    // background + fog blend between the two worlds; the YoL side is the
    // destination year's sky (from its visual identity), not a fixed colour
    if (skyRef.current !== destinationStyle.sky) {
      skyRef.current = destinationStyle.sky;
      colors.yol.set(destinationStyle.sky);
    }
    colors.bg.copy(colors.line).lerp(colors.yol, descentState.blend);
    colors.fog.color.copy(colors.bg);
    colors.fog.density = tuning.fogDensity * (1 + descentState.blend * 0.9);

    // live fov / camera distance (only while GSAP does not own the camera)
    if (cam.fov !== tuning.fov) {
      cam.fov = tuning.fov;
      cam.updateProjectionMatrix();
    }
    if (!exp.locked) {
      if (exp.mode === 'yol' && !motionPref.reduced) {
        // barely-there drift so the tableau breathes without moving the text
        const t = state.clock.elapsedTime;
        cam.position.set(
          Math.sin(t * 0.11) * 0.12,
          Math.sin(t * 0.083) * 0.08,
          tuning.cameraDistance
        );
      } else {
        cam.position.set(0, 0, tuning.cameraDistance);
      }
    }

    // metrics
    const f = fpsRef.current;
    f.frames += 1;
    f.last += dt;
    if (f.last >= 0.5) {
      metricsState.fps = Math.round(f.frames / f.last);
      f.frames = 0;
      f.last = 0;
      metricsState.drawCalls = gl.info.render.calls;
      metricsState.triangles = gl.info.render.triangles;
      metricsState.dpr = gl.getPixelRatio();
    }
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[-6, 5, 7]} intensity={1.1} />
      <LineScene />
      <DestinationSignals />
      <CloudLayer />
      <DescentController />
    </>
  );
}

export default function Experience() {
  const mode = useExperience((s) => s.mode);
  const locked = useExperience((s) => s.locked);
  const worldTop = useExperience((s) => s.worldStack[s.worldStack.length - 1]?.frame.type);
  const worldDepth = useExperience((s) => Math.max(0, s.worldStack.length - 1));
  const quality = useExperience((s) => s.quality);
  const debug = useMemo(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === '1',
    []
  );

  // development tuning via URL (debug mode only): ?debug=1&tune.<key>=<n>
  // lets a visual-iteration session or a journey capture pin exact tuning
  // values without touching code (values land in the same useTuning store
  // the ?debug=1 panel edits)
  useEffect(() => {
    if (!debug) return;
    const params = new URLSearchParams(window.location.search);
    const overrides: Record<string, number> = {};
    params.forEach((value, key) => {
      if (!key.startsWith('tune.')) return;
      const name = key.slice(5) as keyof Tuning;
      const n = Number(value);
      if (Number.isFinite(n) && name in TUNING_DEFAULTS) overrides[name] = n;
    });
    if (Object.keys(overrides).length > 0) {
      useTuning.getState().set(overrides as Partial<Tuning>);
    }
  }, [debug]);

  // keep motionPref fresh
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionPref.reduced = mq.matches;
    const onChange = () => {
      motionPref.reduced = mq.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Wheel + keyboard input (Line View only, ignored while locked).
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const exp = useExperience.getState();
      if (exp.locked) return;
      if (exp.mode === 'line') {
        e.preventDefault();
        const s = useTuning.getState().scrollSensitivity;
        timeState.target = applyWheel(timeState.target, e.deltaY, s, MAX_INDEX);
        timeState.lastInputMs = performance.now();
        timeState.hasScrolled = true;
        return;
      }
      if (exp.mode === 'yol') {
        const top = exp.worldStack[exp.worldStack.length - 1]?.frame;
        if (!top) return;
        e.preventDefault();
        const t = useTuning.getState();
        if (top.type === 'yol' && localTimeState.count > 0) {
          // same temporal grammar as the parent Line: scroll down = earlier
          localTimeState.target = applyWheel(
            localTimeState.target,
            e.deltaY,
            t.localScrollSensitivity,
            localTimeState.count - 1
          );
          localTimeState.lastInputMs = performance.now();
        } else if (top.type === 'historical-field') {
          // continuous years; down = earlier, exactly like every other axis
          fieldTimeState.target = Math.min(
            fieldTimeState.rangeEnd,
            Math.max(
              fieldTimeState.rangeStart,
              fieldTimeState.target - e.deltaY * t.fieldYearsPerWheelPx
            )
          );
          fieldTimeState.lastInputMs = performance.now();
        } else if (top.type === 'topic' && topicScrollState.count > 0) {
          // chapters are editorial, not temporal: wheel down = onward
          topicScrollState.target = Math.min(
            topicScrollState.count - 1,
            Math.max(0, topicScrollState.target + e.deltaY * t.topicWheelSensitivity)
          );
          topicScrollState.lastInputMs = performance.now();
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const exp = useExperience.getState();
      if (e.key === 'Escape' && exp.mode === 'yol') {
        // one level up the world stack (delegates to the camera return at
        // depth 1); respects the transition lock internally
        e.preventDefault();
        exp.popWorld();
        return;
      }
      if (exp.locked) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      if (exp.mode === 'line') {
        e.preventDefault();
        timeState.target = stepIndex(
          Math.round(timeState.target),
          dir,
          MAX_INDEX
        );
        timeState.lastInputMs = performance.now();
        timeState.hasScrolled = true;
        return;
      }
      if (exp.mode === 'yol') {
        const top = exp.worldStack[exp.worldStack.length - 1]?.frame;
        if (!top) return;
        e.preventDefault();
        if (top.type === 'yol' && localTimeState.count > 0) {
          // left = earlier, right = later — one grammar at every depth
          localTimeState.target = stepIndex(
            Math.round(localTimeState.target),
            dir,
            localTimeState.count - 1
          );
          localTimeState.lastInputMs = performance.now();
        } else if (top.type === 'historical-field') {
          fieldTimeState.target = Math.min(
            fieldTimeState.rangeEnd,
            Math.max(fieldTimeState.rangeStart, Math.round(fieldTimeState.target) + dir)
          );
          fieldTimeState.lastInputMs = performance.now();
        } else if (top.type === 'topic' && topicScrollState.count > 0) {
          topicScrollState.target = stepIndex(
            Math.round(topicScrollState.target),
            dir,
            topicScrollState.count - 1
          );
          topicScrollState.lastInputMs = performance.now();
        }
      }
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const themeVars = useMemo(() => cssVariables(), []);

  return (
    <div
      className={`experience mode-${mode}`}
      data-mode={mode}
      data-locked={locked ? 'true' : 'false'}
      data-world={worldTop ?? undefined}
      data-depth={worldDepth}
      style={themeVars}
    >
      <Canvas
        dpr={[1, QUALITY[quality].dprCap]}
        camera={{
          fov: TUNING_DEFAULTS.fov,
          position: [0, 0, TUNING_DEFAULTS.cameraDistance],
          near: 0.1,
          far: 140,
        }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <SceneRoot />
      </Canvas>
      <Overlay debug={debug} />
    </div>
  );
}
