import * as THREE from 'three';
import { clamp, fbm, lerp, noise2, smoothstep, closestOnSegment } from '../core/util';
import {
  WORLD,
  STREAM,
  STREAM_HALF_WIDTH,
  BUILDINGS,
  CABINS,
  PLAZA,
  NAV_NODES,
  NAV_EDGES,
  CLEARINGS,
} from '../scenes/daejeon/layout';
import type { SeasonPalette } from '../scenes/seasons';

interface Pad {
  x: number;
  z: number;
  hw: number;
  hd: number;
  y: number;
  blend: number;
}

/**
 * 지형: 입구(남서쪽 아래)에서 동쪽 나래마을과 북쪽 숲으로 오르는 완만한 경사.
 * 높이는 격자에 구워 두고, 아바타와 소품은 groundY()로 같은 값을 씁니다.
 */
export class Terrain {
  readonly nx: number;
  readonly nz: number;
  readonly heights: Float32Array;
  readonly streamPts: Array<[number, number]> = [];
  private pads: Pad[] = [];
  mesh!: THREE.Mesh;
  waterMaterial: THREE.ShaderMaterial | null = null;

  constructor(private season: SeasonPalette) {
    this.nx = Math.round((WORLD.maxX - WORLD.minX) / WORLD.cell) + 1;
    this.nz = Math.round((WORLD.maxZ - WORLD.minZ) / WORLD.cell) + 1;
    this.heights = new Float32Array(this.nx * this.nz);

    // 개울 중심선을 부드럽게 다시 나눔
    const curve = new THREE.CatmullRomCurve3(
      STREAM.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'catmullrom',
      0.5,
    );
    const n = Math.ceil(curve.getLength() / 2);
    for (const p of curve.getSpacedPoints(n)) this.streamPts.push([p.x, p.z]);

    // 건물과 오두막 자리는 평평하게 고름(오두막은 계단식 잔디가 됨)
    for (const b of BUILDINGS) {
      this.pads.push({
        x: b.x,
        z: b.z,
        hw: b.w / 2 + 1.2,
        hd: b.d / 2 + 1.2,
        y: b.padY !== undefined ? b.padY : this.rawHeight(b.x, b.z),
        blend: b.padY !== undefined ? 9 : 4,
      });
    }
    for (const c of CABINS) {
      this.pads.push({ x: c.x, z: c.z, hw: 3.6, hd: 3.4, y: this.rawHeight(c.x, c.z) + 0.25, blend: 3.2 });
    }

    for (let j = 0; j < this.nz; j++) {
      for (let i = 0; i < this.nx; i++) {
        const x = WORLD.minX + i * WORLD.cell;
        const z = WORLD.minZ + j * WORLD.cell;
        this.heights[j * this.nx + i] = this.computeHeight(x, z);
      }
    }
  }

  /** 건물 자리·개울을 반영하기 전의 기본 경사 */
  private rawHeight(x: number, z: number): number {
    const e = smoothstep(17, 72, x) * 12.6 + smoothstep(72, 140, x) * 17;
    const valley = lerp(0.2, 1, smoothstep(-46, -12, x));
    const n = (smoothstep(-30, -100, z) * 18 + smoothstep(-100, -140, z) * 12) * valley;
    const w = smoothstep(-52, -100, x) * 16 + smoothstep(-100, -135, x) * 10;
    const s = smoothstep(66, 122, z) * 9;
    const base = e + n + w + s;
    const wild = clamp(base / 3, 0, 1) + 0.1;
    const bumps = (fbm(x * 0.045 + 10, z * 0.045 + 3) - 0.47) * 2.4 * wild;
    return base + bumps;
  }

