import * as THREE from 'three';
import { Batcher, prismGeometry, trs } from './batch';
import { makeRng } from '../core/util';
import { BUILDINGS, CABINS, ELEVATOR, GATE, type BuildingDef } from '../scenes/daejeon/layout';
import type { SeasonPalette } from '../scenes/seasons';
import { COPY } from '../data/copy';

const WOOD = 0xcfa06a;
const WOOD_DARK = 0xa97c4c;
const WOOD_DEEP = 0x7a5636;
const ROOF = 0x55697f;
const ROOF_DARK = 0x45586c;
const STONE = 0x8a8578;
const FRAME = 0x3b3027;
const GLASS_DARK = 0x2c3b4c;

interface GabledOpts {
  /** 용마루 방향 길이 */
  L: number;
  /** 박공면 폭 */
  D: number;
  wallH: number;
  roofH: number;
  floors: number;
  /** 유리가 큰 박공면: -1 = -x 끝, 1 = +x 끝, 0 = 없음 */
  glassEnd: -1 | 0 | 1;
  seed: number;
  litRatio: number;
  season: SeasonPalette;
  porch?: boolean;
}

/**
 * 밝은 목재 외장 + 짙은 청회색 금속 박공지붕 건물.
 * 로컬 좌표: 용마루가 x축, 바닥 중심이 원점.
 */
