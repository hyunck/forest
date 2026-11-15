import { closestOnSegment, lerp } from '../core/util';
import { NAV_EDGES, NAV_NODES, type Level, type NavNode } from '../scenes/daejeon/layout';

export interface EdgeRT {
  i: number;
  a: NavNode;
  b: NavNode;
  w: number;
  len: number;
  level: Level;
  elevator: boolean;
  surface: 'dirt' | 'grass' | 'deck';
}

export interface NavPoint {
  x: number;
  z: number;
  level: Level;
  edge: number;
}

export interface Waypoint {
  x: number;
  z: number;
  level: Level;
  /** 이 지점에는 엘리베이터를 타고 도착함 */
  elevator?: boolean;
  /** 지나가는 노드 id (있을 때) */
  node?: string;
}

/**
 * 걸을 수 있는 영역 = 길(선분) 둘레의 폭.
 * 길찾기는 노드 그래프 위의 최단 경로 + 직선으로 갈 수 있는 구간 줄이기.
 */
export class Nav {
  readonly edges: EdgeRT[] = [];
  readonly nodes = new Map<string, NavNode>();
  private adj = new Map<string, Array<{ to: string; cost: number; edge: number }>>();

  constructor(private groundY: (x: number, z: number) => number) {
    for (const n of NAV_NODES) {
      this.nodes.set(n.id, n);
      this.adj.set(n.id, []);
    }
    NAV_EDGES.forEach((e, i) => {
      const a = this.nodes.get(e.a)!;
      const b = this.nodes.get(e.b)!;
      const elevator = e.kind === 'elevator';
      const len = elevator ? 14 : Math.hypot(b.x - a.x, b.z - a.z);
      this.edges.push({
        i,
        a,
        b,
        w: e.w,
        len,
        level: a.level,
        elevator,
        surface: e.surface || (a.level === 1 ? 'deck' : 'dirt'),
      });
      this.adj.get(a.id)!.push({ to: b.id, cost: len, edge: i });
      this.adj.get(b.id)!.push({ to: a.id, cost: len, edge: i });
    });
  }

  /** 그 지점의 바닥 높이 */
  heightAt(x: number, z: number, level: Level): number {
    if (level === 0) return this.groundY(x, z);
    let best = Infinity;
    let y = 0;
    for (const e of this.edges) {
      if (e.level !== 1 || e.elevator) continue;
      const c = closestOnSegment(x, z, e.a.x, e.a.z, e.b.x, e.b.z);
      const d = Math.max(0, c.d - e.w);
      if (d < best || (d === best && c.d < 1e-6)) {
        best = d;
        y = lerp(e.a.y || 0, e.b.y || 0, c.t);
      }
    }
    return y;
  }

  isWalkable(x: number, z: number, level: Level): boolean {
    for (const e of this.edges) {
      if (e.level !== level || e.elevator) continue;
      const c = closestOnSegment(x, z, e.a.x, e.a.z, e.b.x, e.b.z);
      if (c.d <= e.w) return true;
    }
    return false;
  }

  /** 가장 가까운 걸을 수 있는 지점으로 당김 */
  clampTo(x: number, z: number, level: Level): NavPoint {
    let best = Infinity;
    let out: NavPoint = { x, z, level, edge: 0 };
    for (const e of this.edges) {
      if (e.level !== level || e.elevator) continue;
      const c = closestOnSegment(x, z, e.a.x, e.a.z, e.b.x, e.b.z);
      const over = c.d - e.w;
      if (over <= 0) {
        // 길 안쪽이면 그대로. 여러 길이 겹치면 중심선에 더 가까운 길을 고름
        const score = -1000 + c.d / e.w;
        if (score < best) {
          best = score;
          out = { x, z, level, edge: e.i };
        }
      } else if (over < best) {
        best = over;
        const k = (e.w - 0.02) / c.d;
        out = { x: c.x + (x - c.x) * k, z: c.z + (z - c.z) * k, level, edge: e.i };
      }
    }
    return out;
  }

