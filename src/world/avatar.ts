import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeBubble, makeNameTag } from './labels';
import { angleDelta, damp } from '../core/util';

import { OUTFITS, type OutfitId } from '../data/outfits';
export { OUTFITS, OUTFIT_IDS, type OutfitId } from '../data/outfits';

const SKIN = 0xe6c6a0;
const TROUSER = 0x3b3a38;
const SHOE = 0x2a2623;
const SPROUT = 0x9cc46e;
const VEST = 0x6f7a3a;

const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });

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
function part(geos: THREE.BufferGeometry[]): THREE.Mesh {
  const m = new THREE.Mesh(mergeGeometries(geos, false)!, bodyMaterial);
  m.castShadow = true;
  return m;
}

export type Pose = 'idle' | 'walk' | 'sit';
export type Behavior = 'none' | 'lookup' | 'write' | 'crouch';

export interface AvatarOptions {
  outfit: OutfitId;
  name: string;
  researcher?: boolean;
  me?: boolean;
  badge?: string;
}

/**
 * 원작 캐릭터: 둥근 머리 위에 작은 새싹 두 장이 난 숲 산책자.
 * 3등신 정도의 단순한 몸, 점 눈, 털모자와 외투. (민머리·승복 아님)
 */
export class Avatar {
  readonly group = new THREE.Group();
  private rig = new THREE.Group();
  private torso!: THREE.Mesh;
  private head!: THREE.Group;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private legL!: THREE.Group;
  private legR!: THREE.Group;
  private tag: THREE.Sprite;
  readonly bubble: THREE.Sprite | null = null;
  private bubbleKind = '…';

  pose: Pose = 'idle';
  behavior: Behavior = 'none';
  yaw = 0;
  /** 걷는 빠르기(m/s): 다리 흔들림 속도에 사용 */
  speed = 0;
  /** 숨쉬기 중일 때 0(내쉼)~1(들이쉼), 아니면 -1 */
  breath = -1;
  private phase = Math.random() * 10;
  private t = Math.random() * 100;
  private sitBlend = 0;
  private walkBlend = 0;
  private crouch = 0;
  private headPitch = 0;
  private armRaise = 0;
  outfit: OutfitId;
  readonly isResearcher: boolean;

  constructor(private opts: AvatarOptions) {
    this.outfit = opts.outfit;
    this.isResearcher = !!opts.researcher;
    this.group.add(this.rig);
    this.build();
    this.tag = makeNameTag(opts.name, { badge: opts.badge, accent: this.isResearcher });
    this.tag.position.y = 1.62;
    this.group.add(this.tag);
    if (this.isResearcher) {
      this.bubble = makeBubble('…');
      this.bubble.position.y = 1.98;
      this.group.add(this.bubble);
    }
  }