function gabled(b: Batcher, o: GabledOpts): void {
  const { L, D, wallH, roofH, season } = o;
  const rnd = makeRng(o.seed);
  const lit = season.window;
  const base = 0.35;
  const top = base + wallH;

  // 기단(경사지에서도 틈이 보이지 않게 땅속까지)
  b.box(L + 0.5, 2.6, D + 0.5, STONE, 0, base - 1.3, 0);
  // 몸체
  b.rbox(L, wallH, D, WOOD, 0, base + wallH / 2, 0, 0, 0.08);
  // 지붕 속 삼각 박공
  b.add(prismGeometry(L - 0.02, D - 0.02, roofH), WOOD, trs(0, top, 0));

  // 세로 널(목재 외장의 결)
  const battenStep = 1.15;
  for (let x = -L / 2 + battenStep / 2; x < L / 2; x += battenStep) {
    b.box(0.07, wallH - 0.1, 0.05, WOOD_DARK, x, base + wallH / 2, D / 2 + 0.012);
    b.box(0.07, wallH - 0.1, 0.05, WOOD_DARK, x, base + wallH / 2, -D / 2 - 0.012);
  }
  // 층 사이 띠
  for (let f = 1; f < o.floors; f++) {
    const y = base + (wallH / o.floors) * f;
    b.box(L + 0.06, 0.16, D + 0.06, WOOD_DEEP, 0, y, 0);
  }
  b.box(L + 0.1, 0.2, D + 0.1, WOOD_DEEP, 0, top - 0.08, 0);

  // 지붕 판 2장 + 용마루
  const ov = 0.75;
  const ovL = 0.9;
  const ang = Math.atan2(roofH, D / 2);
  const slope = Math.hypot(D / 2, roofH) + ov;
  const mid = (slope / 2 - ov) / Math.hypot(D / 2, roofH); // 용마루에서 처마까지의 중간 지점(0..1 밖으로 처마가 나감)
  for (const side of [1, -1]) {
    const t = 1 - (slope / 2) / Math.hypot(D / 2, roofH);
    const zc = side * (D / 2) * (1 - t);
    const yc = top + roofH * t + 0.13;
    b.add(new THREE.BoxGeometry(L + ovL * 2, 0.2, slope), ROOF, trs(0, yc, zc, 0, 1, 1, 1, side * ang, 0));
    // 처마 끝 선
    const ze = side * (D / 2 + ov * Math.cos(ang));
    const ye = top - ov * Math.sin(ang) + 0.1;
    b.box(L + ovL * 2 + 0.04, 0.14, 0.16, ROOF_DARK, 0, ye, ze, 0, 'matte', side * ang);
  }
  void mid;
  b.box(L + ovL * 2 + 0.06, 0.2, 0.5, ROOF_DARK, 0, top + roofH + 0.2, 0);
  // 지붕 골(금속 지붕의 세로 줄)
  for (let x = -L / 2 - ovL + 0.6; x < L / 2 + ovL; x += 1.2) {
    for (const side of [1, -1]) {
      const t = 1 - (slope / 2) / Math.hypot(D / 2, roofH);
      const zc = side * (D / 2) * (1 - t);
      const yc = top + roofH * t + 0.26;
      b.add(new THREE.BoxGeometry(0.07, 0.07, slope - 0.1), ROOF_DARK, trs(x, yc, zc, 0, 1, 1, 1, side * ang, 0));
    }
  }

  // 긴 벽의 창 (일정한 배열)
  const floorH = wallH / o.floors;
  const cols = Math.max(2, Math.floor((L - 1.6) / 3.1));
  const gap = (L - 1.6) / cols;
  for (let f = 0; f < o.floors; f++) {
    const y = base + floorH * f + floorH * 0.55;
    const wh = Math.min(1.7, floorH * 0.5);
    for (let c = 0; c < cols; c++) {
      const x = -L / 2 + 0.8 + gap * (c + 0.5);
      for (const side of [1, -1]) {
        const z = side * (D / 2 + 0.03);
        const isLit = rnd() < o.litRatio;
        b.box(1.62, wh + 0.18, 0.1, FRAME, x, y, z);
        b.box(1.42, wh, 0.12, isLit ? lit : GLASS_DARK, x, y, z + side * 0.02, 0, isLit ? 'glow' : 'matte');
        b.box(0.07, wh, 0.14, FRAME, x, y, z + side * 0.02);
      }
    }
  }

  // 박공면
  for (const end of [-1, 1] as const) {
    const xf = end * (L / 2 + 0.03);
    if (o.glassEnd === end) {
      // 큰 유리 박공: 지붕 경사를 따라 높이가 달라지는 유리 기둥들
      const n = D > 9 ? 7 : D > 5 ? 5 : 3;
      const gw = (D * 0.8) / n;
      for (let i = 0; i < n; i++) {
        const u = -D * 0.4 + gw * (i + 0.5);
        const colTop = top + roofH * (1 - Math.abs(u) / (D / 2)) - 0.75;
        const bot = base + 0.25;
        const hgt = Math.max(1.2, colTop - bot);
        b.box(0.1, hgt + 0.16, gw + 0.02, FRAME, xf, bot + hgt / 2, u);
        // 층마다 나눠 일부만 불이 켜지게
        const parts = Math.max(1, Math.round(hgt / 2.6));
        for (let p = 0; p < parts; p++) {
          const ph = hgt / parts;
          const py = bot + ph * (p + 0.5);
          const isLit = rnd() < 0.82;
          b.box(0.12, ph - 0.14, gw - 0.16, isLit ? lit : GLASS_DARK, xf + end * 0.02, py, u, 0, isLit ? 'glow' : 'matte');
        }
      }
      // 출입문 위 처마
      b.box(1.5, 0.14, Math.min(D * 0.5, 4.2), ROOF_DARK, end * (L / 2 + 0.75), base + 2.75, 0);
    } else {
      const n = Math.max(1, Math.floor(D / 4));
      for (let f = 0; f < o.floors; f++) {
        const y = base + floorH * f + floorH * 0.55;
        for (let i = 0; i < n; i++) {
          const u = -D / 2 + (D / n) * (i + 0.5);
          const isLit = rnd() < o.litRatio;
          b.box(0.1, 1.6, 1.5, FRAME, xf, y, u);
          b.box(0.12, 1.42, 1.3, isLit ? lit : GLASS_DARK, xf + end * 0.02, y, u, 0, isLit ? 'glow' : 'matte');
        }
      }
      // 박공 꼭대기 작은 창
      if (roofH > 3) {
        b.box(0.1, 1.1, 1.3, FRAME, xf, top + roofH * 0.34, 0);
        b.box(0.12, 0.92, 1.1, rnd() < 0.5 ? lit : GLASS_DARK, xf + end * 0.02, top + roofH * 0.34, 0, 0, 'glow');
      }
    }
  }

  if (o.porch) {
    // 오두막 앞 작은 데크와 계단
    b.rbox(1.9, 0.22, D * 0.9, WOOD_DARK, -L / 2 - 0.95, base - 0.02, 0, 0, 0.04);
    b.box(0.12, 1.5, 0.12, WOOD_DEEP, -L / 2 - 1.8, base - 0.75, D * 0.4);
    b.box(0.12, 1.5, 0.12, WOOD_DEEP, -L / 2 - 1.8, base - 0.75, -D * 0.4);
    b.box(0.1, 0.9, 0.1, WOOD_DEEP, -L / 2 - 1.82, base + 0.5, D * 0.42);
    b.box(0.1, 0.9, 0.1, WOOD_DEEP, -L / 2 - 1.82, base + 0.5, -D * 0.42);
    b.box(0.08, 0.08, D * 0.86, WOOD_DEEP, -L / 2 - 1.82, base + 0.95, 0);
    // 문
    b.box(0.1, 1.9, 0.95, WOOD_DEEP, -L / 2 - 0.03, base + 0.97, D * 0.2);
    // 문 옆 등
    b.box(0.12, 0.22, 0.16, season.lamp, -L / 2 - 0.08, base + 2.15, -D * 0.05, 0, 'glow');
  }
}

