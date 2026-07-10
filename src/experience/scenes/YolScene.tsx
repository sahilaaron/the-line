'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTuning } from '../store';
import {
  descentState,
  motionPref,
  themeFocus,
  yolReveal,
} from '../runtime';
import { vhLayout } from '../config';
import { TheLine, LinePulse } from '../three/TheLine';

/**
 * The 1969 Year-on-Line tableau. Three depth planes:
 *  - background: slow atmospheric world (horizon light, drifting cloud bands,
 *    scan lines, city-light dots, a distant launch trail);
 *  - middle: the dominant subject — a large procedural Moon, an Earth→Moon
 *    trajectory carrying a spacecraft silhouette, broadcast wavefronts,
 *    analogue circuit geometry, and a darker divided-world layer;
 *  - foreground: DOM text (Overlay) + the Line and its pulse.
 *
 * Everything is procedural placeholder art — no archival media. The theme
 * lenses (themeFocus.current) and the staged arrival (yolReveal) re-weight
 * layer intensities per frame. All uniforms are mutated via material refs
 * (R3F clones the `uniforms` prop — see implementation notes).
 */

/** Scene-local layout (world units; camera rests at z = cameraDistance). */
const L = {
  bg: { pos: [0, 0.6, -14] as const, size: [64, 27] as const },
  moon: { pos: [4.7, 2.15, -6] as const, radius: 2.55 },
  trajStart: new THREE.Vector3(-8.2, -4.0, -5.6),
  trajCtrl: new THREE.Vector3(-1.2, -0.8, -5.6),
  trajEnd: new THREE.Vector3(2.75, 0.85, -6.0),
  waves: { pos: [-4.6, -2.9, -5.8] as const },
  circuit: { pos: [4.1, -2.35, -5.2] as const, size: [7.4, 3.6] as const },
  coldwar: { pos: [0, -3.15, -7.2] as const, size: [32, 3.6] as const },
};

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/* Background plane                                                     */
/* ------------------------------------------------------------------ */

const BG_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uReveal;
  uniform float uSignal;
  uniform float uSpace;
  uniform float uColdWar;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.1 + 17.3; a *= 0.5; }
    return v;
  }
  float seg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    vec2 uv = vUv;

    // deep-night vertical gradient
    vec3 col = mix(vec3(0.055, 0.095, 0.15), vec3(0.016, 0.028, 0.05), uv.y);

    // slow high-atmosphere cloud bands
    float bands = fbm(vec2(uv.x * 3.2 + uTime * 0.008, uv.y * 6.0));
    col += vec3(0.10, 0.13, 0.18) * bands * smoothstep(0.75, 0.25, uv.y) * 0.55;

    // warm horizon light — the first sign of the human world
    float horizon = exp(-abs(uv.y - 0.16) * 9.0);
    col += vec3(0.55, 0.34, 0.14) * horizon * (0.5 + 0.5 * uReveal);

    // city-light / settlement dots along the lower band
    vec2 cg = vec2(uv.x * 90.0, uv.y * 26.0);
    float cell = hash(floor(cg));
    float dot_ = smoothstep(0.28, 0.0, length(fract(cg) - 0.5));
    float cityBand = smoothstep(0.30, 0.10, uv.y) * smoothstep(0.02, 0.10, uv.y);
    float twinkle = 0.75 + 0.25 * sin(uTime * (0.5 + cell * 2.0) + cell * 50.0);
    float city = step(0.93, cell) * dot_ * cityBand * twinkle;
    col += vec3(0.9, 0.72, 0.42) * city * 0.8;

    // faint map-like geometry: latitude curves, divided when Cold War focuses
    float lat = smoothstep(0.004, 0.0, abs(fract(uv.y * 7.0 + sin(uv.x * 5.0) * 0.35) - 0.5) * 0.14);
    col += vec3(0.16, 0.22, 0.3) * lat * (uColdWar * 0.55);
    float divide = smoothstep(0.006, 0.0, abs(uv.x - 0.5)) * uColdWar;
    col += vec3(0.5, 0.16, 0.12) * divide * 0.6;

    // television scan lines + transmission flicker (Signal lens)
    float scan = sin(uv.y * 560.0 + uTime * 1.5) * 0.5 + 0.5;
    col += vec3(0.35, 0.45, 0.6) * scan * (0.015 + uSignal * 0.06);
    float flick = hash(vec2(floor(uTime * 18.0), floor(uv.y * 40.0)));
    col += vec3(0.4, 0.5, 0.65) * flick * uSignal * 0.05;

    // distant launch trail rising on the left (Spaceflight lens strengthens)
    float trail = smoothstep(0.010, 0.0, seg(uv, vec2(0.175, 0.10), vec2(0.28, 0.72)));
    float trailGlow = smoothstep(0.06, 0.0, seg(uv, vec2(0.175, 0.10), vec2(0.28, 0.72)));
    float pulse = 0.7 + 0.3 * sin(uTime * 1.3);
    col += (vec3(0.95, 0.82, 0.6) * trail + vec3(0.5, 0.42, 0.3) * trailGlow * 0.4)
           * (0.35 + uSpace * 0.9) * pulse;

    gl_FragColor = vec4(col, uReveal);
  }
