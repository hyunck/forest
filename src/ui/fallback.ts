import { COPY } from '../data/copy';
import type { Stage } from './hud';
import type { GameEvents } from '../game/ForestGame';
import { track } from '../core/metrics';

/**
 * WebGL을 쓸 수 없을 때의 대체 화면.
 * 같은 장소를 그린 정지 그림 배경 위에 같은 문구와 버튼을 그대로 보여 줍니다.
 * (그림은 직접 그린 SVG이며, 실제 사진이나 공식 안내도를 쓰지 않습니다)
 */
function art(): string {
  const tree = (x: number, y: number, s: number, c: string): string =>
    `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2" y="0" width="4" height="16" fill="#3a2a1c"/><circle cx="0" cy="-8" r="15" fill="${c}"/><circle cx="-10" cy="0" r="10" fill="${c}"/><circle cx="10" cy="-1" r="11" fill="${c}"/></g>`;
  const pine = (x: number, y: number, s: number, c: string): string =>
    `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2" y="6" width="4" height="12" fill="#2e2118"/><path d="M0 -44 L15 -12 L-15 -12Z M0 -30 L19 2 L-19 2Z M0 -14 L23 14 L-23 14Z" fill="${c}"/></g>`;
  const house = (x: number, y: number, w: number, hgt: number, roof: number, lit: number[]): string => {
    let win = '';
    const cols = Math.max(2, Math.floor(w / 22));
    for (let i = 0; i < cols; i++) {
      const wx = x + 8 + i * ((w - 16) / cols);
      win += `<rect x="${wx}" y="${y - hgt + 12}" width="${(w - 16) / cols - 6}" height="${hgt - 24}" fill="${lit.includes(i) ? '#ffd08a' : '#2c3b4c'}"/>`;
    }
    return `<g><rect x="${x}" y="${y - hgt}" width="${w}" height="${hgt}" fill="#b98a58"/><path d="M${x - 6} ${y - hgt} L${x + w / 2} ${y - hgt - roof} L${x + w + 6} ${y - hgt}Z" fill="#4d6076"/>${win}</g>`;
  };
  const lamp = (x: number, y: number): string =>
    `<g><rect x="${x - 1}" y="${y - 30}" width="2" height="30" fill="#2f3230"/><circle cx="${x}" cy="${y - 33}" r="16" fill="#ffc477" opacity="0.18"/><rect x="${x - 4}" y="${y - 38}" width="8" height="10" rx="2" fill="#ffd9a0"/></g>`;
  return `<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${COPY.fallback.alt}">
    <defs>
      <linearGradient id="fb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121a3c"/><stop offset="0.55" stop-color="#27496b"/><stop offset="0.82" stop-color="#3f7a82"/><stop offset="1" stop-color="#e09a66"/></linearGradient>
      <radialGradient id="fb-glow" cx="0.16" cy="0.62" r="0.5"><stop offset="0" stop-color="#f0a468" stop-opacity="0.7"/><stop offset="1" stop-color="#f0a468" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1200" height="800" fill="url(#fb-sky)"/>
    <rect width="1200" height="800" fill="url(#fb-glow)"/>
    <g fill="#f6efdc" opacity="0.8"><circle cx="210" cy="90" r="1.600"/><circle cx="420" cy="60" r="1.200"/><circle cx="640" cy="120" r="1.400"/><circle cx="880" cy="70" r="1.700"/><circle cx="1040" cy="150" r="1.200"/><circle cx="760" cy="40" r="1"/><circle cx="330" cy="170" r="1"/></g>
    <path d="M0 470 L120 400 L240 440 L360 330 L470 400 L600 300 L720 380 L860 340 L1000 420 L1200 380 V800 H0Z" fill="#30506a"/>
    <path d="M0 520 L140 450 L300 500 L460 420 L640 480 L800 430 L960 490 L1200 450 V800 H0Z" fill="#2c4756"/>
    <path d="M0 560 Q200 500 420 540 T820 530 T1200 520 V800 H0Z" fill="#2e4a44"/>
    ${pine(90, 560, 1.5, '#29443a')}${pine(180, 575, 1.2, '#2f4a3a')}${pine(1090, 560, 1.6, '#29443a')}${pine(1010, 580, 1.2, '#35523c')}
    ${house(250, 610, 170, 120, 80, [0, 2, 3, 5])}
    ${house(470, 600, 150, 96, 62, [1, 2, 4])}
    ${house(690, 570, 260, 84, 40, [0, 1, 3, 4, 6, 7, 9])}
    ${tree(210, 630, 1.5, '#d9672b')}${tree(450, 640, 1.300, '#e08a2e')}${tree(660, 640, 1.400, '#c8452c')}${tree(960, 640, 1.600, '#e3a93a')}${tree(1090, 660, 1.300, '#d9672b')}
    <path d="M0 660 Q300 620 600 650 T1200 640 V800 H0Z" fill="#5a6e3e"/>
    <path d="M520 800 Q560 700 600 656 Q640 700 700 800Z" fill="#9a7b56"/>
    <g><rect x="505" y="560" width="14" height="120" fill="#5e432c"/><rect x="681" y="560" width="14" height="120" fill="#5e432c"/><rect x="480" y="548" width="240" height="16" rx="3" fill="#5e432c"/><rect x="528" y="572" width="144" height="54" rx="4" fill="#4a3321" stroke="#f1ecdc" stroke-opacity="0.5" stroke-width="2"/>
      <text x="600" y="598" text-anchor="middle" font-size="24" font-weight="700" fill="#f6efdc" font-family="serif">${COPY.forest.plaque.big}</text>
      <text x="600" y="617" text-anchor="middle" font-size="7" textLength="130" lengthAdjust="spacingAndGlyphs" fill="#ecdfbd" font-family="sans-serif">${COPY.forest.plaque.small}</text></g>
    ${lamp(470, 690)}${lamp(730, 690)}${lamp(330, 720)}${lamp(880, 716)}
    <g><rect x="800" y="716" width="90" height="8" rx="3" fill="#b98a58"/><rect x="806" y="724" width="6" height="22" fill="#2f3230"/><rect x="878" y="724" width="6" height="22" fill="#2f3230"/><rect x="800" y="696" width="90" height="7" rx="3" fill="#b98a58"/></g>
    ${tree(60, 730, 2.2, '#b8382f')}${tree(1150, 740, 2.300, '#cf7a34')}
    <path d="M0 760 Q300 730 600 760 T1200 750 V800 H0Z" fill="#54482f"/>
  </svg>`;
}

