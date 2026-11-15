import * as THREE from 'three';
import { fbm, makeRng } from '../core/util';
import type { SeasonPalette } from '../scenes/seasons';

/** 초저녁 하늘: 남색 → 청록 그라데이션, 해 진 쪽의 따뜻한 빛 */
export function buildSky(season: SeasonPalette): THREE.Mesh {
  const sun = new THREE.Vector3(...season.sun.dir).normalize();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color(season.sky.zenith) },
      uMid: { value: new THREE.Color(season.sky.mid) },
      uHorizon: { value: new THREE.Color(season.sky.horizon) },
      uGlow: { value: new THREE.Color(season.sky.glow) },
      uSunDir: { value: new THREE.Vector3(sun.x, 0, sun.z).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform vec3 uSunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uZenith, smoothstep(0.2, 0.78, h));
        // 해가 진 방향의 노을
        float az = max(dot(normalize(vec3(d.x, 0.0, d.z)), uSunDir), 0.0);
        float low = 1.0 - smoothstep(0.0, 0.34, abs(h));
        col = mix(col, uGlow, pow(az, 3.0) * low * 0.85);
        col += uGlow * pow(az, 14.0) * low * 0.25;
        col = mix(col, uHorizon * 0.7, smoothstep(0.0, -0.15, d.y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 24, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.name = 'sky';
  return mesh;
}

/** 초저녁 별 몇 개 */
export function buildStars(): THREE.Points {
  const rnd = makeRng(99);
  const n = 260;
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const y = 0.25 + rnd() * 0.75;
    const r = Math.sqrt(1 - y * y);
    const R = 700;
    pos[i * 3] = Math.cos(a) * r * R;
    pos[i * 3 + 1] = y * R;
    pos[i * 3 + 2] = Math.sin(a) * r * R;
    size[i] = 1 + rnd() * 2.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTw;
      void main() {
        vTw = 0.65 + 0.35 * sin(uTime * 0.8 + position.x * 0.05 + position.z * 0.03);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio;
      }`,
    fragmentShader: /* glsl */ `
      varying float vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d) * vTw;
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.88), a * 0.85);
      }`,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -9;
  pts.name = 'stars';
  return pts;
}

/**
 * 원경 능선: 단지를 말발굽처럼 감싸는 빈계산·금수봉 능선을 저폴리 산으로, 겹겹이.
 * 북쪽에 빈계산, 북서쪽에 더 높은 금수봉.
 */
export function buildRidges(season: SeasonPalette): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ridges';
  const layers = [
    { radius: 185, base: 26, amp: 20, color: 0x3a5a52, seed: 1.3, peak: 1.0 },
    { radius: 270, base: 44, amp: 30, color: 0x3a5a6c, seed: 4.1, peak: 1.25 },
    { radius: 380, base: 62, amp: 40, color: 0x44688a, seed: 8.7, peak: 1.45 },
  ];
  const fogC = new THREE.Color(season.fog);
  for (const L of layers) {
    const seg = 96;
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color(L.color);
    const cTop = c.clone().lerp(fogC, 0.15);
    const cBot = c.clone().lerp(fogC, 0.55);
    const ring = (i: number): { x: number; z: number; hgt: number } => {
      const a = (i / seg) * Math.PI * 2;
      // 방위: a=0 → 북쪽(-z)
      const dx = Math.sin(a);
      const dz = -Math.cos(a);
      // 빈계산(북), 금수봉(북서)
      const north = Math.exp(-Math.pow(angleDist(a, 0.12) / 0.34, 2)) * 46;
      const nw = Math.exp(-Math.pow(angleDist(a, -0.86) / 0.3, 2)) * 68;
      // 남쪽은 낮게 열림(입구 쪽)
      const south = Math.exp(-Math.pow(angleDist(a, Math.PI) / 0.7, 2));
      const n = fbm(Math.cos(a) * 2.2 + L.seed, Math.sin(a) * 2.2 + L.seed * 0.7, 4);
      const hgt = (L.base + n * L.amp * 1.6 + (north + nw) * L.peak) * (1 - south * 0.5);
      const r = L.radius * (1 + (n - 0.5) * 0.12);
      return { x: dx * r, z: dz * r, hgt };
    };
    for (let i = 0; i < seg; i++) {
      const p0 = ring(i);
      const p1 = ring(i + 1);
      const foot = 0.72;
      const mid = 0.87;
      const rows0 = [
        [p0.x * foot, -6, p0.z * foot],
        [p0.x * mid, p0.hgt * 0.62, p0.z * mid],
        [p0.x, p0.hgt, p0.z],
      ];
      const rows1 = [
        [p1.x * foot, -6, p1.z * foot],
        [p1.x * mid, p1.hgt * 0.62, p1.z * mid],
        [p1.x, p1.hgt, p1.z],
      ];
      for (let k = 0; k < 2; k++) {
        const a0 = rows0[k];
        const b0 = rows0[k + 1];
        const a1 = rows1[k];
        const b1 = rows1[k + 1];
        const ca = k === 0 ? cBot : c;
        const cb = k === 0 ? c : cTop;
        pos.push(...a0, ...a1, ...b0, ...b0, ...a1, ...b1);
        for (const cc of [ca, ca, cb, cb, ca, cb]) col.push(cc.r, cc.g, cc.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    // 안개는 색에 미리 섞어 둠(멀수록 하늘빛에 가까워지는 겹겹의 능선)
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(5, 0, -10);
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}

function angleDist(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}