`;

function BackgroundPlane() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uSignal: { value: 0 },
      uSpace: { value: 0 },
      uColdWar: { value: 0 },
    }),
    []
  );

  useFrame((_, dt) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value += dt * (motionPref.reduced ? 0.25 : 1);
    mat.uniforms.uReveal.value = yolReveal.env;
    mat.uniforms.uSignal.value = themeFocus.current.signal;
    mat.uniforms.uSpace.value = themeFocus.current.spaceflight;
    mat.uniforms.uColdWar.value = themeFocus.current.coldwar;
  });

  return (
    <mesh position={[...L.bg.pos]} renderOrder={-10}>
      <planeGeometry args={[...L.bg.size]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={QUAD_VERT}
        fragmentShader={BG_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Moon — the dominant subject                                          */
/* ------------------------------------------------------------------ */

const MOON_FRAG = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  uniform float uReveal;
  uniform float uSpace;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1); p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.15; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 p = normalize(vPos);

    // maria: broad dark basalt patches
    float maria = smoothstep(0.52, 0.62, fbm(p * 2.2 + 3.7));
    // crater speckle at two scales
    float craters = smoothstep(0.78, 0.95, noise(p * 14.0)) * 0.5
                  + smoothstep(0.85, 0.99, noise(p * 34.0)) * 0.35;

    vec3 base = mix(vec3(0.78, 0.79, 0.82), vec3(0.42, 0.44, 0.48), maria);
    base -= craters * 0.16;

    // key light from lower-left (Earth side), soft terminator upper-right
    vec3 lightDir = normalize(vec3(-0.55, -0.15, 0.82));
    float diff = clamp(dot(vNormal, lightDir), 0.0, 1.0);
    float terminator = smoothstep(0.0, 0.35, diff);
    vec3 col = base * (0.10 + terminator * (0.75 + uSpace * 0.35));

    // faint cool rim against space
    float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
    col += vec3(0.35, 0.45, 0.6) * rim * 0.18;

    gl_FragColor = vec4(col, uReveal);
  }
`;

