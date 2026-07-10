'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ANCHORS, MAX_INDEX } from '@/src/data/anchors';
import { useExperience, useTuning } from '../store';
import { timeState, descentState } from '../runtime';
import { approach, nearestIndex } from '../time';
import { Earth } from '../three/Earth';
import { ThemeOrbs } from '../three/ThemeOrbs';
import { TheLine, LinePulse } from '../three/TheLine';
import { UpperField } from '../three/UpperField';
import { PALETTE, vhLayout } from '../config';

/**
 * The Line View world. The camera and lens stay fixed; the line group
 * translates in X as the user scrolls. The Earth hangs above the active year
 * (world x=0), joined to the Line by a gold beam.
 */
export function LineScene() {
  const activeIndex = useExperience((s) => s.activeIndex);
  const mode = useExperience((s) => s.mode);
  const anchor = ANCHORS[activeIndex];

  const rootRef = useRef<THREE.Group>(null);
  const lineGroupRef = useRef<THREE.Group>(null);
  const earthGroupRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Group>(null);

  const spacingAtBuild = useTuning((s) => s.anchorSpacing);
  const span = MAX_INDEX * spacingAtBuild + 34;
  const mid = (MAX_INDEX * spacingAtBuild) / 2;

  const showLabels = mode === 'line' || mode === 'descending';

  useFrame((_, dt) => {
    const root = rootRef.current;
    if (!root) return;
    root.visible = descentState.blend < 0.5;
    if (!root.visible) return;

    const tuning = useTuning.getState();
    const exp = useExperience.getState();

    // --- scroll integration + soft snapping (only while interactive) ---
    if (exp.mode === 'line' && !exp.locked) {
      const idleMs = performance.now() - timeState.lastInputMs;
      if (idleMs > tuning.snapDelayMs) {
        const snapTarget = Math.round(timeState.target);
        timeState.target = approach(
          timeState.target,
          snapTarget,
          tuning.snapStrength,
          dt
        );
        if (Math.abs(timeState.target - snapTarget) < 0.0008) {
          timeState.target = snapTarget;
        }
      }
      timeState.pos = approach(timeState.pos, timeState.target, 9, dt);
      exp.setActiveIndex(nearestIndex(timeState.pos, MAX_INDEX));
    }

    // --- layout from live tuning ---
    const { lineY, earthY } = vhLayout(tuning);
    const spacing = tuning.anchorSpacing;

    const lineGroup = lineGroupRef.current;
    if (lineGroup) {
      lineGroup.position.set(-timeState.pos * spacing, lineY, 0);
    }

    const earthGroup = earthGroupRef.current;
    if (earthGroup) {
      earthGroup.position.set(0, earthY, 0);
      earthGroup.scale.setScalar(tuning.earthScale);
    }

    const beam = beamRef.current;
    if (beam) {
      const top = earthY - tuning.earthScale * 0.55;
      const height = Math.max(0.1, top - lineY);
      beam.position.set(0, lineY + height / 2, -0.05);
      beam.scale.set(0.1, height, 1);
    }

    const pulse = pulseRef.current;
    if (pulse) pulse.position.set(0, lineY, 0.02);
  });

  return (
    <group ref={rootRef} name="line-scene">
      <UpperField />

      {/* moving timeline group */}
      <group ref={lineGroupRef} name="line-group">
        <group position={[mid, 0, 0]}>
          <TheLine span={span} centerOffset={mid} />
        </group>

        {ANCHORS.map((a, i) => (
          <group key={a.id} position={[i * spacingAtBuild, 0, 0]}>
            {/* tick */}
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[0.025, 0.34]} />
              <meshBasicMaterial
                color={PALETTE.gold}
                transparent
                opacity={i === activeIndex ? 0.9 : 0.35}
              />
            </mesh>
            {showLabels && (
              <Html
                center
                position={[0, -0.72, 0]}
                className={`anchor-label${i === activeIndex ? ' active' : ''}`}
                zIndexRange={[15, 5]}
              >
                <div>
                  <div className="anchor-year">{a.label}</div>
                  <div className="anchor-sub">{a.subtitle}</div>
                </div>
              </Html>
            )}
          </group>
        ))}

        {/* the future, beyond the last anchor */}
        {showLabels && (
          <Html
            center
            position={[(MAX_INDEX + 1.6) * spacingAtBuild, -0.72, 0]}
            className="anchor-label future"
            zIndexRange={[15, 5]}
          >
            <div>
              <div className="anchor-year">The Future →</div>
              <div className="anchor-sub">Many Paths, Many Possibilities</div>
            </div>
          </Html>
        )}
      </group>

      {/* pulse at the lens intersection */}
      <group ref={pulseRef}>
        <LinePulse scale={0.85} />
      </group>

      {/* gold beam joining Earth to the active year */}
      <mesh ref={beamRef}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          vertexShader={/* glsl */ `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={/* glsl */ `
            varying vec2 vUv;
            void main() {
              float x = 1.0 - abs(vUv.x - 0.5) * 2.0;
              float a = pow(x, 2.2) * (0.16 + 0.5 * vUv.y);
              gl_FragColor = vec4(0.91, 0.72, 0.29, a);
            }
          `}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Temporal Earth + theme spheres */}
      <group ref={earthGroupRef} name="earth-group">
        <Earth
          onSelect={() => {
            const exp = useExperience.getState();
            exp.requestDescent(exp.activeIndex);
          }}
        />
        <ThemeOrbs themes={anchor.themes} labelsVisible={showLabels} />
      </group>
    </group>
  );
}