/** 3D 없이도 흐름이 끊기지 않도록 같은 HUD 동작을 받아 주는 무대 */
export class FallbackStage implements Stage {
  breathing = false;
  breathAmount = 0;
  stayedSeconds = 0;
  quizPending = false;
  fps = 0;
  lowQuality = true;
  private seated = false;
  private timer = 0;
  private box: HTMLElement;

  constructor(private events: GameEvents) {
    this.box = document.getElementById('fallback-art')!;
    this.box.innerHTML = art();
    this.box.hidden = false;
    document.getElementById('scene')!.style.display = 'none';
    this.box.addEventListener('pointerdown', () => this.events.onUserInput());
  }
  get isSeated(): boolean {
    return this.seated;
  }
  toggleSit(): void {
    this.seated = !this.seated;
    if (this.seated) track('sit', { seat: 'still', seconds: 0 });
    this.events.onSeated(this.seated);
  }
  goToPlace(id: string): void {
    this.box.dataset.place = id;
    if (this.seated) this.toggleSit();
    track('place_visit', { place: id });
    this.events.onFirstMove();
    this.events.onPlace(id);
  }
  setOutfit(): void {
    /* 정지 그림에는 아바타가 없음 */
  }
  keepTalking(): void {
    /* noop */
  }
  start(): void {
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      if (!document.hidden) this.stayedSeconds += 1;
    }, 1000);
  }
  pause(): void {
    window.clearInterval(this.timer);
  }
}
