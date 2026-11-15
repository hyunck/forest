import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { closestOnSegment, hash2, makeRng, noise2 } from '../core/util';
import {
  BUILDINGS,
  CABINS,
  CLEARINGS,
  DECK_PLATFORM,
  ELEVATOR,
  FEATURE_TREES,
  GATE,
  LAMPS,
  NAV_EDGES,
  PLAZA,
  SEATS,
  SIGNS,
  SPAWN,
  WORLD,
} from '../scenes/daejeon/layout';
import { NODE, Terrain } from './terrain';
import type { SeasonPalette } from '../scenes/seasons';

/** 바람 셰이더가 함께 쓰는 시간 */
export const wind = { uTime: { value: 0 } };

function swayMaterial(strength: number, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...opts });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLeaf;\nuniform float uTime;')
      .replace('#include <color_vertex>', 'vColor = color * mix(vec3(1.0), instanceColor, aLeaf);')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        vec3 transformed = vec3(position);
        #ifdef USE_INSTANCING
          vec3 wpos = (instanceMatrix * vec4(position, 1.0)).xyz;
        #else
          vec3 wpos = position;
        #endif
        float ph = wpos.x * 0.21 + wpos.z * 0.17;
        float sway = sin(uTime * 1.1 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.3;
        float amt = aLeaf * ${strength.toFixed(4)} * max(position.y, 0.0);
        transformed.x += sway * amt;
        transformed.z += cos(uTime * 0.9 + ph * 1.3) * amt * 0.6;
        `,
      );
  };
  mat.customProgramCacheKey = () => 'sway-' + strength.toFixed(4);
  return mat;
}

/** 조각 하나에 색·잎 여부 속성을 입힘 */
function paint(g: THREE.BufferGeometry, leaf: boolean, color: (y: number, i: number) => [number, number, number]): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position') geo.deleteAttribute(name);
  }
  geo.computeVertexNormals();
  const p = geo.getAttribute('position');
  const col = new Float32Array(p.count * 3);
  const lf = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    // 같은 삼각형의 세 점은 같은 색(면 단위 색)
    const tri = Math.floor(i / 3);
    const yc = (p.getY(tri * 3) + p.getY(tri * 3 + 1) + p.getY(tri * 3 + 2)) / 3;
    const c = color(yc, tri);
    col[i * 3] = c[0];
    col[i * 3 + 1] = c[1];
    col[i * 3 + 2] = c[2];
    lf[i] = leaf ? 1 : 0;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aLeaf', new THREE.BufferAttribute(lf, 1));
  return geo;
}

function blob(r: number, detail: number, seed: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, coarse = false): THREE.BufferGeometry {
  // coarse: 먼 배경 나무용(삼각형 36개짜리 십이면체)
  const g = coarse ? new THREE.DodecahedronGeometry(r, 0) : new THREE.IcosahedronGeometry(r, detail);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i);
    const py = p.getY(i);
    const pz = p.getZ(i);
    // 위치로 흔들어야 같은 꼭짓점이 같이 움직임(틈이 생기지 않음)
    const k = 0.84 + hash2(Math.round(px * 40) + seed * 7.1, Math.round(py * 40) * 1.3 + Math.round(pz * 40) * 2.1) * 0.32;
    p.setXYZ(i, px * k * sx + x, py * k * sy + y, pz * k * sz + z);
  }
  return g;
}

const TRUNK: [number, number, number] = [0.21, 0.135, 0.085];
const TRUNK_PALE: [number, number, number] = [0.3, 0.22, 0.15];

function leafShade(y0: number, y1: number, seed: number): (y: number, i: number) => [number, number, number] {
  return (y, i) => {
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    const v = 0.7 + t * 0.42 + (hash2(i * 1.7 + seed, i * 0.3) - 0.5) * 0.12;
    return [v, v, v];
  };
}
const solid = (c: [number, number, number]) => (): [number, number, number] => c;

function mapleGeometry(variant: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tall = variant === 1;
  const th = tall ? 3.3 : 2.7;
  parts.push(paint(new THREE.CylinderGeometry(0.13, 0.24, th, 6).translate(0, th / 2, 0), false, solid(TRUNK)));
  const br = new THREE.CylinderGeometry(0.06, 0.1, 1.5, 5).translate(0, 0.75, 0).rotateZ(0.7).translate(0, th - 0.9, 0);
  parts.push(paint(br, false, solid(TRUNK)));
  const br2 = new THREE.CylinderGeometry(0.06, 0.1, 1.4, 5).translate(0, 0.7, 0).rotateZ(-0.75).rotateY(1.2).translate(0, th - 1.1, 0);
  parts.push(paint(br2, false, solid(TRUNK)));
  const y0 = th - 0.6;
  const shade = leafShade(y0, y0 + (tall ? 4.6 : 3.8), variant * 13);
  if (tall) {
    parts.push(paint(blob(1.75, 1, 3, 1, 0.92, 1, 0.1, th + 0.9, 0), true, shade));
    parts.push(paint(blob(1.35, 1, 4, 1, 0.9, 1, -0.7, th + 2.3, 0.4), true, shade));
    parts.push(paint(blob(1.15, 1, 5, 1, 0.85, 1, 0.9, th + 2.0, -0.6), true, shade));
    parts.push(paint(blob(0.95, 0, 6, 1, 0.9, 1, 0.1, th + 3.3, 0.0), true, shade));
  } else {
    parts.push(paint(blob(1.7, 1, 1, 1.12, 0.78, 1.05, 0, th + 0.7, 0), true, shade));
    parts.push(paint(blob(1.3, 1, 2, 1, 0.8, 1, 1.25, th + 0.5, 0.5), true, shade));
    parts.push(paint(blob(1.25, 1, 7, 1, 0.8, 1, -1.2, th + 0.75, -0.4), true, shade));
    parts.push(paint(blob(1.15, 0, 8, 1, 0.8, 1, 0.1, th + 1.9, -0.2), true, shade));
  }
  return mergeGeometries(parts, false)!;
}

function coniferGeometry(far: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const seg = far ? 6 : 8;
  parts.push(paint(new THREE.CylinderGeometry(0.1, 0.2, 2.0, far ? 4 : 5, 1, far).translate(0, 1.0, 0), false, solid(TRUNK)));
  const tiers = far ? 3 : 4;
  const shade = leafShade(1.2, 7.4, 31);
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const r = 1.75 - t * 1.05;
    const hgt = 2.3 - t * 0.5;
    const y = 1.4 + i * (far ? 1.75 : 1.4);
    const cone = new THREE.ConeGeometry(r, hgt, seg, 1, far).translate(0, y + hgt / 2, 0).rotateY(i * 0.5);
    parts.push(paint(cone, true, shade));
  }
  return mergeGeometries(parts, false)!;
}

function hinokiGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // 곧게 뻗은 편백: 붉은빛 도는 긴 줄기와 좁은 수관
  parts.push(paint(new THREE.CylinderGeometry(0.12, 0.2, 5.4, 6).translate(0, 2.7, 0), false, solid([0.3, 0.17, 0.11])));
  const profile = [
    new THREE.Vector2(0.0, 3.0),
    new THREE.Vector2(0.95, 3.5),
    new THREE.Vector2(1.2, 4.6),
    new THREE.Vector2(1.05, 6.2),
    new THREE.Vector2(0.7, 7.8),
    new THREE.Vector2(0.3, 9.0),
    new THREE.Vector2(0.0, 9.7),
  ];
  parts.push(paint(new THREE.LatheGeometry(profile, 7), true, leafShade(3.0, 9.7, 51)));
  return mergeGeometries(parts, false)!;
}

function farBroadleafGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(paint(new THREE.CylinderGeometry(0.14, 0.22, 2.6, 4, 1, true).translate(0, 1.3, 0), false, solid(TRUNK)));
  parts.push(paint(blob(2.15, 0, 11, 1.05, 0.92, 1, 0, 4.0, 0, true), true, leafShade(2.2, 6.2, 71)));
  return mergeGeometries(parts, false)!;
}

function bushGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const shade = leafShade(0, 0.9, 91);
  parts.push(paint(blob(0.6, 1, 21, 1.15, 0.72, 1, 0, 0.36, 0), true, shade));
  parts.push(paint(blob(0.42, 0, 22, 1, 0.8, 1, 0.5, 0.3, 0.2), true, shade));
  return mergeGeometries(parts, false)!;
}

function grassGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const lean = 0.16;
    const bx = Math.sin(a) * 0.07;
    const bz = Math.cos(a) * 0.07;
    const w = 0.06;
    const hgt = 0.34 + (i % 2) * 0.14;
    pos.push(bx - Math.cos(a) * w, 0, bz + Math.sin(a) * w);
    pos.push(bx + Math.cos(a) * w, 0, bz - Math.sin(a) * w);
    pos.push(bx + Math.sin(a) * lean, hgt, bz + Math.cos(a) * lean);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return paint(g, true, (y) => {
    const v = 0.75 + y * 1.4;
    return [v, v, v];
  });
}

interface Inst {
  x: number;
  y: number;
  z: number;
  s: number;
  sy: number;
  rot: number;
  color: THREE.Color;
}

function makeInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, list: Inst[], shadow: boolean, name: string): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  list.forEach((it, i) => {
    q.setFromAxisAngle(up, it.rot);
    m.compose(p.set(it.x, it.y, it.z), q, s.set(it.s, it.sy, it.s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, it.color);
  });
  mesh.count = list.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  mesh.name = name;
  mesh.computeBoundingSphere();
  return mesh;
}

/** 그 자리에 나무·수풀을 둘 수 없는지 */
function blocked(x: number, z: number, margin: number, terrain: Terrain): boolean {
  for (const b of BUILDINGS) {
    const extraS = b.id === 'exp' || b.id === 'saesol' ? 3.4 : 0;
    if (Math.abs(x - b.x) < b.w / 2 + margin && z > b.z - b.d / 2 - margin && z < b.z + b.d / 2 + margin + extraS) return true;
  }
  for (const c of CABINS) if (Math.hypot(x - c.x, z - c.z) < 4.4 + margin * 0.5) return true;
  if (Math.hypot(x - ELEVATOR.x, z - ELEVATOR.z) < 3.4 + margin) return true;
  if (Math.abs(x - GATE.x) < 7.5 && Math.abs(z - GATE.z) < 1.8 + margin) return true;
  const P = DECK_PLATFORM;
  if (x > P.minX - margin && x < P.maxX + margin && z > P.minZ - margin && z < P.maxZ + margin) return true;
  for (const e of NAV_EDGES) {
    const a = NODE.get(e.a)!;
    const c = NODE.get(e.b)!;
    if (a.level !== 1 || e.kind === 'elevator') continue;
    if (closestOnSegment(x, z, a.x, a.z, c.x, c.z).d < e.w + 1.6 + margin * 0.6) return true;
  }
  if (terrain.streamDistance(x, z) < 2.4 + margin * 0.4) return true;
  return false;
}

function nearThings(x: number, z: number, r: number): boolean {
  for (const s of SEATS) if (s.level === 0 && Math.hypot(x - s.x, z - s.z) < r + 0.6) return true;
  for (const s of SIGNS) if (Math.hypot(x - s.x, z - s.z) < r) return true;
  for (const l of LAMPS) if (Math.hypot(x - l.x, z - l.z) < r * 0.7) return true;
  return false;
}

export interface Vegetation {
  group: THREE.Group;
  /** 저사양에서 풀·낙엽을 끔 */
  setDetail(high: boolean): void;
}

export function buildVegetation(terrain: Terrain, season: SeasonPalette): Vegetation {
  const group = new THREE.Group();
  group.name = 'vegetation';
  const rnd = makeRng(20261115);
  const tint = (palette: number[], jitter = 0.06): THREE.Color => {
    const c = new THREE.Color(palette[Math.floor(rnd() * palette.length)]);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(hsl.h + (rnd() - 0.5) * 0.03, hsl.s, Math.min(0.9, Math.max(0.05, hsl.l + (rnd() - 0.5) * jitter * 2)));
    return c;
  };

  const maples: Inst[][] = [[], []];
  const conifers: Inst[] = [];
  const hinokis: Inst[] = [];
  const farBroad: Inst[] = [];
  const farConifer: Inst[] = [];

  const clearingDensity = (x: number, z: number): number => {
    let d = 1;
    for (const c of CLEARINGS) if (Math.hypot(x - c.x, z - c.z) < c.r) d = Math.min(d, c.density);
    return d;
  };

  const addTree = (kind: 'maple' | 'pine' | 'hinoki', x: number, z: number, s: number, far: boolean): void => {
    const y = terrain.groundY(x, z) - 0.12;
    const rot = rnd() * Math.PI * 2;
    if (kind === 'maple') {
      const it: Inst = { x, y, z, s, sy: s * (0.92 + rnd() * 0.2), rot, color: tint(season.broadleaf) };
      if (far) farBroad.push(it);
      else maples[rnd() < 0.5 ? 0 : 1].push(it);
    } else if (kind === 'pine') {
      const it: Inst = { x, y, z, s, sy: s * (0.95 + rnd() * 0.3), rot, color: tint(season.conifer, 0.03) };
      if (far) farConifer.push(it);
      else conifers.push(it);
    } else {
      const it: Inst = { x, y, z, s, sy: s * (0.95 + rnd() * 0.2), rot, color: tint(season.hinoki, 0.03) };
      if (far) farConifer.push({ ...it, sy: it.sy * 1.25, s: it.s * 0.8 });
      else hinokis.push(it);
    }
  };

  // 표찰 옆 나무와 광장 가장자리 단풍나무(직접 지정)
  const fixed: Array<{ x: number; z: number }> = [];
  for (const t of FEATURE_TREES) {
    addTree(t.kind, t.x, t.z, t.s, false);
    fixed.push(t);
  }
  for (const s of SIGNS) {
    if (s.tree) {
      addTree(s.tree.kind, s.tree.x, s.tree.z, 1.15, false);
      fixed.push(s.tree);
    }
  }

  // 숲 채우기: 흩뜨린 격자
  const CELL = 3.3;
  for (let gz = WORLD.minZ + 4; gz < WORLD.maxZ - 4; gz += CELL) {
    for (let gx = WORLD.minX + 4; gx < WORLD.maxX - 4; gx += CELL) {
      const x = gx + (rnd() - 0.5) * CELL * 0.9;
      const z = gz + (rnd() - 0.5) * CELL * 0.9;
      const r1 = rnd();
      const r2 = rnd();
      const r3 = rnd();
      const pd = Terrain.pathDistance(x, z);
      if (pd < 2.7) continue;
      if (blocked(x, z, 2.0, terrain)) continue;
      if (nearThings(x, z, 2.2)) continue;
      if (fixed.some((f) => Math.hypot(f.x - x, f.z - z) < 3.4)) continue;
      // 입구에서 현판과 건물이 보이는 시야는 비움
      if (Math.abs(x - SPAWN.x) < 5.5 && z > 30 && z < 62) continue;
      const cd = clearingDensity(x, z);
      const campus = x > -62 && x < 74 && z > -78 && z < 66;
      const near = campus && pd < 26;
      const density = (near ? 0.66 : campus ? 0.52 : 0.4) * cd;
      if (r1 > density) continue;
      // 숲의 종류: 골짜기에는 편백·소나무, 북쪽 능선 쪽은 침엽수가 더 많게
      const region = noise2(x * 0.03 + 5, z * 0.03 + 9);
      let pHinoki = 0.1;
      let pPine = 0.2;
      if (x < -22 && z < -14) {
        pHinoki = 0.34;
        pPine = 0.3;
      }
      if (z < -70 || region > 0.66) pPine += 0.22;
      const kind = r2 < pHinoki ? 'hinoki' : r2 < pHinoki + pPine ? 'pine' : 'maple';
      const s = near ? 0.85 + r3 * 0.55 : 1.35 + r3 * 0.85;
      addTree(kind, x, z, s, !near);
    }
  }

  const leafMat = swayMaterial(0.012);
  const farMat = swayMaterial(0.008);
  const g0 = mapleGeometry(0);
  const g1 = mapleGeometry(1);
  group.add(makeInstanced(g0, leafMat, maples[0], true, 'maple-a'));
  group.add(makeInstanced(g1, leafMat, maples[1], true, 'maple-b'));
  group.add(makeInstanced(coniferGeometry(false), leafMat, conifers, true, 'conifer'));
  group.add(makeInstanced(hinokiGeometry(), leafMat, hinokis, true, 'hinoki'));
  group.add(makeInstanced(farBroadleafGeometry(), farMat, farBroad, false, 'far-broadleaf'));
  group.add(makeInstanced(coniferGeometry(true), farMat, farConifer, false, 'far-conifer'));

  // 길가와 건물 둘레의 낮은 수풀
  const bushes: Inst[] = [];
  for (let gz = -76; gz < 64; gz += 1.7) {
    for (let gx = -60; gx < 72; gx += 1.7) {
      const x = gx + (rnd() - 0.5) * 1.5;
      const z = gz + (rnd() - 0.5) * 1.5;
      const r1 = rnd();
      const pd = Terrain.pathDistance(x, z);
      if (pd < 0.9 || pd > 9) continue;
      const lawn = Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.radius - 0.5;
      if (lawn) continue;
      if (blocked(x, z, 0.5, terrain) || nearThings(x, z, 1.1)) continue;
      const cd = clearingDensity(x, z);
      const p = (pd < 3 ? 0.2 : 0.09) * (cd < 0.3 ? 0.35 : 1);
      if (r1 > p) continue;
      const s = 0.7 + rnd() * 0.9;
      bushes.push({ x, y: terrain.groundY(x, z) - 0.05, z, s, sy: s * (0.8 + rnd() * 0.4), rot: rnd() * 6.28, color: tint(season.bush, 0.05) });
    }
  }
  group.add(makeInstanced(bushGeometry(), swayMaterial(0.02), bushes, true, 'bushes'));

  // 풀
  const tufts: Inst[] = [];
  const grassPalette = [season.grassLawn, season.grassWild, 0x8a8a48, 0x9a8a44, 0x6f7a3e];
  for (let gz = -72; gz < 62; gz += 1.05) {
    for (let gx = -56; gx < 70; gx += 1.05) {
      const x = gx + (rnd() - 0.5);
      const z = gz + (rnd() - 0.5);
      const r1 = rnd();
      const pd = Terrain.pathDistance(x, z);
      if (pd < 0.25 || pd > 7.5) continue;
      const inPlaza = Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.radius;
      if (inPlaza) continue;
      if (r1 > (pd < 2.5 ? 0.42 : 0.2)) continue;
      if (blocked(x, z, 0.2, terrain)) continue;
      const s = 0.8 + rnd() * 0.9;
      tufts.push({ x, y: terrain.groundY(x, z), z, s, sy: s, rot: rnd() * 6.28, color: tint(grassPalette, 0.04) });
    }
  }
  const grassMesh = makeInstanced(grassGeometry(), swayMaterial(0.22, { side: THREE.DoubleSide }), tufts, false, 'grass');
  grassMesh.receiveShadow = true;
  group.add(grassMesh);

  // 바닥에 떨어진 낙엽
  const litter: Inst[] = [];
  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.11, 0, 0, 0, 0, 0.065, 0.11, 0, 0, -0.11, 0, 0, 0.11, 0, 0, 0, 0, -0.065], 3),
  );
  leafGeo.computeVertexNormals();
  const tryLeaf = (x: number, z: number): void => {
    if (blocked(x, z, -0.4, terrain) && terrain.streamDistance(x, z) > 2.4) return;
    if (terrain.streamDistance(x, z) < 1.8) return;
    const s = 0.8 + rnd() * 1.0;
    litter.push({ x, y: terrain.groundY(x, z) + 0.075, z, s, sy: 1, rot: rnd() * 6.28, color: tint(season.fallenLeaves, 0.08) });
  };
  for (let i = 0; i < 2600; i++) {
    const x = -58 + rnd() * 128;
    const z = -74 + rnd() * 136;
    const pd = Terrain.pathDistance(x, z);
    if (pd > 4.5) continue;
    if (pd < 0 && rnd() < 0.35) continue;
    tryLeaf(x, z);
  }
  for (const t of fixed) {
    for (let i = 0; i < 26; i++) {
      const a = rnd() * 6.28;
      const r = 0.6 + rnd() * 3.6;
      tryLeaf(t.x + Math.sin(a) * r, t.z + Math.cos(a) * r);
    }
  }
  const litterMesh = makeInstanced(
    leafGeo,
    new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide }),
    litter,
    false,
    'leaf-litter',
  );
  litterMesh.receiveShadow = true;
  group.add(litterMesh);

  return {
    group,
    setDetail(high: boolean): void {
      grassMesh.visible = high;
      litterMesh.visible = high;
    },
  };
}
