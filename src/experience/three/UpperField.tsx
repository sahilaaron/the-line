'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ANCHORS, MAX_INDEX } from '@/src/data/anchors';
import { clampTimePos } from '../time';
import { timeState } from '../runtime';
import { useTuning, useExperience } from '../store';
import { QUALITY } from '../config';

/**
 * The living upper field: abstract era-tinted particles + a few large haze
 * billboards. Per-era mood (tint, density, order) is interpolated continuously
 * from the anchors as the user travels. Restrained by design.
 */

const POINT_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  varying float vSeed;
  uniform float uTime;
  uniform float uOrder;
  void main() {
    vSeed = aSeed;
    vec3 p = position;
    // disordered eras drift chaotically; ordered eras move in gentle unison
    float chaos = 1.0 - uOrder;
    p.y += sin(uTime * (0.15 + aSeed * 0.4 * chaos) + aSeed * 40.0) * (0.35 + chaos * 0.5);
    p.x += cos(uTime * 0.1 + aSeed * 30.0) * chaos * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * (140.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAG = /* glsl */ `
  varying float vSeed;
  uniform vec3 uTint;
  uniform vec3 uAccent;
  uniform float uTime;
  uniform float uDensity;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float a = exp(-r * 4.0);
    float twinkle = 0.6 + 0.4 * sin(uTime * (0.8 + vSeed * 2.0) + vSeed * 90.0);
    vec3 col = mix(uTint, uAccent, step(0.85, vSeed));
    gl_FragColor = vec4(col, a * twinkle * uDensity * 0.5);
  }
`;

function lerpColor(out: THREE.Color, a: string, b: string, f: number) {
  out.set(a).lerp(new THREE.Color(b), f);
}

export function UpperField() {
  const particleBase = useTuning((s) => s.particleBase);
  const quality = useExperience((s) => s.quality);
  const count = Math.max(
    50,
    Math.floor(particleBase * QUALITY[quality].particleMul)
  );

  const { positions, seeds, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const rand = mulberry32(42);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (rand() - 0.5) * 46;
      positions[i * 3 + 1] = -1.5 + rand() * 9.5; // mostly above the Line
      positions[i * 3 + 2] = -4 - rand() * 14;
      seeds[i] = rand();
      sizes[i] = 0.4 + rand() * 1.4;
    }
    return { positions, seeds, sizes };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTint: { value: new THREE.Color('#9fd8e8') },
      uAccent: { value: new THREE.Color('#ffffff') },
      uDensity: { value: 0.8 },
      uOrder: { value: 0.9 },
    }),
    []
  );

  const matRef = useRef<THREE.ShaderMaterial>(null);
  const tint = useRef(new THREE.Color());
  const accent = useRef(new THREE.Color());

  useFrame((state) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    // interpolate era mood along the continuous position
    const t = clampTimePos(timeState.pos, MAX_INDEX);
    const i = Math.min(Math.floor(t), MAX_INDEX - 1);
    const f = t - i;
    const a = ANCHORS[i].era;
    const b = ANCHORS[i + 1].era;
    lerpColor(tint.current, a.tint, b.tint, f);
    lerpColor(accent.current, a.accent, b.accent, f);
    mat.uniforms.uTint.value.copy(tint.current);
    mat.uniforms.uAccent.value.copy(accent.current);
    mat.uniforms.uDensity.value = a.density + (b.density - a.density) * f;
    mat.uniforms.uOrder.value = a.order + (b.order - a.order) * f;
  });

  return (
    <points key={count} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={POINT_VERT}
        fragmentShader={POINT_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Deterministic PRNG so particle layouts are stable across renders. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