function buildingTransform(def: BuildingDef, y: number): { m: THREE.Matrix4; L: number; D: number; glassEnd: -1 | 0 | 1 } {
  // ridge 'x': 로컬 x → 동쪽. ridge 'z': 로컬 x → 북쪽(-z)
  const ridgeZ = def.ridge === 'z';
  const m = trs(def.x, y, def.z, ridgeZ ? Math.PI / 2 : 0);
  let glassEnd: -1 | 0 | 1 = 0;
  if (def.glassGable) {
    if (ridgeZ) glassEnd = def.glassGable === 's' ? -1 : def.glassGable === 'n' ? 1 : 0;
    else glassEnd = def.glassGable === 'e' ? 1 : def.glassGable === 'w' ? -1 : 0;
  }
  return { m, L: ridgeZ ? def.d : def.w, D: ridgeZ ? def.w : def.d, glassEnd };
}

export function buildBuildings(b: Batcher, groundY: (x: number, z: number) => number, season: SeasonPalette): void {
  BUILDINGS.forEach((def, i) => {
    const y = groundY(def.x, def.z);
    const t = buildingTransform(def, y);
    b.push(t.m);
    gabled(b, {
      L: t.L,
      D: t.D,
      wallH: def.wallH,
      roofH: def.roofH,
      floors: def.floors,
      glassEnd: t.glassEnd,
      seed: 100 + i * 17,
      litRatio: def.id === 'saesol' ? 0.62 : 0.5,
      season,
    });
    b.pop();

    // 체험관의 돌출된 작은 지붕들 (남쪽 면)
    if (def.id === 'exp') {
      for (const off of [-5.6, 3.4]) {
        b.push(trs(def.x + off, y, def.z + def.d / 2 + 1.0, Math.PI / 2));
        gabled(b, { L: 3.4, D: 4.6, wallH: 4.0, roofH: 2.3, floors: 1, glassEnd: -1, seed: 300 + off, litRatio: 0.8, season });
        b.pop();
      }
    }
    // 새솔관 가운데 현관 지붕
    if (def.id === 'saesol') {
      b.push(trs(def.x - 2, y, def.z + def.d / 2 + 1.2, Math.PI / 2));
      gabled(b, { L: 3.6, D: 6.4, wallH: 3.6, roofH: 2.4, floors: 1, glassEnd: -1, seed: 410, litRatio: 0.9, season });
      b.pop();
    }
  });

  // 나래마을 오두막
  CABINS.forEach((c, i) => {
    const y = groundY(c.x, c.z);
    b.push(trs(c.x, y, c.z, c.rot, c.s, c.s, c.s));
    gabled(b, { L: 5.0, D: 4.3, wallH: 2.6, roofH: 2.15, floors: 1, glassEnd: 0, seed: 500 + i * 7, litRatio: 0.75, season, porch: true });
    b.pop();
  });
}

