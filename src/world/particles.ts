import * as THREE from 'three';
import { makeRng } from '../core/util';
import type { SeasonPalette } from '../scenes/seasons';
import { softDotTexture } from './labels';

/**
 * 천천히 떨어지는 낙엽: 카메라 둘레의 상자 안에서만 돌려 씁니다.
 */
export class FallingLeaves {
  readonly mesh: THREE.InstancedMesh;
  private data: Array<{ x: number; y: number; z: number; vy: number; ph: number; spin: number; s: number }> = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private readonly box = { w: 44, h: 16, d: 44 };

  constructor(season: SeasonPalette, count: number) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-0.09, 0, 0, 0, 0, 0.055, 0.09, 0, 0, -0.09, 0, 0, 0.09, 0, 0, 0, 0, -0.055], 3),
    );
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'falling-leaves';
    const rnd = makeRng(555);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      this.data.push({
        x: (rnd() - 0.5) * this.box.w,
        y: rnd() * this.box.h,
        z: (rnd() - 0.5) * this.box.d,
        vy: 0.45 + rnd() * 0.5,
        ph: rnd() * 10,
        spin: 0.6 + rnd() * 1.4,
        s: 0.5 + rnd() * 0.55,
      });
      c.set(season.fallenLeaves[Math.floor(rnd() * season.fallenLeaves.length)]);
      this.mesh.setColorAt(i, c);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number, t: number, center: THREE.Vector3, groundY: (x: number, z: number) => number): void {
    const { w, h, d } = this.box;
    for (let i = 0; i < this.data.length; i++) {
      const L = this.data[i];
      L.y -= L.vy * dt;
      L.x += (Math.sin(t * 0.7 + L.ph) * 0.5 + 0.35) * dt;
      L.z += Math.cos(t * 0.5 + L.ph * 1.3) * 0.3 * dt;
      // 카메라 둘레 상자 안으로 되감기
      let wx = center.x + L.x;
      let wz = center.z + L.z;
      if (L.x > w / 2) L.x -= w;
      if (L.x < -w / 2) L.x += w;
      if (L.z > d / 2) L.z -= d;
      if (L.z < -d / 2) L.z += d;
      wx = center.x + L.x;
      wz = center.z + L.z;
      const gy = groundY(wx, wz);
      let wy = gy + L.y;
      if (L.y < 0.05) {
        L.y = h * (0.6 + Math.random() * 0.4);
        wy = gy + L.y;
      }
      this.e.set(t * L.spin + L.ph, t * 0.4 + L.ph, Math.sin(t * L.spin * 0.7 + L.ph) * 1.2);
      this.q.setFromEuler(this.e);
      this.m.compose(this.p.set(wx, wy, wz), this.q, this.sc.set(L.s, L.s, L.s));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** 불빛 근처를 떠다니는 작은 빛 입자 */
export class LightMotes {
  readonly points: THREE.Points;
  private base: Float32Array;
  private ph: Float32Array;

  constructor(lampHeads: THREE.Vector3[], season: SeasonPalette, perLamp = 7) {
    const rnd = makeRng(808);
    const n = lampHeads.length * perLamp;
    this.base = new Float32Array(n * 3);
    this.ph = new Float32Array(n);
    let k = 0;
    for (const hd of lampHeads) {
      for (let i = 0; i < perLamp; i++) {
        const a = rnd() * Math.PI * 2;
        const r = 0.4 + rnd() * 2.2;
        this.base[k * 3] = hd.x + Math.cos(a) * r;
        this.base[k * 3 + 1] = hd.y - 0.4 + rnd() * 1.6;
        this.base[k * 3 + 2] = hd.z + Math.sin(a) * r;
        this.ph[k] = rnd() * 20;
        k++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.base.slice(), 3));
    const mat = new THREE.PointsMaterial({
      map: softDotTexture(),
      color: season.lamp,
      size: 0.11,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = 'light-motes';
  }

  update(t: number): void {
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < this.ph.length; i++) {
      const p = this.ph[i];
      arr[i * 3] = this.base[i * 3] + Math.sin(t * 0.35 + p) * 0.35;
      arr[i * 3 + 1] = this.base[i * 3 + 1] + Math.sin(t * 0.5 + p * 1.7) * 0.3;
      arr[i * 3 + 2] = this.base[i * 3 + 2] + Math.cos(t * 0.3 + p * 0.6) * 0.35;
    }
    pos.needsUpdate = true;
  }
}
