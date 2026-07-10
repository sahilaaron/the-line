'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { descentState } from '../runtime';

/**
 * First signs of the human world, emerging inside the cloud passage:
 * radio wavefronts, television scan lines, a warm horizon light, a distant
 * launch glow and low-frequency geometric forms. Camera-locked quad drawn
 * just beneath the cloud layer so the destination bleeds through as the
 * clouds thin. Driven by descentState.signals (GSAP).
 */

const SIGNALS_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAmount;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    float a = 0.0;
    vec3 col = vec3(0.0);

    // --- television scan lines, drifting slowly ---
    float scan = sin((uv.y + uTime * 0.02) * 420.0) * 0.5 + 0.5;
    float scanBand = smoothstep(0.35, 0.0, abs(uv.y - fract(uTime * 0.045) ) );
    col += vec3(0.55, 0.65, 0.8) * scan * 0.05 * (0.4 + scanBand);
    a += scan * 0.045 * (0.4 + scanBand);

    // --- radio wavefronts expanding from below the horizon ---
    vec2 src = vec2(0.62, -0.18);
    float r = length((uv - src) * vec2(1.6, 1.0));
    float wave = 0.0;
    for (int i = 0; i < 3; i++) {
      float phase = fract(uTime * 0.16 + float(i) * 0.333);
      wave += smoothstep(0.02, 0.0, abs(r - phase * 1.1)) * (1.0 - phase);
    }
    col += vec3(0.62, 0.86, 0.78) * wave * 0.5;
    a += wave * 0.4;

    // --- warm horizon light rising from the bottom ---
    float horizon = smoothstep(0.42, 0.0, uv.y);
    col += vec3(0.85, 0.62, 0.32) * horizon * 0.30;
    a += horizon * 0.26;

    // --- distant launch glow: a slim vertical flare left of centre ---
    float lx = abs(uv.x - 0.24);
    float launch = exp(-lx * 34.0) * smoothstep(0.55, 0.05, uv.y)
                 * (0.7 + 0.3 * sin(uTime * 2.2));
    col += vec3(0.95, 0.8, 0.55) * launch * 0.5;
    a += launch * 0.4;

    // --- low-frequency geometric forms: faint great-circle style arcs ---
    float arcs = smoothstep(0.012, 0.0, abs(fract((uv.x * 0.85 + uv.y * 0.4) * 3.0 + uTime * 0.01) - 0.5) - 0.47);
    col += vec3(0.5, 0.6, 0.75) * arcs * 0.09;
    a += arcs * 0.07;

    // gentle noise flicker so it reads as transmission, not UI
    float flick = 0.92 + 0.08 * hash(vec2(floor(uTime * 24.0), floor(uv.y * 30.0)));

    gl_FragColor = vec4(col * flick, a * uAmount);
  }
`;

export function DestinationSignals() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uAmount: { value: 0 } }),
    []
  );

  useFrame((state, dt) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    mat.uniforms.uTime.value += dt;
    mat.uniforms.uAmount.value = descentState.signals;

    mesh.visible = descentState.signals > 0.002;
    if (!mesh.visible) return;

    const cam = state.camera as THREE.PerspectiveCamera;
    const dist = 1.4; // just in front of the cloud quad (1.5)
    const h = 2 * dist * Math.tan((cam.fov * Math.PI) / 360);
    const w = h * cam.aspect;
    mesh.position.copy(cam.position);
    mesh.quaternion.copy(cam.quaternion);
    mesh.translateZ(-dist);
    mesh.scale.set(w, h, 1);
  });

  return (
    <mesh ref={meshRef} renderOrder={101} frustumCulled={false}>
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
        fragmentShader={SIGNALS_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