/** 숲 현판 텍스처 (글자는 copy.ts에서) */
export function makePlaqueTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 1280;
  cv.height = 480;
  const g = cv.getContext('2d')!;
  // 나무판
  const grad = g.createLinearGradient(0, 0, 0, cv.height);
  grad.addColorStop(0, '#5b4029');
  grad.addColorStop(1, '#4a3321');
  g.fillStyle = grad;
  g.fillRect(0, 0, cv.width, cv.height);
  // 나뭇결
  g.globalAlpha = 0.16;
  for (let i = 0; i < 46; i++) {
    const y = (i / 46) * cv.height + Math.sin(i * 12.7) * 5;
    g.strokeStyle = i % 3 === 0 ? '#2e1f13' : '#7a5a3c';
    g.lineWidth = 1 + (i % 4);
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(cv.width * 0.3, y + Math.sin(i) * 9, cv.width * 0.7, y - Math.cos(i * 1.7) * 9, cv.width, y + 3);
    g.stroke();
  }
  g.globalAlpha = 1;
  // 테두리
  g.strokeStyle = 'rgba(241,236,220,0.5)';
  g.lineWidth = 5;
  g.strokeRect(26, 26, cv.width - 52, cv.height - 52);
  // 글자
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#f6efdc';
  g.shadowColor = 'rgba(0,0,0,0.45)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 3;
  g.font = '600 214px "Noto Serif KR", "Pretendard Variable", serif';
  g.fillText(COPY.forest.plaque.big, cv.width / 2, 186);
  g.font = '600 76px "Pretendard Variable", Pretendard, sans-serif';
  g.fillStyle = '#ecdfbd';
  g.fillText(COPY.forest.plaque.small, cv.width / 2, 372);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 입구 구조물: 목재 기둥과 가로보, 그 위에 숲 현판 */
export function buildGate(b: Batcher, groundY: (x: number, z: number) => number, season: SeasonPalette): THREE.Object3D {
  const g = new THREE.Group();
  const y0 = groundY(GATE.x, GATE.z);
  const half = GATE.span / 2;
  const H = GATE.height;
  b.push(trs(GATE.x, y0, GATE.z));
  for (const s of [-1, 1]) {
    b.rbox(1.0, 0.7, 1.0, STONE, s * half, 0.25, 0, 0, 0.1);
    b.rbox(0.46, H + 0.6, 0.46, WOOD_DEEP, s * half, H / 2 + 0.3, 0, 0, 0.05);
    // 버팀목
    b.box(0.2, 1.7, 0.2, WOOD_DEEP, s * (half - 0.62), H - 0.42, 0, 0, 'matte', 0, s * 0.78);
    // 기둥 옆 낮은 돌담
    b.rbox(3.4, 0.8, 0.7, STONE, s * (half + 2.3), 0.3, 0.1, s * 0.12, 0.12);
    b.rbox(3.5, 0.14, 0.82, 0x9a9486, s * (half + 2.3), 0.74, 0.1, s * 0.12, 0.05);
  }
  // 가로보 2단
  b.rbox(GATE.span + 2.4, 0.42, 0.52, WOOD_DEEP, 0, H + 0.45, 0, 0, 0.05);
  b.rbox(GATE.span + 1.2, 0.3, 0.4, WOOD_DARK, 0, H - 2.25, 0, 0, 0.05);
  b.rbox(GATE.span + 3.2, 0.16, 0.9, ROOF_DARK, 0, H + 0.76, 0, 0, 0.04);
  // 현판 틀
  b.rbox(4.9, 1.95, 0.16, 0x3c2a1b, 0, H - 0.98, 0, 0, 0.05);
  // 현판을 비추는 작은 등
  for (const s of [-1.6, 0, 1.6]) {
    b.box(0.3, 0.07, 0.16, season.lamp, s, H + 0.2, 0.36, 0, 'glow');
    b.box(0.3, 0.07, 0.16, season.lamp, s, H + 0.2, -0.36, 0, 'glow');
  }
  b.pop();

  // 현판 글자 면(앞뒤)
  const tex = makePlaqueTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0.55,
    roughness: 0.85,
  });
  const geo = new THREE.PlaneGeometry(4.7, 1.76);
  const front = new THREE.Mesh(geo, mat);
  front.position.set(GATE.x, y0 + H - 0.98, GATE.z + 0.09);
  const back = new THREE.Mesh(geo, mat);
  back.position.set(GATE.x, y0 + H - 0.98, GATE.z - 0.09);
  back.rotation.y = Math.PI;
  g.add(front, back);
  g.name = 'gate-plaque';
  return g;
}

/** 엘리베이터 타워: 목재 뼈대 + 유리, 안에서 오르내리는 승강칸 */
export class ElevatorTower {
  readonly group = new THREE.Group();
  readonly cab = new THREE.Group();
  private doorW: THREE.Mesh;
  private doorE: THREE.Mesh;
  readonly baseY: number;
  readonly topY: number;

