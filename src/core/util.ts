/** 작은 수학·난수·DOM 도우미 */

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
export function easeInOut(t: number): number {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}
/** 프레임률과 무관한 감쇠 보간 계수 */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}
/** 각도 차이를 -PI..PI로 */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** 항상 같은 숲이 만들어지도록 하는 시드 난수 (mulberry32) */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 부드러운 2D 값 노이즈 (지형·색 변화용) */
export function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
export function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x: number, y: number, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/** 점 p에서 선분 ab까지: 가장 가까운 점의 매개변수 t(0..1)와 거리 */
export function closestOnSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { t: number; x: number; z: number; d: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 1e-9 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = clamp(t, 0, 1);
  const x = ax + dx * t;
  const z = az + dz * t;
  return { t, x, z, d: Math.hypot(px - x, pz - z) };
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(arr: T[], rnd: () => number = Math.random): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** DOM 요소 만들기 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> | null = null,
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
  }
  for (const c of children) {
    if (c === null || c === undefined) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

export const prefersReducedMotion: boolean =
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isTouchDevice: boolean =
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export const isMobile: boolean =
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
