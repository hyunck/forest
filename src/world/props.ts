import * as THREE from 'three';
import { Batcher, trs } from './batch';
import { makeRng } from '../core/util';
import {
  DECK_PLATFORM,
  LAMPS,
  NAV_EDGES,
  SEATS,
  SIGNS,
  WOODPILES,
  type SeatDef,
} from '../scenes/daejeon/layout';
import { NODE, Terrain } from './terrain';
import type { SeasonPalette } from '../scenes/seasons';
import { COPY } from '../data/copy';

const WOOD = 0xb98a58;
const WOOD_DARK = 0x8c6540;
const WOOD_DEEP = 0x5e432c;
const DECK = 0xa67c52;
const DECK_LINE = 0x7d5a3a;
const METAL = 0x2f3230;
const STONE = 0x8a8578;
const ROCK = 0x77746a;

export interface SeatRT {
  def: SeatDef;
  /** 엉덩이가 놓이는 위치 */
  pos: THREE.Vector3;
  yaw: number;
  occupied: boolean;
}

export interface DeckTri {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
}

const SEAT_HEIGHT: Record<string, number> = { bench: 0.47, platform: 0.44, rock: 0.5, log: 0.5 };

function bench(b: Batcher): void {
  // 로컬: 앉는 방향이 +z
  b.rbox(1.75, 0.08, 0.52, WOOD, 0, 0.44, 0.02, 0, 0.03);
  b.box(1.75, 0.02, 0.02, WOOD_DARK, 0, 0.485, -0.1);
  b.box(1.75, 0.02, 0.02, WOOD_DARK, 0, 0.485, 0.14);
  b.rbox(1.75, 0.16, 0.05, WOOD, 0, 0.72, -0.27, 0, 0.02, 'matte', -0.16);
  b.rbox(1.75, 0.16, 0.05, WOOD, 0, 0.93, -0.3, 0, 0.02, 'matte', -0.16);
  for (const s of [-0.72, 0.72]) {
    b.rbox(0.07, 0.44, 0.46, METAL, s, 0.22, 0.02, 0, 0.02);
    b.rbox(0.07, 0.62, 0.07, METAL, s, 0.72, -0.28, 0, 0.02, 'matte', -0.16);
    b.rbox(0.07, 0.05, 0.5, METAL, s, 0.62, 0.0, 0, 0.02);
  }
}

