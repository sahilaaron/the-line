'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Theme } from '@/src/data/types';
import { useTuning } from '../store';
import { descentState, motionPref } from '../runtime';

/**
 * Theme spheres orbiting the Temporal Earth on a gently tilted ring.
 * Rebuilt (with a short fade-in) whenever the active anchor changes.
 * During descent (descentState.orbFly 0→1) the spheres sweep outward and
 * past the camera, selling the departure from orbit.
 */

interface ThemeOrbsProps {
  themes: Theme[];
  /** hides the DOM labels during descent / in YoL */
  labelsVisible: boolean;
}

export function ThemeOrbs({ themes, labelsVisible }: ThemeOrbsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const fadeRef = useRef(0);

  // restart the fade whenever the theme set changes
  useEffect(() => {
    fadeRef.current = 0;
  }, [themes]);

  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;
    fadeRef.current = Math.min(1, fadeRef.current + dt * 2.2);
    const fade = fadeRef.current;
    const fly = descentState.orbFly;
    const radius =
      useTuning.getState().orbitRadius * (1 + fly * fly * 2.6);
    const drift = motionPref.reduced ? 0.02 : 0.12;
    const t = state.clock.elapsedTime * drift;

    g.children.forEach((child, i) => {
      const angle = t + (i / Math.max(1, themes.length)) * Math.PI * 2;
      child.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle * 2.0) * 0.22 + 0.25,
        Math.sin(angle) * radius * 0.55 + fly * fly * 9.0
      );
      const s = (0.9 + 0.1 * Math.sin(t * 3 + i)) * fade * (1 - fly * 0.85);
      child.scale.setScalar(Math.max(0.0001, s));
    });
  });

  return (
    <group ref={groupRef}>
      {themes.map((theme) => (
        <group key={theme.id}>
          <mesh>
            <sphereGeometry args={[0.3, 24, 24]} />
            <meshStandardMaterial
              color={theme.color}
              emissive={theme.color}
              emissiveIntensity={0.55}
              transparent
              opacity={0.28}
              roughness={0.4}
            />
          </mesh>
          <mesh scale={1.15}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshBasicMaterial
              color={theme.color}
              transparent
              opacity={0.08}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          {labelsVisible && (
            <Html center className="orb-label" zIndexRange={[20, 10]}>
              <span>{theme.label}</span>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}
