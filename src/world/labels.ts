import * as THREE from 'three';

const FONT = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 아바타 머리 위 이름표. badge가 있으면 이름 앞에 작은 배지(예: 나) */
export function makeNameTag(name: string, opts: { badge?: string; accent?: boolean } = {}): THREE.Sprite {
  const H = 72;
  const pad = 26;
  const fs = 34;
  const cv = document.createElement('canvas');
  const g0 = cv.getContext('2d')!;
  g0.font = `600 ${fs}px ${FONT}`;
  const tw = Math.ceil(g0.measureText(name).width);
  const bw = opts.badge ? 50 : 0;
  cv.width = tw + pad * 2 + (bw ? bw + 12 : 0);
  cv.height = H;
  const g = cv.getContext('2d')!;
  roundRect(g, 1, 1, cv.width - 2, H - 2, H / 2 - 1);
  g.fillStyle = opts.accent ? 'rgba(58,70,44,0.86)' : 'rgba(34,38,32,0.74)';
  g.fill();
  g.strokeStyle = 'rgba(241,236,220,0.22)';
  g.lineWidth = 2;
  g.stroke();
  let x = pad;
  g.textBaseline = 'middle';
  if (opts.badge) {
    roundRect(g, 12, 12, bw, H - 24, (H - 24) / 2);
    g.fillStyle = '#7d9461';
    g.fill();
    g.font = `700 ${fs - 6}px ${FONT}`;
    g.fillStyle = '#1b211b';
    g.textAlign = 'center';
    g.fillText(opts.badge, 12 + bw / 2, H / 2 + 2);
    x = 12 + bw + 14;
  }
  g.font = `600 ${fs}px ${FONT}`;
  g.textAlign = 'left';
  g.fillStyle = '#f1ecdc';
  g.fillText(name, x, H / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: true });
  const sp = new THREE.Sprite(mat);
  const hWorld = 0.27;
  sp.scale.set((cv.width / H) * hWorld, hWorld, 1);
  sp.renderOrder = 5;
  return sp;
}

/** 연구원 머리 위의 작은 말풍선 표시(… 또는 ?) */
export function makeBubble(text: string): THREE.Sprite {
  const S = 96;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2);
  g.fillStyle = 'rgba(241,236,220,0.94)';
  g.fill();
  g.fillStyle = '#3a4630';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (text === '…') {
    for (const dx of [-17, 0, 17]) {
      g.beginPath();
      g.arc(S / 2 + dx, S / 2, 5.5, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.font = `700 56px ${FONT}`;
    g.fillText(text, S / 2, S / 2 + 4);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(0.36, 0.36, 1);
  sp.renderOrder = 6;
  return sp;
}

/** 부드러운 원형 빛(앉을 자리 표시 등) */
let softDot: THREE.CanvasTexture | null = null;
export function softDotTexture(): THREE.CanvasTexture {
  if (softDot) return softDot;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  softDot = new THREE.CanvasTexture(cv);
  return softDot;
}