  private straightWalkable(ax: number, az: number, bx: number, bz: number, level: Level): boolean {
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(len / 0.6));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (!this.isWalkable(ax + (bx - ax) * t, az + (bz - az) * t, level)) return false;
    }
    return true;
  }

  /** from에서 to까지의 경로 (from 자신은 포함하지 않음) */
  findPath(from: NavPoint, to: NavPoint): Waypoint[] {
    if (from.level === to.level && this.straightWalkable(from.x, from.z, to.x, to.z, from.level)) {
      return [{ x: to.x, z: to.z, level: to.level }];
    }
    const eS = this.edges[from.edge];
    const eG = this.edges[to.edge];
    // 다익스트라: 시작 길의 양 끝에서 출발
    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    const open = new Set<string>();
    const seed = (n: NavNode): void => {
      dist.set(n.id, Math.hypot(n.x - from.x, n.z - from.z));
      prev.set(n.id, null);
      open.add(n.id);
    };
    seed(eS.a);
    seed(eS.b);
    const done = new Set<string>();
    while (open.size) {
      let cur = '';
      let cd = Infinity;
      for (const id of open) {
        const d = dist.get(id)!;
        if (d < cd) {
          cd = d;
          cur = id;
        }
      }
      open.delete(cur);
      done.add(cur);
      for (const nb of this.adj.get(cur)!) {
        if (done.has(nb.to)) continue;
        const nd = cd + nb.cost;
        if (nd < (dist.get(nb.to) ?? Infinity)) {
          dist.set(nb.to, nd);
          prev.set(nb.to, cur);
          open.add(nb.to);
        }
      }
    }
    const endCost = (n: NavNode): number => (dist.get(n.id) ?? Infinity) + Math.hypot(n.x - to.x, n.z - to.z);
    const endNode = endCost(eG.a) <= endCost(eG.b) ? eG.a : eG.b;
    const chain: NavNode[] = [];
    let cur: string | null | undefined = endNode.id;
    while (cur) {
      chain.unshift(this.nodes.get(cur)!);
      cur = prev.get(cur);
    }
    const pts: Waypoint[] = [];
    let prevNode: NavNode | null = null;
    for (const n of chain) {
      const elevator = !!prevNode && prevNode.level !== n.level;
      pts.push({ x: n.x, z: n.z, level: n.level, elevator, node: n.id });
      prevNode = n;
    }
    pts.push({ x: to.x, z: to.z, level: to.level });

    // 직선으로 갈 수 있으면 중간 지점을 건너뜀 (광장을 가로지를 때 자연스럽게)
    const out: Waypoint[] = [];
    let ax = from.x;
    let az = from.z;
    let aLevel: Level = from.level;
    let i = 0;
    while (i < pts.length) {
      let j = i;
      // i 이후로 직선으로 닿는 가장 먼 지점 찾기 (엘리베이터 구간은 건너뛰지 않음)
      for (let k = pts.length - 1; k > i; k--) {
        let crossesElevator = false;
        for (let m = i; m <= k; m++) {
          if (pts[m].elevator || pts[m].level !== aLevel) crossesElevator = true;
        }
        // 엘리베이터 문 앞 노드는 건너뛰지 않음
        let skipsDoor = false;
        for (let m = i; m < k; m++) {
          if (pts[m + 1] && pts[m + 1].elevator) skipsDoor = true;
        }
        if (crossesElevator || skipsDoor) continue;
        if (this.straightWalkable(ax, az, pts[k].x, pts[k].z, aLevel)) {
          j = k;
          break;
        }
      }
      const p = pts[j];
      out.push(p);
      ax = p.x;
      az = p.z;
      aLevel = p.level;
      i = j + 1;
    }
    return out;
  }

  pathLength(from: { x: number; z: number }, path: Waypoint[]): number {
    let len = 0;
    let x = from.x;
    let z = from.z;
    for (const p of path) {
      if (!p.elevator) len += Math.hypot(p.x - x, p.z - z);
      x = p.x;
      z = p.z;
    }
    return len;
  }

  nodePoint(id: string): NavPoint {
    const n = this.nodes.get(id)!;
    return this.clampTo(n.x, n.z, n.level);
  }

  surfaceAt(p: NavPoint): 'dirt' | 'grass' | 'deck' {
    return this.edges[p.edge] ? this.edges[p.edge].surface : 'dirt';
  }
}