function platformSeat(b: Batcher): void {
  // 낮은 목재 평상
  b.rbox(2.4, 0.12, 2.4, WOOD, 0, 0.38, 0, 0, 0.04);
  for (let i = -3; i <= 3; i++) b.box(0.025, 0.02, 2.36, WOOD_DARK, i * 0.34, 0.445, 0);
  b.rbox(2.3, 0.14, 2.3, WOOD_DEEP, 0, 0.25, 0, 0, 0.03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rbox(0.16, 0.32, 0.16, WOOD_DEEP, sx * 1.02, 0.16, sz * 1.02, 0, 0.03);
}

function rockSeat(b: Batcher, seed: number): void {
  const r = makeRng(seed);
  const g = new THREE.IcosahedronGeometry(0.85, 1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const k = 0.9 + r() * 0.2;
    p.setXYZ(i, p.getX(i) * k * 1.15, Math.min(p.getY(i) * 0.62, 0.34), p.getZ(i) * k);
  }
  b.add(g, ROCK, trs(0, 0.16, 0, r() * 3), 'matte', true);
  b.sphere(0.34, 0x6b685f, 0.95, 0.1, 0.3, 'matte', 0.7, 0);
}

function logSeat(b: Batcher): void {
  b.cyl(0.27, 0.29, 1.9, WOOD_DARK, 0, 0.3, 0, 9, 'matte', 0, Math.PI / 2);
  b.cyl(0.2, 0.2, 1.92, 0xd8b98a, 0, 0.3, 0, 9, 'matte', 0, Math.PI / 2);
  b.rbox(1.5, 0.06, 0.34, WOOD, 0, 0.5, 0, 0, 0.02);
  for (const s of [-0.6, 0.6]) b.cyl(0.14, 0.16, 0.5, WOOD_DEEP, s, 0.06, 0, 7, 'matte', Math.PI / 2);
}

export function buildSeats(b: Batcher, heightAt: (x: number, z: number, level: 0 | 1) => number): SeatRT[] {
  const seats: SeatRT[] = [];
  SEATS.forEach((def, i) => {
    const y = heightAt(def.x, def.z, def.level);
    const yaw = Math.atan2(def.look[0] - def.x, def.look[1] - def.z);
    if (!def.noProp) {
      b.push(trs(def.x, y, def.z, yaw));
      if (def.type === 'bench') bench(b);
      else if (def.type === 'platform') {
        b.pop();
        // 평상은 두 자리의 가운데에 놓음
        b.push(trs(def.x + 0.3, y, def.z + 0.8, 0.35));
        platformSeat(b);
      } else if (def.type === 'rock') rockSeat(b, 900 + i);
      else logSeat(b);
      b.pop();
    }
    seats.push({
      def,
      pos: new THREE.Vector3(def.x, y + SEAT_HEIGHT[def.type], def.z),
      yaw,
      occupied: false,
    });
  });
  return seats;
}

/** 정원등. 불빛 머리 위치를 돌려줌(빛 번짐 표현용) */
export function buildLamps(
  b: Batcher,
  heightAt: (x: number, z: number, level: 0 | 1) => number,
  season: SeasonPalette,
): THREE.Vector3[] {
  const heads: THREE.Vector3[] = [];
  for (const l of LAMPS) {
    const y = l.y !== undefined ? l.y : heightAt(l.x, l.z, 0);
    b.push(trs(l.x, y, l.z));
    if (l.kind === 'tall') {
      b.cyl(0.11, 0.14, 0.24, METAL, 0, 0.12, 0, 8);
      b.cyl(0.045, 0.055, 2.5, METAL, 0, 1.4, 0, 6);
      b.rbox(0.36, 0.05, 0.36, METAL, 0, 2.66, 0, 0, 0.02);
      b.rbox(0.26, 0.36, 0.26, season.lamp, 0, 2.87, 0, 0, 0.04, 'glow');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.03, 0.38, 0.03, METAL, sx * 0.14, 2.87, sz * 0.14);
      b.add(new THREE.ConeGeometry(0.3, 0.2, 4), METAL, trs(0, 3.16, 0, Math.PI / 4));
      heads.push(new THREE.Vector3(l.x, y + 2.87, l.z));
    } else {
      b.rbox(0.17, 0.62, 0.17, WOOD_DEEP, 0, 0.31, 0, 0, 0.03);
      b.rbox(0.19, 0.15, 0.19, season.lamp, 0, 0.7, 0, 0, 0.03, 'glow');
      b.rbox(0.24, 0.06, 0.24, METAL, 0, 0.81, 0, 0, 0.02);
      heads.push(new THREE.Vector3(l.x, y + 0.7, l.z));
    }
    b.pop();
  }
  return heads;
}

