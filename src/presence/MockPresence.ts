import type { PeerState, PresenceProvider } from './PresenceProvider';
import { NAV_NODES, SEATS, VISITORS } from '../scenes/daejeon/layout';
import { COPY } from '../data/copy';
import { makeRng, shuffle } from '../core/util';

interface Walker {
  peer: PeerState;
  route: Array<{ x: number; z: number; level: 0 | 1 }>;
  seg: number;
  t: number;
  pause: number;
}

/**
 * 시연용 방문자: 실제 접속자가 아니라, 미리 정해 둔 자리와 산책 경로를 따라
 * 움직이는 예시입니다. 실서버처럼 일정 간격(1.2초)으로만 위치를 알려 줍니다.
 */
export class MockPresence implements PresenceProvider {
  private listeners: Array<(peers: PeerState[]) => void> = [];
  private peers: PeerState[] = [];
  private walkers: Walker[] = [];
  private timer = 0;
  private readonly interval = 1.2;
  private readonly speed = 0.85;

  constructor(excludeName: string) {
    const rnd = makeRng(31337);
    const names = shuffle(
      COPY.forest.names.filter((n) => n !== excludeName),
      rnd,
    );
    VISITORS.forEach((v, i) => {
      const name = names[i % names.length];
      if (v.seat) {
        const s = SEATS.find((x) => x.id === v.seat)!;
        this.peers.push({ id: 'demo-' + i, name, outfit: v.color, x: s.x, z: s.z, level: s.level, seat: s.id });
      } else if (v.route) {
        const route = v.route.map((id) => {
          const n = NAV_NODES.find((x) => x.id === id)!;
          // 길 한가운데가 아니라 살짝 옆으로 걷게
          return { x: n.x + (rnd() - 0.5) * 1.2, z: n.z + (rnd() - 0.5) * 1.2, level: n.level };
        });
        const peer: PeerState = { id: 'demo-' + i, name, outfit: v.color, x: route[0].x, z: route[0].z, level: route[0].level, seat: null };
        this.peers.push(peer);
        this.walkers.push({ peer, route, seg: 0, t: rnd(), pause: rnd() * 4 });
      }
    });
  }

  join(): void {
    this.emit();
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), this.interval * 1000);
  }

  leave(): void {
    window.clearInterval(this.timer);
  }

  updateSeat(): void {
    /* 시연용: 내 위치는 어디로도 보내지 않습니다 */
  }

  onPeersChanged(fn: (peers: PeerState[]) => void): void {
    this.listeners.push(fn);
  }

  private emit(): void {
    const snapshot = this.peers.map((p) => ({ ...p }));
    this.listeners.forEach((fn) => fn(snapshot));
  }

  private tick(): void {
    for (const w of this.walkers) {
      if (w.pause > 0) {
        w.pause -= this.interval;
        continue;
      }
      const a = w.route[w.seg];
      const b = w.route[(w.seg + 1) % w.route.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      w.t += (this.speed * this.interval) / len;
      if (w.t >= 1) {
        w.t = 0;
        w.seg = (w.seg + 1) % w.route.length;
        w.peer.x = b.x;
        w.peer.z = b.z;
        // 가끔 멈춰 서서 풍경을 봄
        if (Math.random() < 0.45) w.pause = 3 + Math.random() * 7;
      } else {
        w.peer.x = a.x + (b.x - a.x) * w.t;
        w.peer.z = a.z + (b.z - a.z) * w.t;
      }
      w.peer.level = a.level;
    }
    this.emit();
  }
}