function MoonSubject() {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const glowRef = useRef<THREE.MeshBasicMaterial>(null);
  const uniforms = useMemo(
    () => ({ uReveal: { value: 0 }, uSpace: { value: 0 } }),
    []
  );

  useFrame((state) => {
    const g = groupRef.current;
    const mat = matRef.current;
    if (!g || !mat) return;
    const s = useTuning.getState().subjectScale;
    g.scale.setScalar(L.moon.radius * s);
    if (!motionPref.reduced) {
      g.rotation.y = state.clock.elapsedTime * 0.008;
    }
    mat.uniforms.uReveal.value = yolReveal.subject;
    mat.uniforms.uSpace.value = themeFocus.current.spaceflight;
    if (glowRef.current) {
      glowRef.current.opacity =
        yolReveal.subject *
        (0.06 + themeFocus.current.spaceflight * 0.08);
    }
  });

  return (
    <group position={[...L.moon.pos]}>
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[1, 56, 56]} />
          <shaderMaterial
            ref={matRef}
            vertexShader={/* glsl */ `
              varying vec3 vNormal;
              varying vec3 vPos;
              void main() {
                vNormal = normalize(normalMatrix * normal);
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={MOON_FRAG}
            uniforms={uniforms}
            transparent
          />
        </mesh>
        {/* soft halo */}
        <mesh scale={1.35}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial
            ref={glowRef}
            color="#bcd2ec"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Trajectory + spacecraft silhouette                                   */
/* ------------------------------------------------------------------ */

function TrajectoryAndCraft() {
  const curve = useMemo(
    () => new THREE.QuadraticBezierCurve3(L.trajStart, L.trajCtrl, L.trajEnd),
    []
  );
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 64, 0.014, 6), [curve]);
  const trailMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const craftRef = useRef<THREE.Group>(null);
  const craftMats = useRef<THREE.MeshBasicMaterial[]>([]);
  const glowPos = useRef(new THREE.Vector3());
  const tangent = useRef(new THREE.Vector3());
  const glowMesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const subject = yolReveal.subject;
    const space = themeFocus.current.spaceflight;
    if (trailMat.current) {
      trailMat.current.opacity = subject * (0.24 + space * 0.5);
    }

    // spacecraft silhouette rides the arc, drifting very slightly
    const base = 0.7;
    const tPos = motionPref.reduced
      ? base
      : base + Math.sin(state.clock.elapsedTime * 0.11) * 0.035;
    const craft = craftRef.current;
    if (craft) {
      curve.getPoint(tPos, craft.position);
      curve.getTangent(tPos, tangent.current);
      craft.rotation.z = Math.atan2(tangent.current.y, tangent.current.x);
      craftMats.current.forEach((m) => {
        if (m) m.opacity = subject * (0.9 + space * 0.1);
      });
    }

    // glow point running along the trail
    if (glowMesh.current && glowMat.current) {
      const gT = motionPref.reduced
        ? 0.45
        : (state.clock.elapsedTime * 0.055) % 1;
      curve.getPoint(gT, glowPos.current);
      glowMesh.current.position.copy(glowPos.current);
      glowMat.current.opacity = subject * (0.5 + space * 0.5);
    }
  });

  const setCraftMat = (i: number) => (m: THREE.MeshBasicMaterial | null) => {
    if (m) craftMats.current[i] = m;
  };

  return (
    <group>
      <mesh geometry={tube}>
        <meshBasicMaterial
          ref={trailMat}
          color="#9fc3e8"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* abstract craft silhouette: dark stacked body + nose, no detail */}
      <group ref={craftRef} scale={0.85}>
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.075, 0.09, 0.62, 12]} />
          <meshBasicMaterial ref={setCraftMat(0)} color="#04070c" transparent opacity={0} />
        </mesh>
        <mesh position={[0.42, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.075, 0.22, 12]} />
          <meshBasicMaterial ref={setCraftMat(1)} color="#04070c" transparent opacity={0} />
        </mesh>
        <mesh position={[-0.36, 0.09, 0]} rotation={[0, 0, -Math.PI / 2.6]}>
          <coneGeometry args={[0.05, 0.16, 8]} />
          <meshBasicMaterial ref={setCraftMat(2)} color="#04070c" transparent opacity={0} />
        </mesh>
        <mesh position={[-0.36, -0.09, 0]} rotation={[0, 0, -Math.PI / 1.6]}>
          <coneGeometry args={[0.05, 0.16, 8]} />
          <meshBasicMaterial ref={setCraftMat(3)} color="#04070c" transparent opacity={0} />
        </mesh>
        {/* faint engine ember so the silhouette reads against dark regions */}
        <mesh position={[-0.34, 0, 0]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshBasicMaterial
            ref={setCraftMat(4)}
            color="#f0c98a"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      <mesh ref={glowMesh}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshBasicMaterial
          ref={glowMat}
          color="#fff3d6"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Broadcast wavefronts                                                 */
/* ------------------------------------------------------------------ */

function BroadcastWaves() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((state) => {
    const subject = yolReveal.subject;
    const signal = themeFocus.current.signal;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const t = motionPref.reduced
        ? (i + 0.5) / 4
        : (state.clock.elapsedTime * 0.22 + i / 4) % 1;
      m.scale.setScalar(0.35 + t * 4.6);
      (m.material as THREE.MeshBasicMaterial).opacity =
        (1 - t) * (0.14 + signal * 0.55) * subject;
    });
  });
  return (
    <group position={[...L.waves.pos]} rotation={[-0.25, 0.35, 0]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <ringGeometry args={[0.94, 1, 56]} />
          <meshBasicMaterial
            color="#9fe8c8"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Analogue circuit plane                                               */
/* ------------------------------------------------------------------ */

const CIRCUIT_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uReveal;
  uniform float uCompute;
  uniform float uMotion;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    vec2 grid = uv * vec2(22.0, 11.0);
    vec2 cell = floor(grid);
    vec2 f = fract(grid);

    // base grid
    float gline = smoothstep(0.06, 0.0, min(f.x, f.y))
                + smoothstep(0.06, 0.0, min(1.0 - f.x, 1.0 - f.y));
    float base = gline * 0.10;

    // traces: some cells carry a bright horizontal or vertical run
    float h = hash(cell);
    float trace = 0.0;
    if (h > 0.62 && h < 0.80) trace = smoothstep(0.10, 0.0, abs(f.y - 0.5));
    if (h >= 0.80) trace = smoothstep(0.10, 0.0, abs(f.x - 0.5));

    // nodes blink like register lamps
    float node = smoothstep(0.16, 0.0, length(f - 0.5));
    float blink = step(0.55, fract(uTime * (0.15 + h * 0.6) * uMotion + h));
    float lamps = node * step(0.9, h) * (uMotion > 0.5 ? blink : 0.85);

    // soft mask toward the edges
    float mask = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x)
               * smoothstep(0.0, 0.2, uv.y) * smoothstep(1.0, 0.8, uv.y);

    float amount = (0.12 + uCompute * 0.75);
    vec3 col = vec3(0.85, 0.68, 0.38) * (trace * 0.7 + lamps * 1.2)
             + vec3(0.35, 0.45, 0.6) * base;
    gl_FragColor = vec4(col, (base + trace * 0.55 + lamps * 0.8) * amount * mask * uReveal);
  }
`;

function CircuitPlane() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uCompute: { value: 0 },
      uMotion: { value: 1 },
    }),
    []
  );

  useFrame((_, dt) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value += dt;
    mat.uniforms.uReveal.value = yolReveal.subject;
    mat.uniforms.uCompute.value = themeFocus.current.computing;
    mat.uniforms.uMotion.value = motionPref.reduced ? 0 : 1;
  });

  return (
    <mesh position={[...L.circuit.pos]} rotation={[-0.16, -0.12, 0]}>
      <planeGeometry args={[...L.circuit.size]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={QUAD_VERT}
        fragmentShader={CIRCUIT_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Divided-world layer (Cold War counterpoint)                          */
/* ------------------------------------------------------------------ */

const COLDWAR_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uReveal;
  uniform float uColdWar;
  uniform float uMotion;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 uv = vUv;

    // two dark opposing masses with a jagged frontier
    float jag = (hash(vec2(floor(uv.y * 64.0), 1.0)) - 0.5) * 0.012;
    float side = uv.x - 0.5 + jag;
    float mass = smoothstep(0.35, 0.0, uv.y) * 0.8 + 0.2;
    vec3 col = vec3(0.015, 0.02, 0.03) * mass;
    float alpha = (0.30 + uColdWar * 0.45) * mass;

    // the frontier seam glows faintly warning-red as the lens focuses
    float seam = smoothstep(0.012, 0.0, abs(side));
    col += vec3(0.55, 0.14, 0.10) * seam * (0.25 + uColdWar * 1.1);
    alpha += seam * (0.15 + uColdWar * 0.5);

    // radar sweep on the right mass
    vec2 c = vec2(0.78, 0.22);
    vec2 d = uv - c;
    float ang = atan(d.y, d.x * 0.45);
    float sweepAng = uMotion > 0.5 ? uTime * 0.55 : 2.2;
    float sweep = smoothstep(0.35, 0.0, abs(mod(ang - sweepAng, 6.28318) - 0.175))
                * smoothstep(0.4, 0.05, length(d * vec2(0.45, 1.0)));
    col += vec3(0.25, 0.5, 0.3) * sweep * uColdWar * 0.8;
    alpha += sweep * uColdWar * 0.25;

    gl_FragColor = vec4(col, alpha * uReveal);
  }
`;

function ColdWarLayer() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uColdWar: { value: 0 },
      uMotion: { value: 1 },
    }),
    []
  );

  useFrame((_, dt) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value += dt;
    mat.uniforms.uReveal.value = yolReveal.subject;
    mat.uniforms.uColdWar.value = themeFocus.current.coldwar;
    mat.uniforms.uMotion.value = motionPref.reduced ? 0 : 1;
  });

  return (
    <mesh position={[...L.coldwar.pos]} renderOrder={-5}>
      <planeGeometry args={[...L.coldwar.size]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={QUAD_VERT}
        fragmentShader={COLDWAR_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Low cloud haze deck                                                  */
/* ------------------------------------------------------------------ */

function CloudDeck({ y }: { y: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uReveal: { value: 0 } }),
    []
  );
  useFrame((_, dt) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value += dt * (motionPref.reduced ? 0.2 : 1);
    mat.uniforms.uReveal.value = yolReveal.env;
  });
  return (
    <mesh position={[0, y + 0.6, -2.5]} rotation={[-Math.PI / 2.35, 0, 0]}>
      <planeGeometry args={[46, 10, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={QUAD_VERT}
        fragmentShader={/* glsl */ `
          varying vec2 vUv;
          uniform float uTime;
          uniform float uReveal;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                       mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
          }
          void main() {
            vec2 p = vUv * vec2(7.0, 2.4);
            float t = uTime * 0.03;
            float n = noise(p + vec2(t, 0.0)) * 0.6 + noise(p * 2.3 - vec2(t * 1.7, 0.0)) * 0.4;
            float edge = smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
            float ex = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
            gl_FragColor = vec4(vec3(0.62, 0.68, 0.78), n * edge * ex * 0.30 * uReveal);
          }
        `}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Scene root                                                           */
/* ------------------------------------------------------------------ */

export function YolScene() {
  const rootRef = useRef<THREE.Group>(null);
  const lineGroupRef = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    const root = rootRef.current;
    if (!root) return;
    root.visible = descentState.blend >= 0.5;
    if (!root.visible) return;

    // lerp theme lens focus toward targets
    const k = 1 - Math.exp(-6 * dt);
    (Object.keys(themeFocus.target) as (keyof typeof themeFocus.target)[]).forEach(
      (key) => {
        themeFocus.current[key] +=
          (themeFocus.target[key] - themeFocus.current[key]) * k;
      }
    );

    const { yolLineY } = vhLayout(useTuning.getState());
    if (lineGroupRef.current) lineGroupRef.current.position.y = yolLineY;
  });

  return (
    <group ref={rootRef} name="yol-scene">
      {/* background plane */}
      <BackgroundPlane />
      <CloudDeck y={-4.4} />

      {/* middle plane: the dominant subject */}
      <MoonSubject />
      <TrajectoryAndCraft />
      <BroadcastWaves />
      <CircuitPlane />
      <ColdWarLayer />

      {/* The Line, lower in YoL (≈91.7vh), with a live pulse on 1969 */}
      <group ref={lineGroupRef}>
        <TheLine
          span={44}
          thickness={0.07}
          tracksTime={false}
          getOpacity={() => yolReveal.line}
        />
        <LinePulse scale={0.7} getOpacity={() => yolReveal.line} />
      </group>
    </group>
  );
}