/** 정원등 둘레의 은은한 빛 번짐 */
export function buildLampGlow(heads: THREE.Vector3[], season: SeasonPalette): THREE.Points {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.32)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(heads.length * 3);
  heads.forEach((p, i) => arr.set([p.x, p.y, p.z], i * 3));
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({
    map: tex,
    color: season.lamp,
    size: 2.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'lamp-glow';
  pts.frustumCulled = false;
  return pts;
}

export interface SignRT {
  id: string;
  pos: THREE.Vector3;
}

function signTexture(text: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 384;
  cv.height = 192;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#e9dcc0';
  g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = '#6f5237';
  g.lineWidth = 8;
  g.strokeRect(10, 10, cv.width - 20, cv.height - 20);
  g.fillStyle = '#3f2f20';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 78;
  g.font = `700 ${size}px "Pretendard Variable", Pretendard, sans-serif`;
  while (g.measureText(text).width > cv.width - 56 && size > 30) {
    size -= 4;
    g.font = `700 ${size}px "Pretendard Variable", Pretendard, sans-serif`;
  }
  g.fillText(text, cv.width / 2, cv.height / 2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 나무 표찰 */
export function buildSigns(
  b: Batcher,
  heightAt: (x: number, z: number, level: 0 | 1) => number,
): { signs: SignRT[]; group: THREE.Group } {
  const group = new THREE.Group();
  const signs: SignRT[] = [];
  for (const s of SIGNS) {
    const y = heightAt(s.x, s.z, s.level);
    const yaw = Math.atan2(s.look[0] - s.x, s.look[1] - s.z);
    b.push(trs(s.x, y, s.z, yaw));
    b.rbox(0.09, 1.0, 0.09, WOOD_DEEP, 0, 0.5, 0, 0, 0.02);
    b.rbox(0.78, 0.46, 0.06, WOOD_DARK, 0, 1.0, 0.04, 0, 0.02, 'matte', -0.22);
    b.pop();
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.35),
      new THREE.MeshStandardMaterial({
        map: signTexture(COPY.signs[s.id].name),
        roughness: 0.9,
        emissive: 0xffffff,
        emissiveIntensity: 0.12,
      }),
    );
    (plate.material as THREE.MeshStandardMaterial).emissiveMap = (plate.material as THREE.MeshStandardMaterial).map;
    plate.position.set(0, 1.0, 0.04);
    plate.rotation.x = -0.22;
    plate.translateZ(0.036);
    const holder = new THREE.Group();
    holder.position.set(s.x, y, s.z);
    holder.rotation.y = yaw;
    holder.add(plate);
    group.add(holder);
    signs.push({ id: s.id, pos: new THREE.Vector3(s.x, y + 1.0, s.z) });
  }
  return { signs, group };
}

export function buildWoodpiles(b: Batcher, groundY: (x: number, z: number) => number): void {
  for (const w of WOODPILES) {
    b.push(trs(w.x, groundY(w.x, w.z), w.z, w.rot));
    b.box(0.1, 1.0, 0.1, WOOD_DEEP, -0.85, 0.5, 0);
    b.box(0.1, 1.0, 0.1, WOOD_DEEP, 0.85, 0.5, 0);
    b.box(1.9, 0.08, 0.7, WOOD_DEEP, 0, 0.05, 0);
    const rows = [5, 4, 5, 4];
    rows.forEach((n, r) => {
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 0.31;
        const y = 0.24 + r * 0.26;
        const c = (i + r) % 3 === 0 ? 0x9a7148 : (i + r) % 3 === 1 ? 0x86603c : 0xa98258;
        b.cyl(0.145, 0.145, 0.86, c, x, y, 0, 7, 'matte', Math.PI / 2);
        b.cyl(0.11, 0.11, 0.875, 0xdcc096, x, y, 0, 7, 'matte', Math.PI / 2);
      }
    });
    b.pop();
  }
}

/** 개울가 돌 */
export function buildStreamRocks(b: Batcher, terrain: Terrain): void {
  const r = makeRng(77);
  const pts = terrain.streamPts;
  for (let i = 4; i < pts.length - 4; i++) {
    const [x, z] = pts[i];
    if (z < -85 || z > 70) continue;
    const n = z > -70 && z < -25 ? 3 : 1;
    for (let k = 0; k < n; k++) {
      if (r() < 0.25) continue;
      const side = r() < 0.5 ? -1 : 1;
      const off = 1.2 + r() * 2.4;
      const px = x + side * off + (r() - 0.5);
      const pz = z + (r() - 0.5) * 2;
      const s = 0.25 + r() * 0.55;
      const g = new THREE.IcosahedronGeometry(s, 0);
      b.add(g, r() < 0.5 ? ROCK : 0x8c897e, trs(px, terrain.groundY(px, pz) + s * 0.2, pz, r() * 6, 1.2, 0.62, 1), 'matte', true);
    }
  }
}

/** 데크길이 꺾이는 참의 반지름. d3는 데크로드 중간의 넓은 쉼터 */
function landingTrim(id: string): number {
  if (id === 'el1') return 0;
  if (id === 'dj') return 0.9;
  if (id === 'd3') return 2.75;
  return 1.62;
}