  private build(): void {
    while (this.rig.children.length) {
      const c = this.rig.children[0];
      this.rig.remove(c);
      c.traverse((o) => {
        if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
      });
    }
    const o = OUTFITS[this.outfit];

    // 몸통: 외투
    const coat = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.3),
        new THREE.Vector2(0.2, 0.31),
        new THREE.Vector2(0.235, 0.38),
        new THREE.Vector2(0.215, 0.56),
        new THREE.Vector2(0.17, 0.74),
        new THREE.Vector2(0.11, 0.84),
        new THREE.Vector2(0.0, 0.86),
      ],
      14,
    );
    const torsoParts = [colored(coat, o.coat)];
    // 목도리
    torsoParts.push(colored(new THREE.TorusGeometry(0.125, 0.048, 8, 14).rotateX(Math.PI / 2).translate(0, 0.84, 0), o.scarf));
    // 외투 여밈 선과 단추
    torsoParts.push(colored(new THREE.BoxGeometry(0.018, 0.4, 0.02).translate(0, 0.56, 0.212), o.cap));
    for (const y of [0.48, 0.6, 0.71]) torsoParts.push(colored(new THREE.SphereGeometry(0.018, 6, 5).translate(0.03, y, 0.21 - (y - 0.48) * 0.16), o.scarf));
    if (this.isResearcher) {
      // 올리브색 조끼와 주머니
      const vest = new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.232, 0.44),
          new THREE.Vector2(0.238, 0.52),
          new THREE.Vector2(0.2, 0.7),
          new THREE.Vector2(0.15, 0.8),
          new THREE.Vector2(0.12, 0.82),
        ],
        14,
        0.25,
        Math.PI * 2 - 0.5,
      );
      torsoParts.push(colored(vest, VEST));
      torsoParts.push(colored(new THREE.BoxGeometry(0.09, 0.07, 0.02).translate(0.12, 0.53, 0.2), 0x59642e));
      torsoParts.push(colored(new THREE.BoxGeometry(0.09, 0.07, 0.02).translate(-0.12, 0.53, 0.2), 0x59642e));
    }
    this.torso = part(torsoParts);
    this.rig.add(this.torso);

    // 머리: 둥근 머리 + 털모자 + 점 눈 + 새싹 두 장
    this.head = new THREE.Group();
    this.head.position.y = 0.9;
    const R = 0.21;
    const hy = 0.15;
    const headParts = [colored(new THREE.SphereGeometry(R, 18, 14).translate(0, hy, 0), SKIN)];
    const cap = new THREE.SphereGeometry(R + 0.014, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.47).rotateX(-0.2).translate(0, hy + 0.006, 0);
    headParts.push(colored(cap, o.cap));
    headParts.push(colored(new THREE.TorusGeometry(R + 0.006, 0.026, 7, 20).rotateX(Math.PI / 2 - 0.2).translate(0, hy + 0.035, -0.006), o.coat));
    for (const s of [-1, 1]) {
      headParts.push(colored(new THREE.SphereGeometry(0.021, 8, 6).translate(s * 0.074, hy - 0.022, R - 0.014), 0x2a2420));
    }
    // 새싹
    headParts.push(colored(new THREE.CylinderGeometry(0.011, 0.014, 0.09, 5).translate(0, hy + R + 0.045, -0.03), SPROUT));
    for (const s of [-1, 1]) {
      const leaf = new THREE.SphereGeometry(0.06, 8, 6)
        .scale(1, 0.16, 0.56)
        .translate(0.055, 0, 0)
        .rotateZ(0.5)
        .rotateY(s < 0 ? Math.PI : 0)
        .translate(0, hy + R + 0.09, -0.03);
      headParts.push(colored(leaf, SPROUT));
    }
    this.head.add(part(headParts));
    this.rig.add(this.head);

    // 팔
    const makeArm = (side: number): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(side * 0.2, 0.76, 0);
      const parts = [
        colored(new THREE.CapsuleGeometry(0.055, 0.2, 3, 8).translate(0, -0.14, 0), o.coat),
        colored(new THREE.SphereGeometry(0.05, 8, 6).translate(0, -0.31, 0), SKIN),
      ];
      if (this.isResearcher && side < 0) {
        // 작은 기록판
        parts.push(colored(new THREE.BoxGeometry(0.17, 0.23, 0.016).translate(0.03, -0.33, 0.07), 0x8a6a45));
        parts.push(colored(new THREE.BoxGeometry(0.145, 0.19, 0.006).translate(0.03, -0.335, 0.081), 0xf1ecdc));
        parts.push(colored(new THREE.BoxGeometry(0.07, 0.022, 0.012).translate(0.03, -0.228, 0.084), 0x55595a));
      }
      const m = part(parts);
      g.add(m);
      g.rotation.z = side * 0.14;
      return g;
    };
    this.armL = makeArm(-1);
    this.armR = makeArm(1);
    this.rig.add(this.armL, this.armR);

    // 다리
    const makeLeg = (side: number): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(side * 0.085, 0.36, 0);
      g.add(
        part([
          colored(new THREE.CapsuleGeometry(0.068, 0.2, 3, 8).translate(0, -0.17, 0), TROUSER),
          colored(new THREE.SphereGeometry(0.075, 8, 6).scale(1, 0.62, 1.5).translate(0, -0.325, 0.03), SHOE),
        ]),
      );
      return g;
    };
    this.legL = makeLeg(-1);
    this.legR = makeLeg(1);
    this.rig.add(this.legL, this.legR);
  }

  setOutfit(id: OutfitId): void {
    if (id === this.outfit) return;
    this.outfit = id;
    this.build();
  }

  setBubble(kind: '…' | '?'): void {
    if (!this.bubble || this.bubbleKind === kind) return;
    this.bubbleKind = kind;
    const next = makeBubble(kind);
    const mat = this.bubble.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.map = (next.material as THREE.SpriteMaterial).map;
    mat.needsUpdate = true;
  }
  /** 말풍선 표시 정도 0~1 */
  setBubbleVisible(v: number): void {
    if (this.bubble) (this.bubble.material as THREE.SpriteMaterial).opacity = v;
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  /** 목표 방향으로 부드럽게 돌기 */
  turnToward(targetYaw: number, dt: number, rate = 9): void {
    this.yaw += angleDelta(this.yaw, targetYaw) * damp(rate, dt);
  }

  update(dt: number, calm = false): void {
    this.t += dt;
    const k = damp(7, dt);
    this.sitBlend += ((this.pose === 'sit' ? 1 : 0) - this.sitBlend) * k;
    this.walkBlend += ((this.pose === 'walk' ? 1 : 0) - this.walkBlend) * k;
    if (this.pose === 'walk') this.phase += dt * (4.2 + this.speed * 2.6);

    const sway = calm ? 0 : 1;
    const sw = Math.sin(this.phase) * this.walkBlend;
    const sit = this.sitBlend;

    // 연구원의 평소 동작(천천히 반복)
    let headPitchT = 0;
    let armRaiseT = 0;
    let crouchT = 0;
    if (this.behavior !== 'none' && this.pose === 'idle') {
      const cyc = (this.t * 0.11) % 1;
      if (this.behavior === 'lookup') {
        if (cyc < 0.62) headPitchT = -0.55 + Math.sin(this.t * 0.5) * 0.06;
        else {
          headPitchT = 0.34;
          armRaiseT = 1;
        }
      } else if (this.behavior === 'write') {
        headPitchT = cyc < 0.8 ? 0.36 : -0.3;
        armRaiseT = cyc < 0.8 ? 1 : 0.2;
      } else if (this.behavior === 'crouch') {
        crouchT = cyc < 0.7 ? 1 : 0;
        headPitchT = cyc < 0.7 ? 0.3 : -0.2;
        armRaiseT = cyc < 0.7 ? 0.2 : 1;
      }
    }
    const k2 = damp(2.4, dt);
    this.headPitch += (headPitchT - this.headPitch) * k2;
    this.armRaise += (armRaiseT - this.armRaise) * k2;
    this.crouch += (crouchT - this.crouch) * k2;

    // 숨: 어깨가 천천히 오르내림
    const idleBreath = Math.sin(this.t * 1.5) * 0.5 + 0.5;
    const br = this.breath >= 0 ? this.breath : idleBreath * 0.25;
    const lift = br * (this.breath >= 0 ? 0.028 : 0.01);

    const legFold = Math.max(sit, this.crouch);
    this.legL.rotation.x = -sw * 0.62 - legFold * 1.42;
    this.legR.rotation.x = sw * 0.62 - legFold * 1.42;
    this.legL.rotation.z = -sit * 0.06;
    this.legR.rotation.z = sit * 0.06;

    const writing = this.armRaise * Math.sin(this.t * 7) * 0.06;
    this.armL.rotation.x = sw * 0.5 - sit * 0.42 - this.armRaise * 1.05 - this.crouch * 0.3;
    this.armR.rotation.x = -sw * 0.5 - sit * 0.42 - this.armRaise * 0.9 + writing - this.crouch * 0.9 * (1 - this.armRaise);
    this.armL.rotation.z = -0.14 + this.armRaise * 0.3;
    this.armR.rotation.z = 0.14 - this.armRaise * 0.42;
    this.armL.position.y = 0.76 + lift;
    this.armR.position.y = 0.76 + lift;

    this.torso.scale.set(1 + br * 0.012, 1 + lift * 0.9, 1 + br * 0.03);
    this.torso.rotation.x = this.crouch * 0.42 + this.walkBlend * 0.05;
    this.head.position.y = 0.9 + lift * 1.2 - this.crouch * 0.03;
    this.head.position.z = this.crouch * 0.16;
    this.head.rotation.x = this.headPitch + sit * 0.02;
    this.head.rotation.z = sway * Math.sin(this.t * 0.6) * 0.025 * (1 - this.walkBlend);

    const bob = Math.abs(Math.sin(this.phase)) * 0.028 * this.walkBlend;
    this.rig.position.y = bob - this.crouch * 0.2;
    this.rig.rotation.z = sway * sit * Math.sin(this.t * 0.7) * 0.02;
    this.group.rotation.y = this.yaw;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    const tm = this.tag.material as THREE.SpriteMaterial;
    tm.map?.dispose();
    tm.dispose();
  }
}

/** 앉았을 때 엉덩이 높이(다리가 시작하는 높이) */
export const HIP_HEIGHT = 0.36;