  streamDistance(x: number, z: number): number {
    if (x > -8 || x < -80) return 99;
    let best = 99;
    const pts = this.streamPts;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (Math.abs(a[1] - z) > 12 && Math.abs(b[1] - z) > 12) continue;
      const c = closestOnSegment(x, z, a[0], a[1], b[0], b[1]);
      if (c.d < best) best = c.d;
    }
    return best;
  }

  private computeHeight(x: number, z: number): number {
    let hgt = this.rawHeight(x, z);
    for (const p of this.pads) {
      const dx = Math.max(Math.abs(x - p.x) - p.hw, 0);
      const dz = Math.max(Math.abs(z - p.z) - p.hd, 0);
      const d = Math.hypot(dx, dz);
      if (d < p.blend) hgt = lerp(hgt, p.y, 1 - smoothstep(0, p.blend, d));
    }
    const sd = this.streamDistance(x, z);
    if (sd < 5) hgt -= 1.0 * (1 - smoothstep(0.4, 4.6, sd));
    return hgt;
  }

  /** 땅 높이 (지형 메시의 삼각형과 정확히 같은 보간) */
  groundY(x: number, z: number): number {
    const fx = clamp((x - WORLD.minX) / WORLD.cell, 0, this.nx - 1.001);
    const fz = clamp((z - WORLD.minZ) / WORLD.cell, 0, this.nz - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const hgt = this.heights;
    const a = hgt[j * this.nx + i];
    const b = hgt[j * this.nx + i + 1];
    const c = hgt[(j + 1) * this.nx + i];
    const d = hgt[(j + 1) * this.nx + i + 1];
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }

  /** 화면에서 누른 광선이 땅과 만나는 점 */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist = 220): THREE.Vector3 | null {
    let prevT = 0;
    let prevAbove = origin.y - this.groundY(origin.x, origin.z);
    if (prevAbove < 0) return null;
    const step = 0.6;
    for (let t = step; t < maxDist; t += step) {
      const x = origin.x + dir.x * t;
      const y = origin.y + dir.y * t;
      const z = origin.z + dir.z * t;
      if (x < WORLD.minX || x > WORLD.maxX || z < WORLD.minZ || z > WORLD.maxZ) {
        if (dir.y >= 0) return null;
      }
      const above = y - this.groundY(x, z);
      if (above <= 0) {
        // 두 표본 사이를 이분법으로 좁힘
        let lo = prevT;
        let hi = t;
        for (let k = 0; k < 8; k++) {
          const mid = (lo + hi) / 2;
          const my = origin.y + dir.y * mid - this.groundY(origin.x + dir.x * mid, origin.z + dir.z * mid);
          if (my > 0) lo = mid;
          else hi = mid;
        }
        const tt = (lo + hi) / 2;
        return new THREE.Vector3(origin.x + dir.x * tt, origin.y + dir.y * tt, origin.z + dir.z * tt);
      }
      prevT = t;
      prevAbove = above;
    }
    return null;
  }

  /** 길(땅 위) 가장자리까지의 거리: 색을 섞거나 나무를 피할 때 사용 */
  static pathDistance(x: number, z: number): number {
    let best = 999;
    for (const e of NAV_EDGES) {
      if (e.kind === 'elevator') continue;
      const a = NODE.get(e.a)!;
      const b = NODE.get(e.b)!;
      if (a.level !== 0) continue;
      const c = closestOnSegment(x, z, a.x, a.z, b.x, b.z);
      const d = c.d - e.w;
      if (d < best) best = d;
    }
    return best;
  }

  buildMesh(): THREE.Mesh {
    const { nx, nz } = this;
    const S = this.season;
    const pos = new Float32Array(nx * nz * 3);
    const col = new Float32Array(nx * nz * 3);
    const cLawn = new THREE.Color(S.grassLawn);
    const cWild = new THREE.Color(S.grassWild);
    const cFloor = new THREE.Color(S.forestFloor);
    const cDirt = new THREE.Color(S.dirt);
    const cBank = new THREE.Color(0x6f6a5a);
    const cBed = new THREE.Color(0x39443f);
    const cLeaf = new THREE.Color(0xa8662e);
    const tmp = new THREE.Color();

    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = WORLD.minX + i * WORLD.cell;
        const z = WORLD.minZ + j * WORLD.cell;
        pos[k * 3] = x;
        pos[k * 3 + 1] = this.heights[k];
        pos[k * 3 + 2] = z;

        // 기본: 들풀. 단지 바깥으로 갈수록 숲 바닥(낙엽 흙)
        const campus =
          smoothstep(-58, -46, x) * (1 - smoothstep(24, 60, x)) * smoothstep(-70, -34, z) * (1 - smoothstep(58, 70, z));
        const patch = fbm(x * 0.08, z * 0.08);
        tmp.copy(cWild).lerp(cFloor, clamp(1 - campus * 0.85 + (patch - 0.5) * 0.5, 0, 1) * 0.8);

        // 잔디밭: 광장, 나래마을 경사지, 새솔관 앞
        let lawn = 1 - smoothstep(PLAZA.radius - 1.5, PLAZA.radius + 2, Math.hypot(x - PLAZA.x, z - PLAZA.z));
        for (const c of CLEARINGS) {
          if (c.density > 0 && c.density < 0.3) {
            lawn = Math.max(lawn, 1 - smoothstep(c.r - 5, c.r + 1, Math.hypot(x - c.x, z - c.z)));
          }
        }
        tmp.lerp(cLawn, lawn * 0.92);

        // 낙엽이 쌓인 얼룩
        const leafPatch = smoothstep(0.56, 0.74, noise2(x * 0.17 + 40, z * 0.17 + 7));
        tmp.lerp(cLeaf, leafPatch * (0.34 - lawn * 0.2));

        // 길 가장자리는 흙빛으로 번지게
        const pd = Terrain.pathDistance(x, z);
        if (pd < 2.2 && lawn < 0.5) tmp.lerp(cDirt, (1 - smoothstep(-0.5, 2.2, pd)) * 0.75);

        // 개울가 자갈과 물 아래 바닥
        const sd = this.streamDistance(x, z);
        if (sd < 5.2) {
          tmp.lerp(cBank, 1 - smoothstep(1.8, 5.2, sd));
          tmp.lerp(cBed, 1 - smoothstep(0.6, 2.4, sd));
        }

        const shade = 0.9 + noise2(x * 0.31, z * 0.31) * 0.2;
        col[k * 3] = tmp.r * shade;
        col[k * 3 + 1] = tmp.g * shade;
        col[k * 3 + 2] = tmp.b * shade;
      }
    }

    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let q = 0;
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        idx[q++] = a;
        idx[q++] = c;
        idx[q++] = b;
        idx[q++] = b;
        idx[q++] = c;
        idx[q++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';
    return this.mesh;
  }

  /** 흙길 리본: 지형 위에 살짝 떠 있는 길 */
  buildPaths(): THREE.Mesh {
    const S = this.season;
    const positions: number[] = [];
    const colors: number[] = [];
    const base = new THREE.Color(S.dirt);
    const c = new THREE.Color();
    const LIFT = 0.05;

    const colorAt = (x: number, z: number, edge: number): void => {
      const n = noise2(x * 0.9, z * 0.9) * 0.16 + noise2(x * 0.23, z * 0.23) * 0.14;
      c.copy(base).multiplyScalar(0.86 + n - edge * 0.12);
      colors.push(c.r, c.g, c.b);
    };
    const vert = (x: number, z: number, edge: number): void => {
      positions.push(x, this.groundY(x, z) + LIFT, z);
      colorAt(x, z, edge);
    };
    const quad = (
      a: [number, number, number],
      b: [number, number, number],
      c2: [number, number, number],
      d: [number, number, number],
    ): void => {
      // a-b: 앞줄(왼→오), c-d: 뒷줄
      vert(a[0], a[1], a[2]);
      vert(c2[0], c2[1], c2[2]);
      vert(b[0], b[1], b[2]);
      vert(b[0], b[1], b[2]);
      vert(c2[0], c2[1], c2[2]);
      vert(d[0], d[1], d[2]);
    };

    const discDone = new Set<string>();
    const disc = (id: string, r: number): void => {
      if (discDone.has(id)) return;
      discDone.add(id);
      const nd = NODE.get(id)!;
      const seg = 16;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2;
        const a1 = ((i + 1) / seg) * Math.PI * 2;
        vert(nd.x, nd.z, 0);
        vert(nd.x + Math.sin(a1) * r, nd.z + Math.cos(a1) * r, 1);
        vert(nd.x + Math.sin(a0) * r, nd.z + Math.cos(a0) * r, 1);
      }
    };

    for (const e of NAV_EDGES) {
      if (e.hidden || e.kind === 'elevator') continue;
      const a = NODE.get(e.a)!;
      const b = NODE.get(e.b)!;
      if (a.level !== 0) continue;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const dx = (b.x - a.x) / len;
      const dz = (b.z - a.z) / len;
      const px = -dz;
      const pz = dx;
      const w = e.w * 0.92;
      const steps = Math.max(1, Math.ceil(len / 1.0));
      const offs = [-1, -0.5, 0, 0.5, 1];
      for (let s = 0; s < steps; s++) {
        const t0 = (s / steps) * len;
        const t1 = ((s + 1) / steps) * len;
        for (let k = 0; k < offs.length - 1; k++) {
          const o0 = offs[k] * w;
          const o1 = offs[k + 1] * w;
          const e0 = Math.abs(offs[k]) === 1 ? 1 : 0;
          const e1 = Math.abs(offs[k + 1]) === 1 ? 1 : 0;
          quad(
            [a.x + dx * t0 + px * o0, a.z + dz * t0 + pz * o0, e0],
            [a.x + dx * t0 + px * o1, a.z + dz * t0 + pz * o1, e1],
            [a.x + dx * t1 + px * o0, a.z + dz * t1 + pz * o0, e0],
            [a.x + dx * t1 + px * o1, a.z + dz * t1 + pz * o1, e1],
          );
        }
      }
      disc(e.a, w);
      disc(e.b, w);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'paths';
    return mesh;
  }

  /** 개울 물 */
  buildStream(): THREE.Mesh {
    const pts = this.streamPts;
    const positions: number[] = [];
    const uvs: number[] = [];
    let dist = 0;
    const rows: Array<{ l: THREE.Vector3; r: THREE.Vector3; v: number }> = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[Math.min(i + 1, pts.length - 1)];
      const o = pts[Math.max(i - 1, 0)];
      let dx = q[0] - o[0];
      let dz = q[1] - o[1];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      if (i > 0) dist += Math.hypot(p[0] - o[0], p[1] - o[1]);
      const y = this.groundY(p[0], p[1]) + 0.36;
      const hw = STREAM_HALF_WIDTH + 0.5;
      rows.push({
        l: new THREE.Vector3(p[0] + dz * hw, y, p[1] - dx * hw),
        r: new THREE.Vector3(p[0] - dz * hw, y, p[1] + dx * hw),
        v: dist,
      });
    }
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i];
      const b = rows[i + 1];
      const push = (p: THREE.Vector3, u: number, v: number): void => {
        positions.push(p.x, p.y, p.z);
        uvs.push(u, v);
      };
      push(a.l, 0, a.v);
      push(b.l, 0, b.v);
      push(a.r, 1, a.v);
      push(a.r, 1, a.v);
      push(b.l, 0, b.v);
      push(b.r, 1, b.v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(0x1f3d4a) },
          uShallow: { value: new THREE.Color(0x35606a) },
          uGlint: { value: new THREE.Color(0xffc68a) },
        },
      ]),
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform float uTime;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uGlint;
        varying vec2 vUv;
        void main() {
          float v = vUv.y * 0.42 + uTime * 0.16;
          float n1 = sin(v * 6.2831 + sin(vUv.x * 5.0 + uTime * 0.5) * 1.3) * 0.5 + 0.5;
          float n2 = sin((vUv.y * 1.1 + uTime * 0.31) * 6.2831 + vUv.x * 8.0) * 0.5 + 0.5;
          float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
          vec3 col = mix(uDeep, uShallow, n1 * 0.55);
          col += uGlint * pow(n1 * n2, 3.0) * 0.32;
          gl_FragColor = vec4(col, 0.86 * edge);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      fog: true,
      side: THREE.DoubleSide,
    });
    this.waterMaterial = mat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'stream';
    mesh.renderOrder = 2;
    return mesh;
  }
}

/** 노드 조회용 */
export const NODE = new Map(NAV_NODES.map((n) => [n.id, n]));