/**
 * 데크로드(지그재그 원목 데크길)와 관망데크.
 * 화면에서 누른 지점을 찾기 위한 바닥 삼각형도 함께 돌려줍니다.
 */
export function buildDecks(b: Batcher, groundY: (x: number, z: number) => number): DeckTri[] {
  const tris: DeckTri[] = [];
  const quadTris = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): void => {
    tris.push({ a: p0, b: p1, c: p2 }, { a: p0, b: p2, c: p3 });
  };

  const discDone = new Set<string>();
  for (const e of NAV_EDGES) {
    const a = NODE.get(e.a)!;
    const c = NODE.get(e.b)!;
    if (a.level !== 1 || e.kind === 'elevator' || e.hidden) continue;
    const ay = a.y || 0;
    const cy = c.y || 0;
    const dx = c.x - a.x;
    const dz = c.z - a.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const px = -uz;
    const pz = ux;
    const ry = Math.atan2(-dz, dx);
    const rz = Math.atan2(cy - ay, len);
    const full = Math.hypot(len, cy - ay);
    const W = e.w + 0.25;
    const mx = (a.x + c.x) / 2;
    const mz = (a.z + c.z) / 2;
    const my = (ay + cy) / 2;

    b.push(trs(mx, my, mz, ry, 1, 1, 1, 0, rz));
    // 바닥 판재와 결
    b.box(full + 0.2, 0.14, W * 2, DECK, 0, -0.07, 0);
    for (let x = -full / 2 + 0.3; x < full / 2; x += 0.62) b.box(0.035, 0.02, W * 2 - 0.1, DECK_LINE, x, 0.006, 0);
    // 아래 장선
    b.box(full, 0.2, 0.16, WOOD_DEEP, 0, -0.24, W - 0.25);
    b.box(full, 0.2, 0.16, WOOD_DEEP, 0, -0.24, -W + 0.25);
    // 난간 (꺾이는 참에서는 둥근 난간으로 이어지도록 양 끝을 비움)
    const x0 = -full / 2 + landingTrim(a.id);
    const x1 = full / 2 - landingTrim(c.id);
    const rl = x1 - x0;
    for (const s of [-1, 1]) {
      b.rbox(rl, 0.09, 0.11, WOOD_DARK, (x0 + x1) / 2, 1.02, s * (W - 0.07), 0, 0.03);
      b.box(rl, 0.05, 0.05, WOOD_DARK, (x0 + x1) / 2, 0.56, s * (W - 0.07));
      const n = Math.max(2, Math.round(rl / 1.9));
      for (let i = 0; i <= n; i++) {
        const x = x0 + (rl / n) * i;
        b.box(0.1, 1.04, 0.1, WOOD_DEEP, x, 0.5, s * (W - 0.07));
      }
    }
    b.pop();

    // 받침 기둥(땅까지)
    const posts = Math.max(1, Math.round(len / 3.6));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const cx = a.x + dx * t;
      const cz = a.z + dz * t;
      const y = ay + (cy - ay) * t - 0.3;
      for (const s of [-1, 1]) {
        const x = cx + px * s * (W - 0.3);
        const z = cz + pz * s * (W - 0.3);
        const gy = groundY(x, z) - 0.6;
        if (y - gy > 0.3) b.box(0.2, y - gy, 0.2, WOOD_DEEP, x, (y + gy) / 2, z, ry);
      }
      const gyc = groundY(cx, cz);
      if (y - gyc > 2.2) b.box(0.12, 0.12, W * 2 - 0.5, WOOD_DEEP, cx, y - 0.9, cz, ry);
    }

    // 꺾이는 곳의 둥근 참과 둥근 난간
    for (const nd of [a, c]) {
      if (discDone.has(nd.id)) continue;
      discDone.add(nd.id);
      const r = landingTrim(nd.id);
      if (r < 1) continue;
      const ny = nd.y || 0;
      const gy = groundY(nd.x, nd.z);
      b.cyl(r, r, 0.14, DECK, nd.x, ny - 0.071, nd.z, r > 2 ? 22 : 16);
      b.cyl(r - 0.2, r - 0.2, 0.2, WOOD_DEEP, nd.x, ny - 0.24, nd.z, 12);
      b.cyl(0.18, 0.18, Math.max(0.4, ny - gy + 0.4), WOOD_DEEP, nd.x, (ny + gy - 0.6) / 2, nd.z, 7);
      if (r > 2) {
        // 넓은 쉼터 참은 받침 기둥을 더 둠
        for (let i = 0; i < 4; i++) {
          const an = (i / 4) * Math.PI * 2 + 0.6;
          const px2 = nd.x + Math.sin(an) * (r - 0.5);
          const pz2 = nd.z + Math.cos(an) * (r - 0.5);
          const g2 = groundY(px2, pz2) - 0.6;
          if (ny - g2 > 0.5) b.box(0.2, ny - 0.3 - g2, 0.2, WOOD_DEEP, px2, (ny - 0.3 + g2) / 2, pz2);
        }
        quadTris(
          new THREE.Vector3(nd.x - r, ny, nd.z - r),
          new THREE.Vector3(nd.x - r, ny, nd.z + r),
          new THREE.Vector3(nd.x + r, ny, nd.z + r),
          new THREE.Vector3(nd.x + r, ny, nd.z - r),
        );
      }
      // 이 참에 닿는 데크길의 방향들
      const dirs: number[] = [];
      for (const e2 of NAV_EDGES) {
        if (e2.kind === 'elevator') continue;
        const other = e2.a === nd.id ? NODE.get(e2.b)! : e2.b === nd.id ? NODE.get(e2.a)! : null;
        if (!other || other.level !== 1 || e2.hidden) continue;
        dirs.push(Math.atan2(other.x - nd.x, other.z - nd.z));
      }
      const gapHalf = Math.asin(Math.min(1, (W + 0.02) / r)) + 0.12;
      const N = r > 2 ? 22 : 14;
      const keep: boolean[] = [];
      for (let i = 0; i < N; i++) {
        const an = (i / N) * Math.PI * 2;
        keep.push(
          !dirs.some((d) => {
            let df = (an - d) % (Math.PI * 2);
            if (df > Math.PI) df -= Math.PI * 2;
            if (df < -Math.PI) df += Math.PI * 2;
            return Math.abs(df) < gapHalf;
          }),
        );
      }
      const rr = r - 0.07;
      for (let i = 0; i < N; i++) {
        if (!keep[i]) continue;
        const an = (i / N) * Math.PI * 2;
        const qx = nd.x + Math.sin(an) * rr;
        const qz = nd.z + Math.cos(an) * rr;
        b.box(0.1, 1.04, 0.1, WOOD_DEEP, qx, ny + 0.5, qz, an);
        const j = (i + 1) % N;
        if (keep[j]) {
          const an2 = (j / N) * Math.PI * 2;
          const ex = nd.x + Math.sin(an2) * rr;
          const ez = nd.z + Math.cos(an2) * rr;
          const segLen = Math.hypot(ex - qx, ez - qz);
          const ryy = Math.atan2(-(ez - qz), ex - qx);
          b.rbox(segLen + 0.06, 0.09, 0.11, WOOD_DARK, (qx + ex) / 2, ny + 1.02, (qz + ez) / 2, ryy, 0.03);
          b.box(segLen, 0.05, 0.05, WOOD_DARK, (qx + ex) / 2, ny + 0.56, (qz + ez) / 2, ryy);
        }
      }
    }

    const A0 = new THREE.Vector3(a.x + px * W, ay, a.z + pz * W);
    const A1 = new THREE.Vector3(a.x - px * W, ay, a.z - pz * W);
    const C0 = new THREE.Vector3(c.x + px * W, cy, c.z + pz * W);
    const C1 = new THREE.Vector3(c.x - px * W, cy, c.z - pz * W);
    quadTris(A0, C0, C1, A1);
  }

  // 관망데크: 넓은 원목 데크와 낮은 난간
  const P = DECK_PLATFORM;
  const cx = (P.minX + P.maxX) / 2;
  const cz = (P.minZ + P.maxZ) / 2;
  const w = P.maxX - P.minX;
  const d = P.maxZ - P.minZ;
  b.rbox(w, 0.16, d, DECK, cx, P.y - 0.08, cz, 0, 0.04);
  for (let z = P.minZ + 0.4; z < P.maxZ; z += 0.62) b.box(w - 0.1, 0.02, 0.035, DECK_LINE, cx, P.y + 0.006, z);
  b.box(w + 0.1, 0.3, 0.2, WOOD_DEEP, cx, P.y - 0.3, P.minZ + 0.1);
  b.box(w + 0.1, 0.3, 0.2, WOOD_DEEP, cx, P.y - 0.3, P.maxZ - 0.1);
  b.box(0.2, 0.3, d + 0.1, WOOD_DEEP, P.minX + 0.1, P.y - 0.3, cz);
  b.box(0.2, 0.3, d + 0.1, WOOD_DEEP, P.maxX - 0.1, P.y - 0.3, cz);
  // 받침 기둥
  for (let x = P.minX + 0.4; x <= P.maxX; x += (w - 0.8) / 3) {
    for (let z = P.minZ + 0.4; z <= P.maxZ; z += (d - 0.8) / 3) {
      const gy = groundY(x, z) - 0.8;
      if (P.y - gy > 0.5) b.box(0.26, P.y - 0.2 - gy, 0.26, WOOD_DEEP, x, (P.y - 0.2 + gy) / 2, z);
    }
  }
  // 낮은 난간 (남쪽의 데크로드 입구만 비움)
  const railH = 0.92;
  const rail = (x0: number, z0: number, x1: number, z1: number): void => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ry = Math.atan2(-(z1 - z0), x1 - x0);
    b.push(trs((x0 + x1) / 2, P.y, (z0 + z1) / 2, ry));
    b.rbox(len, 0.1, 0.13, WOOD_DARK, 0, railH, 0, 0, 0.03);
    b.box(len, 0.05, 0.05, WOOD_DARK, 0, railH * 0.52, 0);
    const n = Math.max(1, Math.round(len / 1.7));
    for (let i = 0; i <= n; i++) b.box(0.11, railH + 0.02, 0.11, WOOD_DEEP, -len / 2 + (len / n) * i, railH / 2, 0);
    b.pop();
  };
  const m = 0.1;
  rail(P.minX + m, P.minZ + m, P.maxX - m, P.minZ + m);
  rail(P.minX + m, P.minZ + m, P.minX + m, P.maxZ - m);
  rail(P.maxX - m, P.minZ + m, P.maxX - m, P.maxZ - m);
  rail(P.minX + m, P.maxZ - m, 58.1, P.maxZ - m);
  rail(62.0, P.maxZ - m, P.maxX - m, P.maxZ - m);
  // 데크 위 화분과 작은 탁자
  b.rbox(0.7, 0.5, 0.7, WOOD_DEEP, P.maxX - 0.9, P.y + 0.25, P.maxZ - 0.9, 0, 0.05);
  b.sphere(0.5, 0x6f7a3e, P.maxX - 0.9, P.y + 0.75, P.maxZ - 0.9, 'matte', 0.8, 1);
  b.rbox(0.7, 0.5, 0.7, WOOD_DEEP, P.maxX - 0.9, P.y + 0.25, P.minZ + 2.4, 0, 0.05);
  b.sphere(0.5, 0xb5642e, P.maxX - 0.9, P.y + 0.75, P.minZ + 2.4, 'matte', 0.8, 1);
  b.cyl(0.5, 0.5, 0.06, 0xb98a58, 62.6, P.y + 0.5, -4.6, 12);
  b.cyl(0.07, 0.1, 0.5, WOOD_DEEP, 62.6, P.y + 0.25, -4.6, 7);

  quadTris(
    new THREE.Vector3(P.minX, P.y, P.minZ),
    new THREE.Vector3(P.minX, P.y, P.maxZ),
    new THREE.Vector3(P.maxX, P.y, P.maxZ),
    new THREE.Vector3(P.maxX, P.y, P.minZ),
  );
  return tris;
}

