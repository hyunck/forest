/**
 * 확산의 숲 온라인 쉼터 · 진입점
 * 화면 흐름: ① 첫 로딩 → ② 숲 고르기 → ③ 숲 진입 로딩 → ④ 숲 안 → ⑤ 종료 화면
 * (카톡 링크 ?forest=daejeon 으로 오면 ②를 건너뜀)
 */
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@fontsource/noto-serif-kr/600.css';
import './style.css';

import forestsJson from './data/forests.json';
import { COPY } from './data/copy';
import { params } from './core/params';
import { isReturningVisitor, markVisit, track, getPref } from './core/metrics';
import { audio } from './core/audio';
import { pick, wait } from './core/util';
import { webglAvailable } from './core/webgl';
import { createBootScreen, createEntryScreen, createExitScreen, createSelectScreen, hideScreen, showScreen, type Forest } from './ui/screens';
import { Hud, type Stage } from './ui/hud';
import { FallbackStage } from './ui/fallback';
import { mountDebugPanel } from './ui/debugPanel';
import { MockPresence } from './presence/MockPresence';
import type { OutfitId } from './data/outfits';

type ScreenState = 'select' | 'forest' | 'exit';

const forests = forestsJson as Forest[];
const returning = isReturningVisitor();
track('visit');
markVisit();

// 첫 로딩 화면이 보이는 동안 3D 코드를 미리 받아 둠(숲 진입을 빠르게)
const gameModule = !params.forceFallback && webglAvailable() ? import('./game/ForestGame') : null;
gameModule?.catch(() => undefined);

const boot = createBootScreen();
const select = createSelectScreen(forests, (f) => {
  history.pushState({ s: 'forest', id: f.id }, '');
  void enterForest(f, false);
});
const entry = createEntryScreen();
const exitScreen = createExitScreen();

let activeScreen: HTMLElement | null = null;
let hud: Hud | null = null;
let stage: Stage | null = null;
let forest: Forest | null = null;
let busy = false;

function swapTo(el: HTMLElement | null): void {
  const prev = activeScreen;
  activeScreen = el;
  if (el) showScreen(el);
  if (prev && prev !== el) void hideScreen(prev);
}

/** 캔버스에 그리는 글자(현판·이름표·표찰)에 쓸 글꼴을 미리 받아 둠 */
async function loadCanvasFonts(): Promise<void> {
  if (!document.fonts || !document.fonts.load) return;
  const F = COPY.forest;
  const text =
    F.plaque.big + F.plaque.small + F.researcherName + F.meBadge + F.names.join('') + Object.values(COPY.signs).map((s) => s.name).join('');
  await Promise.race([
    Promise.all([
      document.fonts.load('600 40px "Noto Serif KR"', F.plaque.big),
      document.fonts.load('600 30px "Pretendard Variable"', text),
      document.fonts.load('700 30px "Pretendard Variable"', text),
    ]),
    wait(3500),
  ]).catch(() => undefined);
}

async function createStage(f: Forest, direct: boolean): Promise<Stage> {
  const saved = getPref('outfit') as OutfitId | null;
  const outfit: OutfitId = saved && ['moss', 'beige', 'navy', 'chestnut'].includes(saved) ? saved : pick<OutfitId>(['moss', 'beige', 'navy', 'chestnut']);
  const name = pick(COPY.forest.names);
  hud = new Hud({ forest: f, directEntry: direct, outfit, onExit: () => goExit() });
  if (gameModule) {
    try {
      const [{ ForestGame }] = await Promise.all([gameModule, loadCanvasFonts()]);
      // 진입 로딩 화면이 먼저 그려지도록 한 박자 쉼
      await wait(60);
      const canvas = document.getElementById('scene') as HTMLCanvasElement;
      const game = new ForestGame(canvas, hud.events, new MockPresence(name), { outfit, name });
      game.quizPending = params.demoQuiz || returning;
      // 개발 중 점검용 손잡이(배포 빌드에는 포함되지 않음)
      if (import.meta.env.DEV) (window as unknown as { __game?: unknown }).__game = game;
      return game;
    } catch (err) {
      // 3D를 띄울 수 없으면 아래의 대체 화면으로 (흐름은 끊기지 않게)
      console.warn('3D 장면을 열 수 없어 대체 화면으로 전환합니다.', err instanceof Error ? err.message : '');
    }
  }
  const fb = new FallbackStage(hud.events);
  fb.quizPending = false;
  return fb;
}

async function enterForest(f: Forest, direct: boolean): Promise<void> {
  if (busy) return;
  busy = true;
  forest = f;
  swapTo(entry.el);
  const first = !stage;
  const task = first
    ? createStage(f, direct).then((s) => {
        stage = s;
        if (hud) hud.stage = s;
        return s;
      })
    : Promise.resolve(stage);
  await entry.run(f, task);
  resumeForest(first);
  track('forest_enter', { forest: f.id, start: 'gate' });
  busy = false;
}

function resumeForest(first: boolean): void {
  if (!stage || !hud) return;
  swapTo(null);
  stage.start();
  audio.setInForest(true);
  void hud.show(first);
}

function leaveForest(): void {
  stage?.pause();
  hud?.hide();
  audio.setInForest(false);
}

function showExit(): void {
  if (!stage || !hud || !forest) {
    showSelect();
    return;
  }
  leaveForest();
  // 안 선택: 털어놓기를 했으면 B, 연구원을 만났으면 C, 그 외 A
  const variant = hud.didConfide ? 'B' : hud.metResearcher ? 'C' : 'A';
  track('exit_shown', { variant, seconds: Math.round(stage.stayedSeconds) });
  exitScreen.show({
    forest,
    variant,
    stayedSeconds: stage.stayedSeconds,
    onStay: () => history.back(),
    onOtherForests: () => {
      history.pushState({ s: 'select' }, '');
      showSelect();
    },
  });
  activeScreen = exitScreen.el;
}

function goExit(): void {
  if (busy) return;
  history.pushState({ s: 'exit' }, '');
  showExit();
}

function showSelect(): void {
  leaveForest();
  swapTo(select.el);
}

// 브라우저 뒤로 가기: 이전 화면으로 자연스럽게
window.addEventListener('popstate', (e) => {
  if (busy) return;
  const s = (e.state && (e.state as { s?: ScreenState }).s) || 'select';
  if (s === 'forest') {
    if (stage) resumeForest(false);
    else {
      const f = forests.find((x) => x.id === (e.state as { id?: string }).id && x.status === 'open') || forests.find((x) => x.status === 'open');
      if (f) void enterForest(f, false);
    }
  } else if (s === 'exit') {
    showExit();
  } else {
    showSelect();
  }
});

// 첫 클릭·터치를 소리 시작 트리거로 사용
const firstTouch = (): void => {
  audio.start();
  window.removeEventListener('pointerdown', firstTouch);
  window.removeEventListener('keydown', firstTouch);
};
window.addEventListener('pointerdown', firstTouch);
window.addEventListener('keydown', firstTouch);

if (params.debug) mountDebugPanel(() => (stage ? { fps: stage.fps, low: stage.lowQuality } : null));

async function main(): Promise<void> {
  const ready = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), wait(6000)]);
  activeScreen = boot.el;
  await boot.run(ready);
  const direct = forests.find((f) => f.id === params.forest && f.status === 'open');
  if (direct) {
    history.replaceState({ s: 'forest', id: direct.id }, '');
    await enterForest(direct, true);
  } else {
    history.replaceState({ s: 'select' }, '');
    swapTo(select.el);
  }
}

void main();
