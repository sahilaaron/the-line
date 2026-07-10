'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '../config';

/**
 * Stylised procedural Temporal Earth: fbm-shaded surface (no textures),
 * faint wireframe grid shell, fresnel atmosphere. Deliberately abstract —
 * this is not a geographic Earth.
 */

const SURFACE_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SURFACE_FRAG = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  uniform float uTime;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 p = normalize(vPos);
    float continents = fbm(p * 2.6 + vec3(uTime * 0.008, 0.0, 0.0));
    float land = smoothstep(0.48, 0.56, continents);

    vec3 ocean = vec3(0.055, 0.11, 0.20);
    vec3 landCol = vec3(0.10, 0.17, 0.16);
    vec3 col = mix(ocean, landCol, land);

    // faint city-light speckle on land
    float lights = step(0.985, noise(p * 60.0)) * land;
    col += vec3(0.9, 0.75, 0.45) * lights * 0.6;

    // day-side shading from a fixed key light direction
    vec3 lightDir = normalize(vec3(-0.6, 0.5, 0.65));
    float diff = clamp(dot(vNormal, lightDir), 0.0, 1.0);
    col *= 0.35 + diff * 0.9;

    // subtle rim
    float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
    col += vec3(0.25, 0.45, 0.75) * rim * 0.35;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMO_FRAG = /* glsl */ `
  varying vec3 vNormal;
  uniform vec3 uColor;
  void main() {
    float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, -1.0)), 3.0);
    gl_FragColor = vec4(uColor, 1.0) * intensity;
  }
`;

interface EarthProps {
  onSelect: () => void;
}

export function Earth({ onSelect }: EarthProps) {
  const surfaceRef = useRef<THREE.Mesh>(null);
  const surfaceMatRef = useRef<THREE.ShaderMaterial>(null);
  const surfaceUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const atmoUniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(PALETTE.atmosphere) } }),
    []
  );

  useFrame((_, dt) => {
    if (surfaceMatRef.current) {
      surfaceMatRef.current.uniforms.uTime.value += dt;
    }
    if (surfaceRef.current) surfaceRef.current.rotation.y += dt * 0.04;
  });

  return (
    <group>
      {/* clickable surface */}
      <mesh
        ref={surfaceRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'default')}
      >
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          ref={surfaceMatRef}
          vertexShader={SURFACE_VERT}
          fragmentShader={SURFACE_FRAG}
          uniforms={surfaceUniforms}
        />
      </mesh>

      {/* faint grid shell */}
      <mesh>
        <sphereGeometry args={[1.03, 24, 16]} />
        <meshBasicMaterial
          color={PALETTE.coolLine}
          wireframe
          transparent
          opacity={0.05}
        />
      </mesh>

      {/* fresnel atmosphere */}
      <mesh scale={1.22}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          vertexShader={ATMO_VERT}
          fragmentShader={ATMO_FRAG}
          uniforms={atmoUniforms}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
