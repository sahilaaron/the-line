'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { descentState } from '../runtime';
import { useTuning } from '../store';

/**
 * Full-screen atmospheric cloud layer used to hide the scene swap during
 * descent/return. A camera-locked quad with fbm clouds whose opacity is
 * driven by descentState.cloud (animated by GSAP in DescentController).
 */

const CLOUD_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uWarm; // 0 = cool orbital passage, 1 = warm archival light

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(13.7, 7.1);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = vUv * 3.4;
    float t = uTime * 0.12;
    float clouds = fbm(p + vec2(t * 0.6, -t * 1.6));
    clouds += fbm(p * 2.2 - vec2(t, t * 2.2)) * 0.4;
    clouds = smoothstep(0.35, 1.05, clouds);

    // clouds thicken from the edges inward as opacity rises
    float coverage = smoothstep(1.0 - uOpacity * 1.25, 1.0, clouds + uOpacity * 0.85);
    // one atmosphere, lit from two sides: cool blue-grey from orbit,
    // warming toward archival cream as the material year approaches
    vec3 coolLo = vec3(0.55, 0.62, 0.72);
    vec3 coolHi = vec3(0.92, 0.94, 0.97);
    vec3 warmLo = vec3(0.42, 0.37, 0.30);
    vec3 warmHi = vec3(0.97, 0.92, 0.80);
    vec3 col = mix(mix(coolLo, coolHi, clouds), mix(warmLo, warmHi, clouds), uWarm);
    gl_FragColor = vec4(col, coverage * uOpacity);
  }
`;

export function CloudLayer() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  // NOTE: R3F v9 clones the `uniforms` prop on construction — animated
  // uniforms must be mutated through the material ref, never this object.
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uOpacity: { value: 0 }, uWarm: { value: 0 } }),
    []
  );

  useFrame((state, dt) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    mat.uniforms.uTime.value += dt;
    mat.uniforms.uOpacity.value = Math.min(
      1,
      descentState.cloud * useTuning.getState().cloudDensity
    );
    // ease the warmth toward the current world so the tint never pops
    const warm = mat.uniforms.uWarm.value as number;
    mat.uniforms.uWarm.value = warm + (descentState.blend - warm) * Math.min(1, dt * 2.4);

    mesh.visible = mat.uniforms.uOpacity.value > 0.001;
    if (!mesh.visible) return;

    // lock the quad to the camera, filling the frustum at distance 1.5
    const cam = state.camera as THREE.PerspectiveCamera;
    const dist = 1.5;
    const h = 2 * dist * Math.tan((cam.fov * Math.PI) / 360);
    const w = h * cam.aspect;
    mesh.position.copy(cam.position);
    mesh.quaternion.copy(cam.quaternion);
    mesh.translateZ(-dist);
    mesh.scale.set(w, h, 1);
  });

  return (
    <mesh ref={meshRef} renderOrder={100} frustumCulled={false}>
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
        fragmentShader={CLOUD_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