/** 길가 낮은 통나무 울타리와 돌 테두리 같은 잔소품 */
export function buildSmallProps(b: Batcher, groundY: (x: number, z: number) => number): void {
  const r = makeRng(4242);
  // 광장 둘레 돌 테두리
  const R = 15.4;
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const x = 2 + Math.sin(a) * R;
    const z = 3 + Math.cos(a) * R;
    if (Terrain.pathDistance(x, z) < 0.6 && !(Math.hypot(x - 2, z - 3) < R - 1)) {
      // 길이 지나는 곳은 비움
      const onVisiblePath =
        Math.hypot(x - 0, z - 18.4) < 3 || Math.hypot(x - 16.6, z - 9.6) < 3.2 || Math.hypot(x + 9.6, z + 9.8) < 3.2;
      if (onVisiblePath) continue;
    }
    if (Math.hypot(x - 0, z - 18.4) < 2.8 || Math.hypot(x - 16.9, z - 9.9) < 2.8 || Math.hypot(x + 9.3, z + 10.2) < 2.8) continue;
    const s = 0.2 + r() * 0.16;
    b.add(new THREE.IcosahedronGeometry(s, 0), r() < 0.5 ? STONE : 0x9a958a, trs(x, groundY(x, z) + s * 0.25, z, r() * 6, 1.3, 0.7, 1), 'matte', true);
  }
  // 입구 길가 낮은 통나무 말뚝
  for (let z = 58; z > 46.5; z -= 1.9) {
    for (const s of [-1, 1]) {
      const x = -4 + s * 2.75;
      const hgt = 0.34 + r() * 0.12;
      b.cyl(0.11, 0.12, hgt, 0x7a5a3c, x, groundY(x, z) + hgt / 2, z, 7);
    }
  }
  // 골짜기숲길 물가 쪽 낮은 밧줄 울타리 말뚝
  for (const [x, z] of [
    [-38.2, -33.6], [-39.6, -35.2], [-41.9, -39.0], [-42.4, -43.6], [-41.8, -47.5], [-41.6, -49.6], [-41.4, -53.4],
  ] as Array<[number, number]>) {
    b.cyl(0.07, 0.08, 0.7, 0x6e5237, x, groundY(x, z) + 0.35, z, 6);
  }
  // 건물 앞 화단 상자
  const planters: Array<[number, number, number]> = [
    [-13.6, 18.5, 0], [-13.6, 31.5, 0], [-19.4, -9.6, 1.57], [-6.5, -20.2, 1.57], [3.0, -20.2, 1.57],
  ];
  for (const [x, z, rot] of planters) {
    const y = groundY(x, z);
    b.rbox(0.8, 0.5, 2.2, 0x6e5237, x, y + 0.25, z, rot, 0.05);
    b.sphere(0.46, 0x7a6a34, x + (rot ? -0.5 : 0), y + 0.66, z + (rot ? 0 : -0.5), 'matte', 0.75, 1);
    b.sphere(0.5, 0xa0622e, x, y + 0.7, z, 'matte', 0.75, 1);
    b.sphere(0.44, 0x5b6b3a, x + (rot ? 0.5 : 0), y + 0.64, z + (rot ? 0 : 0.5), 'matte', 0.75, 1);
  }
  // 안내센터 앞 안내판 틀(글자 없는 지도판)
  const sx = -9.6;
  const sz = 34.5;
  const sy = groundY(sx, sz);
  b.push(trs(sx, sy, sz, 1.05));
  b.rbox(0.14, 1.9, 0.14, WOOD_DEEP, -0.9, 0.95, 0, 0, 0.03);
  b.rbox(0.14, 1.9, 0.14, WOOD_DEEP, 0.9, 0.95, 0, 0, 0.03);
  b.rbox(1.9, 1.1, 0.08, 0x4b5a3d, 0, 1.3, 0, 0, 0.03);
  b.rbox(2.2, 0.1, 0.5, 0x45586c, 0, 2.0, 0, 0, 0.03);
  b.pop();
}
