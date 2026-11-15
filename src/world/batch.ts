import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type Bucket = 'matte' | 'glow' | 'far';

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

/** 위치·회전·크기로 행렬 만들기 */
export function trs(x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0): THREE.Matrix4 {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

/**
 * 움직이지 않는 소품을 재질별로 한 덩어리로 합쳐 그리는 도우미.
 * (드로콜을 줄여 휴대폰에서도 가볍게 돌아가게 함)
 *  - matte: 그림자를 드리우고 받는 무광 색면
 *  - far:   그림자를 드리우지 않는 먼 배경
 *  - glow:  정원등·창문처럼 스스로 빛나는 면
 */
export class Batcher {
  private buckets: Record<Bucket, THREE.BufferGeometry[]> = { matte: [], glow: [], far: [] };
  private stack: THREE.Matrix4[] = [];
  private current = new THREE.Matrix4();
  private color = new THREE.Color();

  push(m: THREE.Matrix4): void {
    this.stack.push(this.current.clone());
    this.current.multiply(m);
  }
  pop(): void {
    const m = this.stack.pop();
    if (m) this.current.copy(m);
  }

  add(geo: THREE.BufferGeometry, color: number | THREE.Color, m?: THREE.Matrix4, bucket: Bucket = 'matte', flat = false): void {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    const mat = m ? this.current.clone().multiply(m) : this.current;
    g.applyMatrix4(mat);
    if (flat || !g.getAttribute('normal')) g.computeVertexNormals();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    this.color.set(color as THREE.ColorRepresentation);
    for (let i = 0; i < n; i++) {
      col[i * 3] = this.color.r;
      col[i * 3 + 1] = this.color.g;
      col[i * 3 + 2] = this.color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.buckets[bucket].push(g);
    if (g !== geo) geo.dispose();
  }

  /** 상자 (아랫면 중심 기준이 아니라 중심 기준) */
  box(w: number, hgt: number, d: number, color: number, x: number, y: number, z: number, ry = 0, bucket: Bucket = 'matte', rx = 0, rz = 0): void {
    this.add(new THREE.BoxGeometry(w, hgt, d), color, trs(x, y, z, ry, 1, 1, 1, rx, rz), bucket);
  }

  /** 모서리가 살짝 둥근 상자 */
  rbox(w: number, hgt: number, d: number, color: number, x: number, y: number, z: number, ry = 0, r = 0.06, bucket: Bucket = 'matte', rx = 0, rz = 0): void {
    // 아주 길거나 얇은 조각은 둥근 모서리가 보이지 않으므로 보통 상자로(삼각형 수 절약)
    if (Math.max(w, hgt, d) > 2.6 || Math.min(w, hgt, d) < 0.13) {
      this.add(new THREE.BoxGeometry(w, hgt, d), color, trs(x, y, z, ry, 1, 1, 1, rx, rz), bucket);
      return;
    }
    const rr = Math.min(r, w / 2 - 0.001, hgt / 2 - 0.001, d / 2 - 0.001);
    this.add(new RoundedBoxGeometry(w, hgt, d, 1, Math.max(rr, 0.005)), color, trs(x, y, z, ry, 1, 1, 1, rx, rz), bucket);
  }

  cyl(rTop: number, rBot: number, hgt: number, color: number, x: number, y: number, z: number, seg = 8, bucket: Bucket = 'matte', rx = 0, rz = 0, ry = 0): void {
    this.add(new THREE.CylinderGeometry(rTop, rBot, hgt, seg), color, trs(x, y, z, ry, 1, 1, 1, rx, rz), bucket);
  }

  sphere(r: number, color: number, x: number, y: number, z: number, bucket: Bucket = 'matte', sy = 1, detail = 1, flat = true): void {
    this.add(new THREE.IcosahedronGeometry(r, detail), color, trs(x, y, z, 0, 1, sy, 1), bucket, flat);
  }

  build(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    const make = (bucket: Bucket): void => {
      const list = this.buckets[bucket];
      if (!list.length) return;
      const geo = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      this.buckets[bucket] = [];
      if (!geo) return;
      let mat: THREE.Material;
      if (bucket === 'glow') {
        mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: true });
      } else {
        mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = bucket === 'matte';
      mesh.receiveShadow = bucket !== 'glow';
      mesh.name = 'static-' + bucket;
      out.push(mesh);
    };
    make('matte');
    make('far');
    make('glow');
    return out;
  }
}

/** 삼각 지붕 속을 채우는 삼각기둥 (길이 L은 x축, 폭 D는 z축, 높이 H) */
export function prismGeometry(L: number, D: number, H: number): THREE.BufferGeometry {
  const x0 = -L / 2;
  const x1 = L / 2;
  const z0 = -D / 2;
  const z1 = D / 2;
  const v = (x: number, y: number, z: number): number[] => [x, y, z];
  const A0 = v(x0, 0, z0);
  const B0 = v(x0, 0, z1);
  const C0 = v(x0, H, 0);
  const A1 = v(x1, 0, z0);
  const B1 = v(x1, 0, z1);
  const C1 = v(x1, H, 0);
  const tris = [
    // -x 끝 박공면
    A0, B0, C0,
    // +x 끝 박공면
    B1, A1, C1,
    // +z 경사면
    B0, B1, C1, B0, C1, C0,
    // -z 경사면
    A1, A0, C0, A1, C0, C1,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}
