'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '../config';
import { timeState } from '../runtime';
import { useTuning } from '../store';

/**
 * The Line itself: a long horizontal glowing band. Gold near the active
 * position, cooling to blue-white with distance, fading at the far ends.
 * NOTE (R3F v9): animated uniforms are mutated via the material ref — the
 * `uniforms` prop object is cloned on construction.
 */

const LINE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vX;
  void main() {
    vUv = uv;
    vX = position.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LINE_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying float vX;
  uniform float uWorldShift; // group x offset; active position is at -uWorldShift
  uniform float uHalfSpan;
  uniform vec3 uGold;
  uniform vec3 uCool;
  uniform float uTime;
  uniform float uOpacity;

  void main() {
    float distToActive = abs(vX + uWorldShift);
    float warm = exp(-distToActive * 0.55);
    vec3 col = mix(uCool, uGold, warm);

    // vertical profile: bright core, soft edges
    float core = 1.0 - smoothstep(0.0, 0.5, abs(vUv.y - 0.5));
    float intensity = 0.25 + core * (0.75 + warm * 1.2);

    // fade the extreme ends of the band
    float endFade = 1.0 - smoothstep(uHalfSpan * 0.72, uHalfSpan, abs(vX));

    // faint slow shimmer
    intensity *= 0.96 + 0.04 * sin(vX * 2.0 - uTime * 0.8);

    gl_FragColor = vec4(col * intensity, endFade * (0.35 + warm * 0.65) * uOpacity);
  }
`;

interface TheLineProps {
  /** total span of the band in world units */
  span: number;
  /** band thickness in world units */
  thickness?: number;
  /**
   * x-offset of this mesh inside its parent group (the band is centred on
   * its own origin); needed so the shader can locate the active position.
   */
  centerOffset?: number;
  /** when false (YoL), the warm centre is pinned to the mesh centre */
  tracksTime?: boolean;
  /** per-frame alpha multiplier (arrival reveal); defaults to fully visible */
  getOpacity?: () => number;
}

export function TheLine({
  span,
  thickness = 0.09,
  centerOffset = 0,
  tracksTime = true,
  getOpacity,
}: TheLineProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uWorldShift: { value: 0 },
      uHalfSpan: { value: span / 2 },
      uGold: { value: new THREE.Color(PALETTE.gold) },
      uCool: { value: new THREE.Color(PALETTE.coolLine) },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    }),
    [span]
  );

  useFrame((state) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    // The active anchor sits at group-local x = pos * spacing. This mesh is
    // itself offset by centerOffset, so shift the shader accordingly.
    mat.uniforms.uWorldShift.value = tracksTime
      ? centerOffset - timeState.pos * useTuning.getState().anchorSpacing
      : 0;
    mat.uniforms.uOpacity.value = getOpacity ? getOpacity() : 1;
  });

  return (
    <mesh name="the-line-band">
      <planeGeometry args={[span, thickness]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={LINE_VERT}
        fragmentShader={LINE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/** Pulsing gold marker used at the lens intersection and on the YoL line. */
export function LinePulse({
  scale = 1,
  getOpacity,
}: {
  scale?: number;
  getOpacity?: () => number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(PALETTE.gold) },
      uOpacity: { value: 1 },
    }),
    []
  );

  useFrame((state) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uOpacity.value = getOpacity ? getOpacity() : 1;
  });

  return (
    <mesh name="line-pulse" scale={scale}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={/* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          varying vec2 vUv;
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uOpacity;
          void main() {
            vec2 d = vUv - 0.5;
            float r = length(d) * 2.0;
            float core = exp(-r * 6.0);
            float ringPhase = fract(uTime * 0.55);
            float ring = smoothstep(0.09, 0.0, abs(r - ringPhase)) * (1.0 - ringPhase);
            float a = core * 1.4 + ring * 0.7;
            gl_FragColor = vec4(uColor, a * uOpacity);
          }
        `}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