  constructor(b: Batcher, groundY: (x: number, z: number) => number, season: SeasonPalette) {
    const { x, z, size, topY, height } = ELEVATOR;
    this.baseY = groundY(x, z) + 0.12;
    this.topY = topY;
    const y0 = this.baseY - 0.12;
    const hs = size / 2;
    b.push(trs(x, y0, z));
    // 바닥 기단
    b.rbox(size + 0.8, 0.5, size + 0.8, STONE, 0, -0.13, 0, 0, 0.08);
    // 모서리 기둥
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.rbox(0.3, height, 0.3, WOOD_DEEP, sx * hs, height / 2, sz * hs, 0, 0.04);
      }
    }
    // 가로 띠
    for (const yy of [2.9, 5.6, 9.2]) {
      for (const s of [-1, 1]) {
        b.box(size + 0.3, 0.2, 0.2, WOOD_DARK, 0, yy, s * hs);
        // 문이 있는 동·서면은 문 위쪽만
        b.box(0.2, 0.2, size + 0.3, WOOD_DARK, s * hs, yy, 0);
      }
    }
    // 남·북면 세로 널
    for (const s of [-1, 1]) {
      for (const u of [-0.9, 0, 0.9]) b.box(0.12, height - 0.4, 0.08, WOOD, u, height / 2, s * (hs + 0.02));
    }
    // 지붕
    b.rbox(size + 1.5, 0.24, size + 1.5, ROOF, 0, height + 0.12, 0, 0, 0.05);
    b.rbox(size + 0.7, 0.3, size + 0.7, ROOF_DARK, 0, height + 0.36, 0, 0, 0.05);
    // 꼭대기 불빛 띠
    for (const s of [-1, 1]) {
      b.box(size - 0.5, 0.12, 0.08, season.lamp, 0, height - 0.3, s * (hs + 0.06), 0, 'glow');
      b.box(0.08, 0.12, size - 0.5, season.lamp, s * (hs + 0.06), height - 0.3, 0, 0, 'glow');
    }
    // 위쪽 승강장 바닥(데크로드와 이어짐)
    b.rbox(1.6, 0.18, 2.7, WOOD_DARK, hs + 0.8, topY - y0 - 0.09, 0, 0, 0.04);
    b.pop();

    // 유리(남·북면)
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x9fc2cf,
      transparent: true,
      opacity: 0.2,
      roughness: 0.15,
      metalness: 0.1,
      emissive: 0xffc98a,
      emissiveIntensity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const s of [-1, 1]) {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(size - 0.3, height - 0.5), glassMat);
      glass.position.set(x, y0 + height / 2, z + s * hs);
      this.group.add(glass);
    }

    // 승강칸
    const cabMat = new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(size - 0.5, 0.12, size - 0.5), cabMat);
    floor.position.y = -0.06;
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(size - 0.5, 0.1, size - 0.5), cabMat);
    ceil.position.y = 2.5;
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(size - 1.4, 0.05, size - 1.4),
      new THREE.MeshBasicMaterial({ color: season.lamp, toneMapped: false }),
    );
    light.position.y = 2.43;
    const railMat = new THREE.MeshStandardMaterial({ color: WOOD_DEEP, roughness: 0.85 });
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(size - 0.6, 0.08, 0.08), railMat);
      rail.position.set(0, 0.95, s * (hs - 0.34));
      this.cab.add(rail);
    }
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0xb9d2da,
      transparent: true,
      opacity: 0.42,
      roughness: 0.2,
      emissive: 0xffc98a,
      emissiveIntensity: 0.1,
      side: THREE.DoubleSide,
    });
    const doorGeo = new THREE.BoxGeometry(0.07, 2.35, size - 0.6);
    this.doorW = new THREE.Mesh(doorGeo, doorMat);
    this.doorE = new THREE.Mesh(doorGeo, doorMat);
    this.doorW.position.set(-hs + 0.22, 1.2, 0);
    this.doorE.position.set(hs - 0.22, 1.2, 0);
    this.cab.add(floor, ceil, light, this.doorW, this.doorE);
    this.cab.position.set(x, this.baseY, z);
    this.group.add(this.cab);
    this.setState(0, 1, 0);
  }

  /** t: 0(아래)~1(위), 문 열림 0~1 */
  setState(t: number, westOpen: number, eastOpen: number): void {
    this.cab.position.y = this.baseY + (this.topY - this.baseY) * t;
    const slide = ELEVATOR.size - 0.7;
    this.doorW.position.z = westOpen * slide;
    this.doorW.scale.z = 1 - westOpen * 0.92;
    this.doorE.position.z = eastOpen * slide;
    this.doorE.scale.z = 1 - eastOpen * 0.92;
  }
}
