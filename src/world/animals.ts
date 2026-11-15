import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ANIMALS, type AnimalDef } from '../scenes/daejeon/layout';
import { angleDelta, clamp, damp } from '../core/util';

/**
 * 숲의 작은 친구들: 고양이와 다람쥐.
 * 모두 코드로 만든 로우폴리 모델이며, 말을 걸거나 따라오지 않고 제자리에서 조용히 지냅니다.
 *  - 고양이: 앉거나 식빵 자세로 쉬면서 꼬리를 흔들고, 가까이 가면 고개를 돌려 바라봄
 *  - 다람쥐: 도토리를 갉다가 나무 둘레를 총총 옮겨 다니고, 가까이 가면 살짝 물러남
 */

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });

function colored(g: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
  const n = geo.getAttribute('position').count;
  const c = new THREE.Color(color);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function mesh(parts: THREE.BufferGeometry[]): THREE.Mesh {
  const m = new THREE.Mesh(mergeGeometries(parts, false)!, material);
  m.castShadow = true;
  return m;
}
const sph = (r: number, w = 10, hgt = 8): THREE.SphereGeometry => new THREE.SphereGeometry(r, w, hgt);

interface Coat {
  coat: number;
  chest: number;
  paw: number;
  tip: number;
}
const CAT_COATS: Record<string, Coat> = {
  // 치즈(노란 줄무늬), 고등어(회색), 삼색에 가까운 흰 바탕
  cheese: { coat: 0xd3924c, chest: 0xf2e3c4, paw: 0xf2e3c4, tip: 0xb9773a },
  gray: { coat: 0x7f8286, chest: 0xd9d6cf, paw: 0xe6e3dc, tip: 0x5c5f63 },
  white: { coat: 0xe9e3d6, chest: 0xf4efe4, paw: 0xf4efe4, tip: 0x4a3f38 },
};

function catHead(c: Coat): THREE.Group {
  const g = new THREE.Group();
  const parts = [
    colored(sph(0.09, 12, 10).scale(1.05, 0.92, 0.95), c.coat),
    colored(sph(0.04).scale(1.2, 0.8, 0.8).translate(0, -0.025, 0.066), c.chest),
    colored(sph(0.011, 6, 5).translate(0, -0.012, 0.102), 0xc98a80),
  ];
  for (const s of [-1, 1]) {
    parts.push(colored(sph(0.013, 7, 6).translate(s * 0.036, 0.012, 0.076), 0x2a2a22));
    parts.push(colored(new THREE.ConeGeometry(0.036, 0.07, 4).rotateZ(-s * 0.25).translate(s * 0.052, 0.086, -0.005), c.coat));
    parts.push(colored(new THREE.ConeGeometry(0.02, 0.04, 4).rotateZ(-s * 0.25).translate(s * 0.052, 0.08, 0.012), 0xd9a79a));
  }
  g.add(mesh(parts));
  return g;
}

interface Built {
  root: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Group;
  tail: THREE.Group;
}

function buildCat(def: AnimalDef): Built {
  const c = CAT_COATS[def.coat] || CAT_COATS.cheese;
  const root = new THREE.Group();
  const tail = new THREE.Group();
  const head = catHead(c);
  const seg = (): THREE.BufferGeometry => new THREE.CapsuleGeometry(0.022, 0.1, 3, 6).rotateZ(Math.PI / 2);
  let body: THREE.Mesh;
  if (def.pose === 'loaf') {
    // 식빵 자세
    const parts = [
      colored(sph(0.13, 12, 8).scale(1.0, 0.78, 1.65).translate(0, 0.1, 0), c.coat),
      colored(sph(0.08).scale(1.1, 0.8, 0.6).translate(0, 0.085, 0.18), c.chest),
    ];
    for (const s of [-1, 1]) parts.push(colored(sph(0.035, 8, 6).scale(1.2, 0.6, 1.2).translate(s * 0.05, 0.025, 0.2), c.paw));
    body = mesh(parts);
    head.position.set(0, 0.185, 0.2);
    tail.position.set(0.06, 0.035, -0.19);
    tail.add(
      mesh([
        colored(seg().rotateY(-0.5).translate(0.07, 0, 0.035), c.coat),
        colored(seg().rotateY(-1.25).translate(0.135, 0, 0.125), c.coat),
        colored(sph(0.026, 8, 6).translate(0.152, 0, 0.19), c.tip),
      ]),
    );
  } else {
    // 앉은 자세
    const parts = [
      colored(sph(0.125, 12, 8).scale(1.05, 0.95, 1.2).translate(0, 0.115, -0.04), c.coat),
      colored(sph(0.1, 12, 8).scale(0.95, 1.55, 0.95).rotateX(0.28).translate(0, 0.215, 0.045), c.coat),
      colored(sph(0.07).scale(0.9, 1.3, 0.6).translate(0, 0.2, 0.105), c.chest),
    ];
    for (const s of [-1, 1]) {
      parts.push(colored(new THREE.CylinderGeometry(0.026, 0.03, 0.2, 6).translate(s * 0.045, 0.1, 0.115), c.coat));
      parts.push(colored(sph(0.034, 8, 6).scale(1, 0.6, 1.3).translate(s * 0.045, 0.02, 0.13), c.paw));
      parts.push(colored(sph(0.04, 8, 6).scale(1, 0.5, 1.6).translate(s * 0.1, 0.022, 0.04), c.paw));
    }
    body = mesh(parts);
    head.position.set(0, 0.375, 0.085);
    tail.position.set(0, 0.03, -0.15);
    tail.add(
      mesh([
        colored(seg().translate(0.07, 0, 0), c.coat),
        colored(seg().rotateY(-0.9).translate(0.165, 0, 0.045), c.coat),
        colored(sph(0.026, 8, 6).translate(0.215, 0, 0.1), c.tip),
      ]),
    );
  }
  root.add(body, head, tail);
  root.scale.setScalar(1.15);
  return { root, body, head, tail };
}

function buildSquirrel(): Built {
  const BROWN = 0xa06d3c;
  const DARK = 0x5b3b22;
  const CREAM = 0xeedfc2;
  const root = new THREE.Group();
  const parts = [
    colored(sph(0.055).scale(0.95, 1.35, 1.0).rotateX(0.15).translate(0, 0.085, 0), BROWN),
    colored(sph(0.04, 8, 6).scale(0.8, 1.3, 0.5).translate(0, 0.085, 0.036), CREAM),
    colored(sph(0.016, 6, 5).translate(0, 0.116, 0.07), 0x8a5a2a),
  ];
  // 등줄무늬
  for (const x of [-0.02, 0, 0.02]) {
    parts.push(colored(new THREE.BoxGeometry(0.011, 0.1, 0.012).rotateX(0.15).translate(x, 0.098, -0.05 + Math.abs(x) * 0.2), DARK));
  }
  for (const s of [-1, 1]) {
    parts.push(colored(sph(0.022, 7, 5).scale(1, 0.5, 1.6).translate(s * 0.04, 0.012, 0.02), DARK));
    parts.push(colored(new THREE.CapsuleGeometry(0.011, 0.03, 2, 5).rotateX(-1.0).translate(s * 0.025, 0.105, 0.048), BROWN));
  }
  const body = mesh(parts);

  const head = new THREE.Group();
  head.position.set(0, 0.17, 0.02);
  const hp = [
    colored(sph(0.042).scale(1, 0.95, 1.1), BROWN),
    colored(sph(0.02, 7, 5).translate(0, -0.008, 0.04), CREAM),
  ];
  for (const s of [-1, 1]) {
    hp.push(colored(sph(0.008, 6, 5).translate(s * 0.022, 0.008, 0.032), 0x1f1a16));
    hp.push(colored(new THREE.ConeGeometry(0.014, 0.03, 4).translate(s * 0.022, 0.042, -0.005), DARK));
  }
  head.add(mesh(hp));

  const tail = new THREE.Group();
  tail.position.set(0, 0.03, -0.045);
  tail.add(
    mesh([
      colored(sph(0.04).scale(0.9, 1.4, 0.9).translate(0, 0.06, -0.035), BROWN),
      colored(sph(0.05).scale(0.85, 1.3, 0.85).translate(0, 0.15, -0.046), BROWN),
      colored(sph(0.04, 8, 6).translate(0, 0.216, -0.02), 0xc79a63),
    ]),
  );
  root.add(body, head, tail);
  root.scale.setScalar(1.55);
  return { root, body, head, tail };
}

interface AnimalRT {
  def: AnimalDef;
  b: Built;
  x: number;
  z: number;
  baseY: number;
  yaw: number;
  ph: number;
  headYaw: number;
  // 다람쥐
  state: 'idle' | 'hop';
  timer: number;
  spot: number;
  fx: number;
  fz: number;
  tx: number;
  tz: number;
  k: number;
  speed: number;
  pitch: number;
}

export interface Animals {
  group: THREE.Group;
  update(dt: number, t: number, player: THREE.Vector3, calm: boolean): void;
}

export function buildAnimals(groundY: (x: number, z: number) => number): Animals {
  const group = new THREE.Group();
  group.name = 'animals';
  const list: AnimalRT[] = [];
  const yAt = (def: AnimalDef, x: number, z: number): number => (def.y !== undefined ? def.y : groundY(x, z) + (def.lift || 0));

  ANIMALS.forEach((def, i) => {
    const b = def.kind === 'cat' ? buildCat(def) : buildSquirrel();
    const start = def.spots && def.spots.length ? def.spots[0] : ([def.x, def.z] as [number, number]);
    const yaw = def.look ? Math.atan2(def.look[0] - start[0], def.look[1] - start[1]) : i * 1.7;
    const a: AnimalRT = {
      def,
      b,
      x: start[0],
      z: start[1],
      baseY: yAt(def, start[0], start[1]),
      yaw,
      ph: i * 2.37,
      headYaw: 0,
      state: 'idle',
      timer: 2 + i * 1.3,
      spot: 0,
      fx: start[0],
      fz: start[1],
      tx: start[0],
      tz: start[1],
      k: 0,
      speed: 2.4,
      pitch: 0,
    };
    b.root.position.set(a.x, a.baseY, a.z);
    b.root.rotation.y = yaw;
    group.add(b.root);
    list.push(a);
  });

  const hopTo = (a: AnimalRT, idx: number, speed: number): void => {
    const spots = a.def.spots!;
    a.spot = idx;
    a.fx = a.x;
    a.fz = a.z;
    a.tx = spots[idx][0];
    a.tz = spots[idx][1];
    a.k = 0;
    a.speed = speed;
    a.state = 'hop';
  };

  return {
    group,
    update(dt, t, player, calm) {
      for (const a of list) {
        const { b } = a;
        const dx = player.x - a.x;
        const dz = player.z - a.z;
        const near = Math.abs(player.y - a.baseY) < 3 ? Math.hypot(dx, dz) : 99;

        if (a.def.kind === 'cat') {
          // 숨, 꼬리 흔들기
          b.body.scale.y = 1 + Math.sin(t * 1.4 + a.ph) * 0.012;
          b.tail.rotation.y = calm ? 0 : Math.sin(t * 1.2 + a.ph) * 0.22 + Math.sin(t * 0.37 + a.ph) * 0.12;
          // 가까이 가면 고개를 돌려 바라봄, 아니면 천천히 둘러봄
          let target = Math.sin(t * 0.23 + a.ph) * 0.45;
          if (near < 4.5) target = clamp(angleDelta(a.yaw, Math.atan2(dx, dz)), -1.15, 1.15);
          a.headYaw += (target - a.headYaw) * damp(near < 4.5 ? 3 : 1.2, dt);
          b.head.rotation.y = a.headYaw;
          b.head.rotation.z = Math.sin(t * 0.31 + a.ph) * 0.04;
          continue;
        }

        // 다람쥐
        const spots = a.def.spots;
        if (a.state === 'idle') {
          a.timer -= dt;
          b.head.rotation.x = Math.sin(t * 9 + a.ph) * 0.07;
          b.tail.rotation.x = Math.sin(t * 2.1 + a.ph) * 0.07 + Math.max(0, Math.sin(t * 0.9 + a.ph) - 0.93) * 3;
          a.pitch += (0 - a.pitch) * damp(8, dt);
          if (spots && spots.length > 1 && !calm) {
            if (near < 2.6) {
              // 가까이 오면 가장 먼 자리로 살짝 물러남
              let best = a.spot;
              let bd = -1;
              spots.forEach((s, i) => {
                const d = Math.hypot(s[0] - player.x, s[1] - player.z);
                if (d > bd) {
                  bd = d;
                  best = i;
                }
              });
              if (best !== a.spot) hopTo(a, best, 3.6);
            } else if (a.timer <= 0) {
              let next = Math.floor(Math.random() * spots.length);
              if (next === a.spot) next = (next + 1) % spots.length;
              hopTo(a, next, 2.3);
            }
          }
        } else {
          const len = Math.hypot(a.tx - a.fx, a.tz - a.fz) || 1;
          a.k = Math.min(1, a.k + (a.speed * dt) / len);
          a.x = a.fx + (a.tx - a.fx) * a.k;
          a.z = a.fz + (a.tz - a.fz) * a.k;
          const hops = Math.max(2, Math.round(len / 0.5));
          const hop = Math.abs(Math.sin(a.k * Math.PI * hops));
          a.baseY = yAt(a.def, a.x, a.z);
          a.yaw += angleDelta(a.yaw, Math.atan2(a.tx - a.fx, a.tz - a.fz)) * damp(14, dt);
          a.pitch += (0.5 - a.pitch) * damp(10, dt);
          b.tail.rotation.x = -0.9 + hop * 0.3;
          b.head.rotation.x = -0.3;
          b.root.position.set(a.x, a.baseY + hop * 0.1, a.z);
          b.root.rotation.set(a.pitch, a.yaw, 0, 'YXZ');
          if (a.k >= 1) {
            a.state = 'idle';
            a.timer = 2.5 + Math.random() * 5;
          }
          continue;
        }
        b.root.position.set(a.x, a.baseY + Math.abs(Math.sin(t * 4.5 + a.ph)) * 0.004, a.z);
        b.root.rotation.set(a.pitch, a.yaw, 0, 'YXZ');
      }
    },
  };
}
