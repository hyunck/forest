import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ACTIVE_SEASON } from '../scenes/seasons';
import { buildDaejeonWorld, type World } from '../scenes/daejeon/DaejeonScene';
import {
  BUILDINGS,
  CABINS,
  DECK_PLATFORM,
  ELEVATOR,
  PLACES,
  RESEARCHERS,
  SPAWN,
  type Level,
  type ResearcherDef,
} from '../scenes/daejeon/layout';
import { Avatar, HIP_HEIGHT, type OutfitId } from '../world/avatar';
import type { NavPoint, Waypoint } from '../world/nav';
import type { SeatRT } from '../world/props';
import { softDotTexture } from '../world/labels';
import { angleDelta, clamp, damp, easeInOut, isMobile, lerp, prefersReducedMotion, smoothstep } from '../core/util';
import { audio } from '../core/audio';
import { track } from '../core/metrics';
import { COPY } from '../data/copy';
import type { PeerState, PresenceProvider } from '../presence/PresenceProvider';

export interface GameEvents {
  onPlace(id: string): void;
  onSeated(seated: boolean): void;
  onResearcher(id: string): void;
  onSign(id: string): void;
  onToast(text: string): void;
  onFirstMove(): void;
  onUserInput(): void;
  /** 화면을 잠깐 어둡게 했다가 mid에서 장면을 바꾸고 다시 밝힘 */
  requestFade(mid: () => void): void;
}

interface PeerView {
  avatar: Avatar;
  x: number;
  z: number;
  level: Level;
  tx: number;
  tz: number;
  seat: string | null;
}

interface ResearcherRT {
  def: ResearcherDef;
  avatar: Avatar;
  pos: THREE.Vector3;
  baseYaw: number;
  talk: number;
  bubble: number;
}

type Mode = 'free' | 'seating' | 'sitting' | 'elevator';
type Pending = { type: 'sit'; seat: SeatRT } | { type: 'researcher'; id: string } | { type: 'sign'; id: string } | null;

const WALK_SPEED = 2.25;

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export class ForestGame {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly world: World;
  readonly player: Avatar;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;

  private running = false;
  private raf = 0;
  private last = 0;
  private time = 0;
  /** 숲에 머문 시간(초) */
  stayedSeconds = 0;
  seatedSeconds = 0;
  private sitStart = 0;

  // 아바타 상태
  private pos = new THREE.Vector3();
  private level: Level = 0;
  private navPt: NavPoint;
  private path: Waypoint[] = [];
  private speedMul = 1;
  private mode: Mode = 'free';
  private pending: Pending = null;
  private seat: SeatRT | null = null;
  /** 카메라가 풍경 구도를 잡는 기준 자리(일어난 뒤에도 구도가 풀릴 때까지 유지) */
  private camSeat: SeatRT | null = null;
  private seatFrom = new THREE.Vector3();
  private seatTo = new THREE.Vector3();
  private seatT = 0;
  private seatDir = 1;
  private seatYaw = 0;
  private afterStand: (() => void) | null = null;
  private elevatorArmed = true;
  private elevT = 0;
  private elevDir = 1;
  private stepClock = 0;
  private moved = false;
  private lastPlace = '';
  private tick = 0;
  breathing = false;

  // 카메라
  private camYaw = 0;
  private camPitch = 0.26;
  private camDist = 5.2;
  private zoom = 1;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private seatedBlend = 0;
  private seatedYawOffset = 0;
  private lastDrag = -10;
  private elevBlend = 0;
  private boxes: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; maxY: number }> = [];

  // 입력
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; moved: boolean }>();
  private pinch = 0;
  private keys = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();

  // 표시
  private marker: THREE.Mesh;
  private markerLife = 0;
  private seatGlows: THREE.Sprite[] = [];
  private peers = new Map<string, PeerView>();
  private researchers: ResearcherRT[] = [];
  quizPending = false;

  // 성능
  private fpsFrames = 0;
  private fpsTime = 0;
  fps = 60;
  private probeTime = 0;
  private probeFrames = 0;
  private probed = false;
  lowQuality = false;

  private disposers: Array<() => void> = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private events: GameEvents,
    private presence: PresenceProvider,
    opts: { outfit: OutfitId; name: string },
  ) {
    const season = ACTIVE_SEASON;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = season.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.3, 1400);
    this.world = buildDaejeonWorld(season, { mobile: isMobile, reducedMotion: prefersReducedMotion });

    // 내 아바타
    this.player = new Avatar({ outfit: opts.outfit, name: opts.name, me: true, badge: COPY.forest.meBadge });
    this.world.scene.add(this.player.group);
    this.navPt = this.world.nav.clampTo(SPAWN.x, SPAWN.z, 0);
    this.pos.set(this.navPt.x, this.world.nav.heightAt(this.navPt.x, this.navPt.z, 0), this.navPt.z);
    this.camYaw = Math.atan2(SPAWN.lookX - SPAWN.x, SPAWN.lookZ - SPAWN.z);
    this.player.yaw = this.camYaw;
    this.player.setPosition(this.pos.x, this.pos.y, this.pos.z);

    // 숲지기 연구원
    for (const def of RESEARCHERS) {
      const av = new Avatar({ outfit: 'beige', name: COPY.forest.researcherName, researcher: true });
      const y = this.world.nav.heightAt(def.x, def.z, def.level);
      av.setPosition(def.x, y, def.z);
      av.yaw = Math.atan2(def.look[0] - def.x, def.look[1] - def.z);
      av.behavior = def.behavior;
      this.world.scene.add(av.group);
      this.researchers.push({ def, avatar: av, pos: new THREE.Vector3(def.x, y, def.z), baseYaw: av.yaw, talk: 0, bubble: 0 });
    }

    // 누른 자리 표시
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.26, 0.4, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: season.lamp,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
    this.marker.renderOrder = 4;
    this.world.scene.add(this.marker);

    // 앉을 자리의 은은한 빛
    for (const s of this.world.seats) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: softDotTexture(),
          color: season.lamp,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      sp.scale.set(0.62, 0.62, 1);
      sp.position.copy(s.pos).add(new THREE.Vector3(0, 0.42, 0));
      this.world.scene.add(sp);
      this.seatGlows.push(sp);
    }

    // 카메라가 건물 안으로 들어가지 않게 하는 상자
    for (const b of BUILDINGS) {
      const gy = this.world.terrain.groundY(b.x, b.z);
      this.boxes.push({ minX: b.x - b.w / 2 - 0.6, maxX: b.x + b.w / 2 + 0.6, minZ: b.z - b.d / 2 - 0.6, maxZ: b.z + b.d / 2 + 0.6, maxY: gy + b.wallH + b.roofH + 0.5 });
    }
    for (const c of CABINS) {
      const gy = this.world.terrain.groundY(c.x, c.z);
      this.boxes.push({ minX: c.x - 3.2, maxX: c.x + 3.2, minZ: c.z - 3, maxZ: c.z + 3, maxY: gy + 5.4 });
    }

    // 시연용 방문자
    this.presence.onPeersChanged((list) => this.syncPeers(list));

    // 후처리: 아주 약한 블룸 (휴대폰·저사양에서는 끔)
    if (!isMobile) this.setupComposer();

    this.bindInput();
    this.resize();
    this.snapCamera();
  }

  private setupComposer(): void {
    try {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.world.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.34, 0.7, 0.82);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    } catch {
      this.composer = null;
    }
  }

  // ------------------------------------------------------------ 입력

  private bindInput(): void {
    const cv = this.canvas;
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, type: K | string, fn: (e: never) => void, opt?: AddEventListenerOptions): void => {
      el.addEventListener(type, fn as EventListener, opt);
      this.disposers.push(() => el.removeEventListener(type, fn as EventListener, opt));
    };

    on(cv, 'pointerdown', (e: PointerEvent) => {
      this.events.onUserInput();
      audio.start();
      cv.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    on(cv, 'pointermove', (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 9) p.moved = true;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch > 0) this.zoom = clamp(this.zoom * (this.pinch / d), 0.65, 1.6);
        this.pinch = d;
        return;
      }
      if (p.moved) {
        // 화면 드래그로 시선 돌리기(선택 기능)
        if (this.mode === 'sitting') {
          this.seatedYawOffset = clamp(this.seatedYawOffset - dx * 0.004, -0.9, 0.9);
        } else {
          this.camYaw -= dx * 0.0055;
          this.camPitch = clamp(this.camPitch + dy * 0.0035, 0.06, 0.8);
        }
        this.lastDrag = this.time;
      }
    });
    const up = (e: PointerEvent): void => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = 0;
      if (!p || e.type === 'pointercancel') return;
      if (!p.moved && performance.now() - p.t < 600) this.handleTap(e.clientX, e.clientY);
    };
    on(cv, 'pointerup', up);
    on(cv, 'pointercancel', up);
    on(cv, 'wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.zoom = clamp(this.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.65, 1.6);
    }, { passive: false });
    on(cv, 'contextmenu', (e: Event) => e.preventDefault());

    on(window, 'keydown', (e: KeyboardEvent) => {
      if (!this.running) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        this.keys.add(k);
        this.events.onUserInput();
        audio.start();
        e.preventDefault();
      }
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => this.keys.clear());
    on(window, 'resize', () => this.resize());
  }

  private handleTap(cx: number, cy: number): void {
    if (this.mode === 'elevator' || this.breathing) return;
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const ray = this.raycaster.ray;

    // 땅과 데크
    let groundT = Infinity;
    let groundPoint: THREE.Vector3 | null = null;
    let groundLevel: Level = 0;
    const hit = this.world.terrain.raycast(ray.origin, ray.direction);
    if (hit) {
      groundT = hit.distanceTo(ray.origin);
      groundPoint = hit;
    }
    const tmp = new THREE.Vector3();
    for (const tri of this.world.deckTris) {
      const p = ray.intersectTriangle(tri.a, tri.b, tri.c, false, tmp);
      if (p) {
        const d = p.distanceTo(ray.origin);
        if (d < groundT) {
          groundT = d;
          groundPoint = p.clone();
          groundLevel = 1;
        }
      }
    }

    // 연구원·표찰·빈 자리 (누르는 영역을 넉넉하게)
    type Pick = { t: number; kind: 'researcher' | 'sign' | 'seat'; id: string; seat?: SeatRT };
    let best: Pick | null = null;
    const sphere = new THREE.Sphere();
    const test = (center: THREE.Vector3, r: number, kind: Pick['kind'], id: string, seat?: SeatRT): void => {
      sphere.set(center, r);
      const p = ray.intersectSphere(sphere, tmp);
      if (!p) return;
      const t = p.distanceTo(ray.origin);
      if (t > groundT + 2.5) return;
      if (!best || t < best.t) best = { t, kind, id, seat };
    };
    const c = new THREE.Vector3();
    for (const r of this.researchers) test(c.copy(r.pos).setY(r.pos.y + 0.85), 1.25, 'researcher', r.def.id);
    for (const s of this.world.signs) test(s.pos, 0.75, 'sign', s.id);
    for (const s of this.world.seats) {
      if (!s.occupied && s !== this.seat) test(c.copy(s.pos).setY(s.pos.y + 0.25), 0.8, 'seat', s.def.id, s);
    }

    const picked = best as Pick | null;
    if (picked) {
      if (picked.kind === 'researcher') this.approach('researcher', picked.id);
      else if (picked.kind === 'sign') this.approach('sign', picked.id);
      else if (picked.seat) this.walkToSeat(picked.seat);
      return;
    }
    if (groundPoint) {
      const target = this.world.nav.clampTo(groundPoint.x, groundPoint.z, groundLevel);
      this.walkTo(target, null);
      this.showMarker(target);
    }
  }

  // ------------------------------------------------------------ 이동

  private noteMoved(): void {
    if (!this.moved) {
      this.moved = true;
      this.events.onFirstMove();
    }
  }

  private setPath(target: NavPoint, pending: Pending, trim = 0): void {
    let path = this.world.nav.findPath(this.navPt, target);
    if (trim > 0 && path.length) {
      // 마지막 구간을 조금 남기고 멈춤(연구원·표찰 앞에 섬)
      const lastP = path[path.length - 1];
      const prev = path.length > 1 ? path[path.length - 2] : { x: this.pos.x, z: this.pos.z };
      const d = Math.hypot(lastP.x - prev.x, lastP.z - prev.z);
      if (d > trim + 0.2) {
        const k = (d - trim) / d;
        path[path.length - 1] = { ...lastP, x: prev.x + (lastP.x - prev.x) * k, z: prev.z + (lastP.z - prev.z) * k };
      } else if (path.length > 1) {
        path = path.slice(0, -1);
      } else {
        path = [];
      }
    }
    this.path = path;
    this.pending = pending;
    if (!path.length) this.arrive();
  }

  /** 누른 곳으로 걸어가기 */
  private walkTo(target: NavPoint, pending: Pending, trim = 0): void {
    this.noteMoved();
    this.speedMul = 1;
    const go = (): void => this.setPath(target, pending, trim);
    if (this.mode === 'sitting' || this.mode === 'seating') {
      this.afterStand = go;
      this.standUp();
    } else if (this.mode === 'free') {
      go();
    }
  }

  private showMarker(p: NavPoint): void {
    this.marker.position.set(p.x, this.world.nav.heightAt(p.x, p.z, p.level) + 0.09, p.z);
    this.markerLife = 1;
  }

  private approach(kind: 'researcher' | 'sign', id: string): void {
    const pos = kind === 'researcher' ? this.researchers.find((r) => r.def.id === id)!.pos : this.world.signs.find((s) => s.id === id)!.pos;
    const lvl: Level = kind === 'researcher' ? this.researchers.find((r) => r.def.id === id)!.def.level : pos.y > 10 ? 1 : 0;
    const near = lvl === this.level && Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z) < 7.5;
    if (near && this.mode !== 'seating') {
      this.open(kind, id);
      return;
    }
    const target = this.world.nav.clampTo(pos.x, pos.z, lvl);
    this.walkTo(target, { type: kind, id }, kind === 'researcher' ? 1.7 : 1.3);
  }

  private open(kind: 'researcher' | 'sign', id: string): void {
    if (kind === 'researcher') {
      const r = this.researchers.find((x) => x.def.id === id)!;
      r.talk = 7;
      if (this.mode === 'free') this.player.yaw = Math.atan2(r.pos.x - this.pos.x, r.pos.z - this.pos.z);
      this.events.onResearcher(id);
    } else {
      this.events.onSign(id);
    }
  }

  private arrive(): void {
    this.markerLife = Math.min(this.markerLife, 0.25);
    this.speedMul = 1;
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    if (p.type === 'sit') this.beginSeat(p.seat);
    else this.open(p.type, p.id);
  }

  // ------------------------------------------------------------ 앉기

  get isSeated(): boolean {
    return this.mode === 'sitting' || (this.mode === 'seating' && this.seatDir === 1);
  }

  /** 앉기 버튼: 근처(약 5m)의 가장 가까운 빈 자리로. 없으면 안내와 함께 가장 가까운 자리로 */
  toggleSit(): void {
    if (this.mode === 'elevator') return;
    if (this.mode === 'sitting' || (this.mode === 'seating' && this.seatDir === 1)) {
      this.standUp();
      return;
    }
    const free = this.world.seats.filter((s) => !s.occupied);
    let best: SeatRT | null = null;
    let bd = Infinity;
    for (const s of free) {
      if (s.def.level !== this.level) continue;
      const d = Math.hypot(s.pos.x - this.pos.x, s.pos.z - this.pos.z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (!best || bd > 5.5) {
      // 길을 따라 가장 가까운 자리
      this.events.onToast(COPY.forest.sitHint);
      let bl = Infinity;
      for (const s of free) {
        const target = this.world.nav.clampTo(s.pos.x, s.pos.z, s.def.level);
        const len = this.world.nav.pathLength(this.pos, this.world.nav.findPath(this.navPt, target));
        if (len < bl) {
          bl = len;
          best = s;
        }
      }
    }
    if (best) this.walkToSeat(best);
  }

  private walkToSeat(seat: SeatRT): void {
    const target = this.world.nav.clampTo(seat.pos.x, seat.pos.z, seat.def.level);
    this.walkTo(target, { type: 'sit', seat });
  }

  private beginSeat(seat: SeatRT): void {
    if (seat.occupied) return;
    this.seat = seat;
    this.camSeat = seat;
    this.mode = 'seating';
    this.seatDir = 1;
    this.seatT = 0;
    this.seatFrom.copy(this.pos);
    this.seatTo.set(seat.pos.x, seat.pos.y - HIP_HEIGHT + 0.03, seat.pos.z);
    this.seatYaw = seat.yaw;
    this.seatedYawOffset = 0;
    this.sitStart = this.time;
    this.events.onSeated(true);
    this.presence.updateSeat(seat.def.id, { x: seat.pos.x, z: seat.pos.z, level: seat.def.level });
  }

  standUp(): void {
    if (!this.seat || (this.mode !== 'sitting' && this.mode !== 'seating')) return;
    if (this.mode === 'seating' && this.seatDir === -1) return;
    const seat = this.seat;
    const back = this.world.nav.clampTo(seat.pos.x, seat.pos.z, seat.def.level);
    this.seatFrom.copy(this.pos);
    this.seatTo.set(back.x, this.world.nav.heightAt(back.x, back.z, back.level), back.z);
    this.mode = 'seating';
    this.seatDir = -1;
    this.seatT = 0;
    const seconds = Math.round(this.time - this.sitStart);
    track('sit', { seat: seat.def.id, seconds });
    this.events.onSeated(false);
    this.presence.updateSeat(null, { x: back.x, z: back.z, level: back.level });
  }

  // ------------------------------------------------------------ 장소 바로가기

  goToPlace(id: string): void {
    const place = PLACES.find((p) => p.id === id);
    if (!place || this.mode === 'elevator') return;
    this.noteMoved();
    const target = this.world.nav.nodePoint(place.node);
    const run = (): void => {
      const path = this.world.nav.findPath(this.navPt, target);
      const total = this.world.nav.pathLength(this.pos, path);
      if (prefersReducedMotion) {
        // 움직임 줄이기: 걷는 대신 페이드 전환
        this.events.requestFade(() => this.teleport(target.x, target.z, target.level));
        return;
      }
      if (total > 70) {
        // 먼 거리는 짧은 페이드로 단축 (엘리베이터는 건너뛰지 않음)
        const cut = total - 26;
        let acc = 0;
        let x = this.pos.x;
        let z = this.pos.z;
        let lvl = this.level;
        let stop: { x: number; z: number; level: Level } | null = null;
        for (let i = 0; i < path.length; i++) {
          const wp = path[i];
          const next = path[i + 1];
          const d = Math.hypot(wp.x - x, wp.z - z);
          const beforeElevator = !!next && !!next.elevator;
          if (acc + d >= cut || beforeElevator) {
            let k = clamp((cut - acc) / (d || 1), 0, 1);
            if (beforeElevator) k = Math.min(k, clamp((d - 5) / (d || 1), 0, 1));
            stop = { x: x + (wp.x - x) * k, z: z + (wp.z - z) * k, level: lvl };
            break;
          }
          acc += d;
          x = wp.x;
          z = wp.z;
          lvl = wp.level;
        }
        if (stop && acc + Math.hypot(stop.x - this.pos.x, stop.z - this.pos.z) > 12) {
          const s = stop;
          this.events.requestFade(() => {
            this.teleport(s.x, s.z, s.level);
            this.setPath(target, null);
            this.speedMul = 1.9;
          });
          return;
        }
      }
      this.setPath(target, null);
      this.speedMul = 1.9;
    };
    if (this.mode === 'sitting' || this.mode === 'seating') {
      this.afterStand = run;
      this.standUp();
    } else run();
  }

  private teleport(x: number, z: number, level: Level): void {
    this.level = level;
    this.navPt = this.world.nav.clampTo(x, z, level);
    this.pos.set(this.navPt.x, this.world.nav.heightAt(this.navPt.x, this.navPt.z, level), this.navPt.z);
    this.path = [];
    this.pending = null;
    this.elevatorArmed = false;
    this.snapCamera();
  }

  // ------------------------------------------------------------ 엘리베이터

  private startElevator(): void {
    this.mode = 'elevator';
    this.elevT = 0;
    this.elevDir = this.level === 0 ? 1 : -1;
    this.pos.x = ELEVATOR.x;
    this.pos.z = ELEVATOR.z;
    audio.elevator(2.6);
  }

  private updateElevator(dt: number): void {
    // 0~0.6 문 닫힘, 0.6~2.6 이동, 2.6~3.2 문 열림
    this.elevT += dt;
    const t = this.elevT;
    const el = this.world.elevator;
    const close = clamp(t / 0.6, 0, 1);
    const move = easeInOut(clamp((t - 0.6) / 2.0, 0, 1));
    const open = clamp((t - 2.6) / 0.6, 0, 1);
    const up = this.elevDir === 1;
    const k = up ? move : 1 - move;
    // 아래에서는 서쪽 문, 위에서는 동쪽 문
    el.setState(k, up ? 1 - close : open, up ? open : 1 - close);
    this.pos.y = lerp(el.baseY, el.topY, k);
    this.player.pose = 'idle';
    // 문이 열릴 쪽을 바라봄
    this.player.turnToward(up ? Math.PI / 2 : -Math.PI / 2, dt, 4);
    if (t >= 3.2) {
      this.level = up ? 1 : 0;
      this.mode = 'free';
      this.elevatorArmed = false;
      this.navPt = this.world.nav.clampTo(ELEVATOR.x, ELEVATOR.z, this.level);
      this.pos.y = this.world.nav.heightAt(this.pos.x, this.pos.z, this.level);
      while (this.path.length && (this.path[0].elevator || Math.hypot(this.path[0].x - this.pos.x, this.path[0].z - this.pos.z) < 0.3)) {
        this.path.shift();
      }
      if (!this.path.length) {
        // 타워에서 한 걸음 나와 섬
        const out = this.world.nav.nodePoint(up ? 'd0' : 'e1');
        this.path = [{ x: out.x, z: out.z, level: this.level }];
      }
      this.camYaw = up ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  // ------------------------------------------------------------ 프레임

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.presence.join({ id: 'me', name: '', outfit: this.player.outfit, x: this.pos.x, z: this.pos.z, level: this.level, seat: null });
    this.raf = requestAnimationFrame(this.frame);
  }
  pause(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.keys.clear();
    this.presence.leave();
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(0.05, Math.max(0, raw));
    this.time += dt;
    this.stayedSeconds += Math.min(raw, 1);

    this.updatePlayer(dt);
    this.updatePeers(dt);
    this.updateResearchers(dt);
    this.updateCamera(dt);
    this.updateMarkers(dt);
    this.world.update(dt, this.time, this.camera, this.pos);

    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.4;
      this.periodic();
    }

    if (this.composer) this.composer.render();
    else this.renderer.render(this.world.scene, this.camera);

    // FPS와 저사양 감지(첫 3초 평균 30fps 미만이면 그림자·파티클·후처리를 낮춤)
    this.fpsFrames++;
    this.fpsTime += raw;
    if (this.fpsTime >= 0.5) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    if (!this.probed && this.time > 1.0 && !document.hidden) {
      this.probeTime += raw;
      this.probeFrames++;
      if (this.probeTime >= 3) {
        this.probed = true;
        if (this.probeFrames / this.probeTime < 30) this.setLowQuality();
      }
    }
  };

  setLowQuality(): void {
    if (this.lowQuality) return;
    this.lowQuality = true;
    this.world.setQuality(false);
    this.composer = null;
    this.renderer.setPixelRatio(1);
    this.resize();
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    const nav = this.world.nav;
    p.breath = -1;

    if (this.mode === 'elevator') {
      this.updateElevator(dt);
    } else if (this.mode === 'seating') {
      this.seatT += dt / 0.65;
      const k = easeInOut(Math.min(1, this.seatT));
      this.pos.lerpVectors(this.seatFrom, this.seatTo, k);
      if (this.seatDir === 1) {
        p.pose = k > 0.45 ? 'sit' : 'walk';
        p.turnToward(this.seatYaw, dt, 8);
      } else {
        p.pose = k < 0.4 ? 'sit' : 'idle';
      }
      if (this.seatT >= 1) {
        if (this.seatDir === 1) {
          this.mode = 'sitting';
        } else {
          this.mode = 'free';
          this.seat = null;
          this.navPt = nav.clampTo(this.pos.x, this.pos.z, this.level);
          const next = this.afterStand;
          this.afterStand = null;
          if (next) next();
        }
      }
    } else if (this.mode === 'sitting') {
      p.pose = 'sit';
      this.seatedSeconds += dt;
      p.turnToward(this.seatYaw, dt, 6);
    } else {
      let moving = false;
      let fx = 0;
      let fz = 0;
      const kx = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
      const kz = (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) - (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0);
      if (kx || kz) {
        // PC 보조: 방향키/WASD
        this.noteMoved();
        this.path = [];
        this.pending = null;
        this.speedMul = 1;
        const dxn = Math.sin(this.camYaw);
        const dzn = Math.cos(this.camYaw);
        fx = dxn * kz + -dzn * kx;
        fz = dzn * kz + dxn * kx;
        const l = Math.hypot(fx, fz) || 1;
        fx /= l;
        fz /= l;
        const nx = this.pos.x + fx * WALK_SPEED * dt;
        const nz = this.pos.z + fz * WALK_SPEED * dt;
        const c = nav.clampTo(nx, nz, this.level);
        moving = Math.hypot(c.x - this.pos.x, c.z - this.pos.z) > 0.002;
        this.pos.x = c.x;
        this.pos.z = c.z;
        this.navPt = c;
      } else if (this.path.length) {
        const wp = this.path[0];
        if (wp.elevator) {
          // 엘리베이터 문 앞에 닿으면 아래의 근접 판정이 탑승을 시작함
          if (Math.hypot(this.pos.x - ELEVATOR.x, this.pos.z - ELEVATOR.z) > 0.6) this.path.shift();
        } else {
          const dx = wp.x - this.pos.x;
          const dz = wp.z - this.pos.z;
          const d = Math.hypot(dx, dz);
          const step = WALK_SPEED * this.speedMul * dt;
          if (d <= step) {
            this.pos.x = wp.x;
            this.pos.z = wp.z;
            this.path.shift();
            if (!this.path.length) this.arrive();
          } else {
            fx = dx / d;
            fz = dz / d;
            this.pos.x += fx * step;
            this.pos.z += fz * step;
          }
          moving = true;
          this.navPt = nav.clampTo(this.pos.x, this.pos.z, this.level);
        }
      }
      if (this.mode === 'free') {
        this.pos.y = nav.heightAt(this.pos.x, this.pos.z, this.level);
        p.pose = moving ? 'walk' : 'idle';
        p.speed = moving ? WALK_SPEED * this.speedMul : 0;
        if (moving && (fx || fz)) p.turnToward(Math.atan2(fx, fz), dt, 9);
        if (moving) {
          this.stepClock -= dt * this.speedMul;
          if (this.stepClock <= 0) {
            this.stepClock = 0.4;
            audio.footstep(nav.surfaceAt(this.navPt));
          }
        }
        // 엘리베이터 타워에 들어서면 탑승
        const dEl = Math.hypot(this.pos.x - ELEVATOR.x, this.pos.z - ELEVATOR.z);
        if (dEl > 1.5) this.elevatorArmed = true;
        if (this.elevatorArmed && dEl < 0.5) this.startElevator();
      }
    }

    if (this.breathing) p.breath = this.breathAmount;
    p.setPosition(this.pos.x, this.pos.y, this.pos.z);
    p.update(dt, prefersReducedMotion);
  }

  /** 숨쉬기 화면이 알려주는 들숨 정도(0~1) */
  breathAmount = 0;

  private syncPeers(list: PeerState[]): void {
    for (const s of this.world.seats) s.occupied = false;
    for (const st of list) {
      let v = this.peers.get(st.id);
      if (!v) {
        const av = new Avatar({ outfit: st.outfit, name: st.name });
        this.world.scene.add(av.group);
        v = { avatar: av, x: st.x, z: st.z, level: st.level, tx: st.x, tz: st.z, seat: null };
        this.peers.set(st.id, v);
        av.yaw = Math.random() * 6.28;
      }
      v.tx = st.x;
      v.tz = st.z;
      v.level = st.level;
      v.seat = st.seat;
      if (st.seat) {
        const seat = this.world.seats.find((s) => s.def.id === st.seat);
        if (seat) {
          seat.occupied = true;
          v.avatar.pose = 'sit';
          v.avatar.yaw = seat.yaw;
          v.avatar.setPosition(seat.pos.x, seat.pos.y - HIP_HEIGHT + 0.03, seat.pos.z);
          v.x = seat.pos.x;
          v.z = seat.pos.z;
        }
      }
    }
  }

  /** 받은 위치 사이를 보간해 걷는 모습으로 표현 */
  private updatePeers(dt: number): void {
    for (const v of this.peers.values()) {
      if (!v.seat) {
        const dx = v.tx - v.x;
        const dz = v.tz - v.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.06) {
          const sp = Math.min(1.3, d / 0.9);
          v.x += (dx / d) * sp * dt;
          v.z += (dz / d) * sp * dt;
          v.avatar.pose = 'walk';
          v.avatar.speed = sp * 0.6;
          v.avatar.turnToward(Math.atan2(dx, dz), dt, 5);
        } else {
          v.avatar.pose = 'idle';
        }
        v.avatar.setPosition(v.x, this.world.nav.heightAt(v.x, v.z, v.level), v.z);
      }
      v.avatar.update(dt, prefersReducedMotion);
    }
  }

  private updateResearchers(dt: number): void {
    for (const r of this.researchers) {
      const d = Math.hypot(r.pos.x - this.pos.x, r.pos.z - this.pos.z);
      const near = d < 10 && Math.abs(r.pos.y - this.pos.y) < 4;
      // 가까이 가면 은은한 … 표시(먼저 말을 걸지는 않음)
      r.bubble += ((near && r.talk <= 0 ? 1 : 0) - r.bubble) * damp(3, dt);
      r.avatar.setBubble(this.quizPending ? '?' : '…');
      r.avatar.setBubbleVisible(r.bubble * (0.72 + Math.sin(this.time * 2.2) * 0.2));
      if (r.talk > 0) {
        r.talk -= dt;
        r.avatar.behavior = 'none';
        r.avatar.turnToward(Math.atan2(this.pos.x - r.pos.x, this.pos.z - r.pos.z), dt, 4);
      } else {
        r.avatar.behavior = r.def.behavior;
        r.avatar.turnToward(r.baseYaw, dt, 2);
      }
      r.avatar.update(dt, prefersReducedMotion);
    }
  }

  /** 연구원 대화창이 열려 있는 동안 계속 바라보게 */
  keepTalking(id: string): void {
    const r = this.researchers.find((x) => x.def.id === id);
    if (r) r.talk = 7;
  }

  private insideBox(x: number, y: number, z: number): boolean {
    for (const b of this.boxes) {
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && y < b.maxY) return true;
    }
    return false;
  }

  private desiredCamera(outPos: THREE.Vector3, outLook: THREE.Vector3): void {
    const portrait = this.camera.aspect < 0.9;
    const dist = (portrait ? 6.4 : this.camDist) * this.zoom;
    const tx = this.pos.x;
    const ty = this.pos.y + 1.15;
    const tz = this.pos.z;
    const dx = Math.sin(this.camYaw);
    const dz = Math.cos(this.camYaw);
    const cp = Math.cos(this.camPitch);
    const sp = Math.sin(this.camPitch);
    // 건물이나 땅에 가리면 카메라를 당김
    let k = 1;
    for (; k > 0.3; k -= 0.1) {
      const x = tx - dx * cp * dist * k;
      const y = ty + sp * dist * k + 0.25;
      const z = tz - dz * cp * dist * k;
      if (!this.insideBox(x, y, z)) break;
    }
    outPos.set(tx - dx * cp * dist * k, ty + sp * dist * k + 0.25, tz - dz * cp * dist * k);
    const floor = this.world.terrain.groundY(outPos.x, outPos.z) + 0.7;
    if (outPos.y < floor) outPos.y = floor;
    // 세로 화면에서는 아래쪽 버튼에 가리지 않도록 아바타를 조금 위에 둠
    outLook.set(tx + dx * 1.6, ty + (portrait ? 0.62 : 0.5), tz + dz * 1.6);
  }

  private seatedCamera(outPos: THREE.Vector3, outLook: THREE.Vector3): void {
    const seat = this.camSeat;
    if (!seat) return;
    const idx = this.world.seats.indexOf(seat);
    const yaw = seat.yaw + this.seatedYawOffset;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const side = idx % 2 === 0 ? 1 : -1;
    const rx = -fz * side;
    const rz = fx * side;
    const drift = prefersReducedMotion ? 0 : Math.sin(this.time * 0.11) * 0.35;
    const portrait = this.camera.aspect < 0.9;
    const back = portrait ? 5.6 : 4.6;
    const sideD = (portrait ? 1.1 : 1.9) + drift;
    const high = seat.def.place === 'deck' || seat.def.place === 'deckroad';
    outPos.set(seat.pos.x - fx * back + rx * sideD, seat.pos.y + (high ? 1.75 : 1.55), seat.pos.z - fz * back + rz * sideD);
    let k = 1;
    for (; k > 0.35 && this.insideBox(outPos.x, outPos.y, outPos.z); k -= 0.1) {
      outPos.set(seat.pos.x - fx * back * k + rx * sideD * k, outPos.y, seat.pos.z - fz * back * k + rz * sideD * k);
    }
    const floor = (seat.def.level === 1 && this.onDeckFloor(outPos.x, outPos.z) ? DECK_PLATFORM.y : this.world.terrain.groundY(outPos.x, outPos.z)) + 0.8;
    if (outPos.y < floor) outPos.y = floor;
    // 그 자리에서 보이는 풍경 쪽을 바라봄
    const lookY = seat.pos.y + (seat.def.place === 'deck' ? -2.6 : seat.def.place === 'deckroad' ? -1.6 : seat.def.place === 'valley' ? 0.4 : 1.7);
    outLook.set(seat.pos.x + fx * 16, lookY, seat.pos.z + fz * 16);
  }

  private onDeckFloor(x: number, z: number): boolean {
    const P = DECK_PLATFORM;
    return x > P.minX && x < P.maxX && z > P.minZ && z < P.maxZ;
  }

  private tmpPos = new THREE.Vector3();
  private tmpLook = new THREE.Vector3();
  private tmpPos2 = new THREE.Vector3();
  private tmpLook2 = new THREE.Vector3();

  private updateCamera(dt: number): void {
    // 걷는 방향을 천천히 따라감(드래그한 직후에는 그대로 둠)
    if (this.mode === 'free' && this.player.pose === 'walk' && this.time - this.lastDrag > 2.2) {
      const d = angleDelta(this.camYaw, this.player.yaw);
      // 카메라 쪽으로 걸어올 때는 돌리지 않음
      if (Math.abs(d) < 2.5) this.camYaw += d * damp(0.9, dt);
      this.camPitch += (0.26 - this.camPitch) * damp(0.5, dt);
    }
    this.desiredCamera(this.tmpPos, this.tmpLook);

    // 앉으면 천천히 뒤로·옆으로 빠지며 풍경 구도로
    const seated = this.mode === 'sitting' || (this.mode === 'seating' && this.seatDir === 1);
    this.seatedBlend = clamp(this.seatedBlend + (seated ? dt / 2.6 : -dt / 1.2), 0, 1);
    if (this.seatedBlend > 0 && this.camSeat) {
      this.seatedCamera(this.tmpPos2, this.tmpLook2);
      const k = easeInOut(this.seatedBlend);
      this.tmpPos.lerp(this.tmpPos2, k);
      this.tmpLook.lerp(this.tmpLook2, k);
      if (!seated && this.seatedBlend <= 0.001) this.seatedYawOffset = 0;
    }

    // 엘리베이터: 타워 바깥에서 승강칸과 함께 올라가는 구도
    this.elevBlend = clamp(this.elevBlend + (this.mode === 'elevator' ? dt / 0.5 : -dt / 0.9), 0, 1);
    if (this.elevBlend > 0) {
      const k = easeInOut(this.elevBlend);
      this.tmpPos2.set(ELEVATOR.x - 6.2, this.pos.y + 2.4, ELEVATOR.z + 7.4);
      this.tmpLook2.set(ELEVATOR.x + 0.6, this.pos.y + 1.5, ELEVATOR.z);
      this.tmpPos.lerp(this.tmpPos2, k);
      this.tmpLook.lerp(this.tmpLook2, k);
    }

    const kk = damp(prefersReducedMotion ? 30 : 5.5, dt);
    this.camPos.lerp(this.tmpPos, kk);
    this.camLook.lerp(this.tmpLook, damp(prefersReducedMotion ? 30 : 7, dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private snapCamera(): void {
    this.desiredCamera(this.camPos, this.camLook);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private updateMarkers(dt: number): void {
    const mm = this.marker.material as THREE.MeshBasicMaterial;
    if (this.markerLife > 0) {
      this.markerLife -= dt * (this.path.length ? 0.25 : 1.6);
      mm.opacity = clamp(this.markerLife, 0, 1) * 0.85;
      const s = 1 + Math.sin(this.time * 5) * 0.08;
      this.marker.scale.set(s, 1, s);
      this.marker.visible = true;
    } else {
      this.marker.visible = false;
    }
    // 가까이 가면 빈 자리 위에 은은한 빛
    const seats = this.world.seats;
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i];
      const sp = this.seatGlows[i];
      const d = s.pos.distanceTo(this.pos);
      const show = !s.occupied && s !== this.seat && this.mode !== 'sitting' ? 1 - smoothstep(6, 11, d) : 0;
      const mat = sp.material as THREE.SpriteMaterial;
      mat.opacity += (show * (0.4 + Math.sin(this.time * 2 + i) * 0.14) - mat.opacity) * damp(4, dt);
      sp.visible = mat.opacity > 0.01;
    }
  }

  /** 0.4초마다: 장소 도착 판정, 자리별 소리 */
  private periodic(): void {
    const nav = this.world.nav;
    let here = '';
    for (const pl of PLACES) {
      const n = nav.nodes.get(pl.node)!;
      if (n.level === this.level && Math.hypot(n.x - this.pos.x, n.z - this.pos.z) < pl.radius) here = pl.id;
    }
    if (here && here !== this.lastPlace) {
      this.lastPlace = here;
      track('place_visit', { place: here });
      this.events.onPlace(here);
    } else if (!here) {
      this.lastPlace = '';
    }
    const sd = this.level === 0 ? this.world.terrain.streamDistance(this.pos.x, this.pos.z) : 99;
    const stream = 1 - smoothstep(5, 28, sd);
    const open = here === 'plaza' || here === 'deck' ? 1 : this.level === 1 ? 0.8 : 0.35;
    audio.setScene(stream, open);
  }

  currentPlace(): string {
    return this.lastPlace;
  }

  setOutfit(id: OutfitId): void {
    this.player.setOutfit(id);
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const hgt = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, hgt, false);
    this.camera.aspect = w / hgt;
    // 세로 화면에서는 시야각을 넓혀 풍경이 답답하지 않게
    this.camera.fov = this.camera.aspect < 0.9 ? 62 : 50;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, hgt);
    }
  }

  /** 화면 중앙 쪽 숲 방향(털어놓기 글자가 날아갈 방향 계산용) */
  dispose(): void {
    this.pause();
    this.disposers.forEach((d) => d());
    this.renderer.dispose();
  }
}
