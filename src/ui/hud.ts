import { COPY, SIGNATURE_FULL, SIGNATURE_SHORT } from '../data/copy';
import { h, shuffle, wait, prefersReducedMotion } from '../core/util';
import { ICON, symbolSvg } from './icons';
import { toast, type Forest } from './screens';
import { audio } from '../core/audio';
import { getPref, setPref, track } from '../core/metrics';
import { params } from '../core/params';
import { createConfide } from './confide';
import type { GameEvents } from '../game/ForestGame';
import { OUTFITS, OUTFIT_IDS, type OutfitId } from '../data/outfits';

/** HUD가 다루는 무대: 3D 숲(ForestGame) 또는 3D를 못 띄울 때의 대체 화면 */
export interface Stage {
  toggleSit(): void;
  readonly isSeated: boolean;
  goToPlace(id: string): void;
  setOutfit(id: OutfitId): void;
  breathing: boolean;
  breathAmount: number;
  stayedSeconds: number;
  quizPending: boolean;
  keepTalking(id: string): void;
  start(): void;
  pause(): void;
  fps: number;
  lowQuality: boolean;
}

export interface HudOptions {
  forest: Forest;
  /** 카톡 링크 등으로 숲 고르기를 건너뛰고 바로 들어온 경우 */
  directEntry: boolean;
  outfit: OutfitId;
  onExit(): void;
}

const PLACE_ICON: Record<string, string> = { gate: ICON.gate, plaza: ICON.lawn, deck: ICON.deck, valley: ICON.valley };

export class Hud {
  readonly el: HTMLElement;
  stage: Stage | null = null;
  didConfide = false;
  metResearcher = false;
  readonly events: GameEvents;

  private sitBtn: HTMLButtonElement;
  private soundBtn: HTMLButtonElement;
  private welcome: HTMLElement;
  private moveHint: HTMLElement;
  private pick: HTMLElement;
  private soundCta: HTMLButtonElement;
  private placeSheet: HTMLElement;
  private placeBackdrop: HTMLElement;
  private dialogue: HTMLElement;
  private dialogueBackdrop: HTMLElement;
  private dialogueLine: HTMLElement;
  private cardLayer: HTMLElement;
  private breatheLayer: HTMLElement;
  private breatheCircle: HTMLElement;
  private breatheText: HTMLElement;
  private fadeEl: HTMLElement;
  private confide: { open(): void; close(): void; isOpen(): boolean };

  private idleTimer = 0;
  private active = false;
  private talk: { id: string; idx: number; timer: number } | null = null;
  private cardTimer = 0;
  private breatheRaf = 0;
  private outfit: OutfitId;
  private modal = 0;
  private welcoming = false;

  constructor(private opts: HudOptions) {
    const F = COPY.forest;
    const B = F.buttons;
    this.outfit = opts.outfit;
    const root = h('div', { id: 'hud', hidden: '' });
    this.el = root;

    // 좌상단: 숲 이름과 시연 표시(항상 보임)
    const topLeft = h(
      'div',
      { class: 'top-left' },
      h('div', { class: 'bar fadeable chrome', html: symbolSvg(24) + `<span>${F.labelOf(opts.forest.name)}</span>` }),
      h('p', { class: 'demo-note' }, F.demoNotice),
    );

    // 우상단: 소리, 나가기
    this.soundBtn = h('button', { type: 'button', class: 'btn sm fadeable chrome' });
    const exitBtn = h('button', { type: 'button', class: 'btn sm fadeable chrome', 'aria-label': B.exit, html: ICON.exit + `<span>${B.exit}</span>` });
    const topRight = h('div', { class: 'top-right' }, exitBtn, this.soundBtn);
    this.soundBtn.addEventListener('click', () => {
      audio.toggle();
      this.wake();
    });
    exitBtn.addEventListener('click', () => this.requestExit());
    audio.onChange(() => this.renderSound());
    this.renderSound();

    // 입장 직후 환영 문구와 안내
    this.welcome = h('p', { class: 'hint welcome', role: 'status' });
    this.soundCta = h('button', { type: 'button', class: 'btn primary sound-cta', 'aria-label': F.soundOn, html: ICON.soundOn + `<span>${F.soundOn}</span>`, hidden: '' });
    this.soundCta.addEventListener('click', () => {
      audio.setEnabled(true);
      audio.start();
      this.soundCta.hidden = true;
    });

    // 하단: 주 버튼 3개 (앉기 · 숨쉬기 · 털어놓기), 보조 버튼 장소
    this.sitBtn = h('button', { type: 'button', class: 'btn primary' });
    const breatheBtn = h('button', { type: 'button', class: 'btn', 'aria-label': B.breathe, html: ICON.breathe + `<span>${B.breathe}</span>` });
    const confideBtn = h('button', { type: 'button', class: 'btn', 'aria-label': B.confide, html: ICON.confide + `<span>${B.confide}</span>` });
    const placesBtn = h('button', { type: 'button', class: 'btn sm fadeable', 'aria-label': B.places, html: ICON.places + `<span>${B.places}</span>` });
    this.renderSit(false);
    this.sitBtn.addEventListener('click', () => {
      this.wake();
      this.stage?.toggleSit();
    });
    breatheBtn.addEventListener('click', () => this.startBreathing());
    confideBtn.addEventListener('click', () => this.confide.open());
    placesBtn.addEventListener('click', () => this.openPlaces(true));

    this.moveHint = h('p', { class: 'hint', role: 'status' }, F.moveHint);
    this.pick = this.buildPick();
    const bottom = h(
      'div',
      { class: 'bottom' },
      this.moveHint,
      this.soundCta,
      this.pick,
      h('div', { class: 'side-row' }, placesBtn),
      h('div', { class: 'main-bar fadeable', role: 'group', 'aria-label': F.mainActions }, this.sitBtn, breatheBtn, confideBtn),
    );

    // 장소 바로가기 판
    this.placeBackdrop = h('div', { class: 'sheet-backdrop', hidden: '' });
    this.placeBackdrop.addEventListener('click', () => this.openPlaces(false));
    const grid = h('div', { class: 'place-grid' });
    for (const id of ['gate', 'plaza', 'deck', 'valley']) {
      const b = h('button', { type: 'button', class: 'btn', 'aria-label': F.places[id], html: PLACE_ICON[id] + `<span>${F.places[id]}</span>` });
      b.addEventListener('click', () => {
        this.openPlaces(false);
        this.stage?.goToPlace(id);
      });
      grid.appendChild(b);
    }
    const placeClose = h('button', { type: 'button', class: 'btn', html: ICON.close + `<span>${B.close}</span>` });
    placeClose.addEventListener('click', () => this.openPlaces(false));
    this.placeSheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': B.places, hidden: '' }, h('h2', null, B.places), grid, h('div', { class: 'row' }, placeClose));

    // 숲지기 연구원 대화창(큰 글자)
    this.dialogueBackdrop = h('div', { class: 'dialogue-backdrop', hidden: '' });
    this.dialogueBackdrop.addEventListener('click', () => this.closeDialogue());
    this.dialogueLine = h('p', { class: 'line' });
    this.dialogue = h(
      'div',
      { class: 'dialogue', role: 'dialog', 'aria-live': 'polite', hidden: '' },
      h('div', { class: 'who', html: ICON.leaf + `<span>${F.researcherName}</span>` }),
      this.dialogueLine,
      h('div', { class: 'sig' }, SIGNATURE_SHORT),
    );
    this.dialogue.addEventListener('click', () => {
      if (this.talk) this.advanceDialogue();
    });

    // 표찰·질문 카드
    this.cardLayer = h('div', { class: 'center-layer dim', hidden: '' });
    this.cardLayer.addEventListener('click', (e) => {
      if (e.target === this.cardLayer && this.cardLayer.dataset.kind === 'sign') this.closeCard();
    });

    // 숨쉬기
    this.breatheCircle = h('div', { class: 'breathe-circle' });
    this.breatheText = h('p', { class: 'breathe-text', role: 'status', 'aria-live': 'polite' });
    this.breatheLayer = h('div', { class: 'breathe-layer', hidden: '' }, this.breatheCircle, this.breatheText);
    this.breatheLayer.addEventListener('click', () => this.stopBreathing(true));

    this.fadeEl = h('div', { id: 'fade' });

    root.append(topLeft, topRight, this.welcome, bottom, this.dialogueBackdrop, this.dialogue, this.placeBackdrop, this.placeSheet, this.cardLayer, this.breatheLayer, this.fadeEl);
    document.getElementById('app')!.appendChild(root);

    // 털어놓기
    this.confide = createConfide({
      root,
      onOpen: () => {
        this.modal++;
        this.closeDialogue();
      },
      onClose: () => {
        this.modal = Math.max(0, this.modal - 1);
        this.wake();
      },
      onConfided: () => {
        this.didConfide = true;
      },
    });

    // 게임이 알려주는 일들
    this.events = {
      onPlace: (id) => {
        if (this.active && !this.welcoming && F.places[id]) this.flashHint(F.places[id]);
      },
      onSeated: (seated) => {
        this.renderSit(seated);
        root.classList.toggle('seated', seated);
        document.getElementById('fallback-art')?.classList.toggle('seated', seated);
      },
      onResearcher: (id) => {
        this.hidePick();
        this.openResearcher(id);
      },
      onSign: (id) => {
        this.hidePick();
        this.openSign(id);
      },
      onToast: (text) => toast(text),
      onFirstMove: () => {
        setPref('moved', '1');
        this.moveHint.classList.remove('on');
      },
      onUserInput: () => {
        this.wake();
        if (!this.soundCta.hidden) this.soundCta.hidden = true;
      },
      requestFade: (mid) => void this.fade(mid),
    };

    window.addEventListener('keydown', (e) => this.onKey(e));
    root.addEventListener('pointerdown', () => this.wake(), true);
  }

  // ------------------------------------------------------------ 표시

  private renderSound(): void {
    const B = COPY.forest.buttons;
    const on = audio.enabled;
    this.soundBtn.innerHTML = (on ? ICON.soundOn : ICON.soundOff) + `<span>${B.sound}</span>`;
    this.soundBtn.setAttribute('aria-label', B.sound);
    this.soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  private renderSit(seated: boolean): void {
    const B = COPY.forest.buttons;
    const text = seated ? B.stand : B.sit;
    this.sitBtn.innerHTML = (seated ? ICON.stand : ICON.sit) + `<span>${text}</span>`;
    this.sitBtn.setAttribute('aria-label', text);
  }

  private buildPick(): HTMLElement {
    const P = COPY.forest.avatarPick;
    const sw = h('div', { class: 'swatches' });
    for (const id of OUTFIT_IDS) {
      const b = h('button', { type: 'button', class: 'swatch', 'aria-label': P.colors[id], 'aria-pressed': id === this.outfit ? 'true' : 'false' }, h('i', { style: `background:${OUTFITS[id].css}` }), P.colors[id]);
      b.addEventListener('click', () => {
        this.outfit = id;
        setPref('outfit', id);
        this.stage?.setOutfit(id);
        sw.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        window.setTimeout(() => this.hidePick(), 900);
      });
      sw.appendChild(b);
    }
    return h('div', { class: 'pick', hidden: '' }, h('p', null, P.title), sw);
  }
  private hidePick(): void {
    this.pick.hidden = true;
  }

  /** 숲에 들어온 직후 한 번: 환영 문구(4초) → 이동 안내, 옷 색 고르기 */
  async show(first: boolean): Promise<void> {
    const root = this.el;
    root.hidden = false;
    void root.offsetWidth;
    root.classList.add('on');
    this.active = true;
    this.wake();
    if (!first) return;
    this.welcoming = true;
    const W = COPY.forest.welcome;
    this.welcome.textContent = W[params.src] || W.default;
    this.pick.hidden = false;
    if (this.opts.directEntry && audio.enabled && !audio.started) this.soundCta.hidden = false;
    await wait(700);
    this.welcome.classList.add('on');
    await wait(4000);
    this.welcome.classList.remove('on');
    await wait(900);
    this.welcoming = false;
    // 이동 안내(첫 입장 1회)
    if (getPref('moved') !== '1' && this.active) {
      this.moveHint.textContent = COPY.forest.moveHint;
      this.moveHint.classList.add('on');
      window.setTimeout(() => this.moveHint.classList.remove('on'), 9000);
    }
    window.setTimeout(() => this.hidePick(), 8000);
  }

  hide(): void {
    this.active = false;
    this.el.classList.remove('on');
    this.stopBreathing(false);
    this.closeDialogue();
    this.closeCard();
    this.openPlaces(false);
    this.confide.close();
    window.setTimeout(() => {
      if (!this.active) this.el.hidden = true;
    }, 900);
  }

  /** 5초간 입력이 없으면 옅어지고, 화면을 누르면 다시 선명해짐 */
  wake(): void {
    this.el.classList.remove('idle');
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      if (this.modal === 0) this.el.classList.add('idle');
    }, 5000);
  }

  private flashHint(text: string): void {
    if (this.welcome.classList.contains('on')) return;
    this.welcome.textContent = text;
    this.welcome.classList.add('on');
    window.setTimeout(() => {
      if (this.welcome.textContent === text) this.welcome.classList.remove('on');
    }, 2400);
  }

  private async fade(mid: () => void): Promise<void> {
    this.fadeEl.classList.add('on');
    await wait(520);
    mid();
    await wait(160);
    this.fadeEl.classList.remove('on');
  }

  private setLayer(el: HTMLElement, on: boolean, ms = 500): void {
    if (on) {
      el.hidden = false;
      void el.offsetWidth;
      el.classList.add('on');
    } else if (!el.hidden) {
      el.classList.remove('on');
      window.setTimeout(() => {
        if (!el.classList.contains('on')) el.hidden = true;
      }, ms);
    }
  }

  private openPlaces(on: boolean): void {
    if (on) this.closeDialogue();
    this.setLayer(this.placeBackdrop, on, 400);
    this.setLayer(this.placeSheet, on, 500);
  }

  private requestExit(): void {
    if (this.stage?.isSeated) this.stage.toggleSit();
    this.opts.onExit();
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.active) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) {
      if (e.key === 'Escape') this.confide.close();
      return;
    }
    if (e.key === 'Escape') {
      if (this.stage?.breathing) this.stopBreathing(true);
      else if (this.confide.isOpen()) this.confide.close();
      else if (!this.placeSheet.hidden) this.openPlaces(false);
      else if (!this.cardLayer.hidden) this.closeCard();
      else if (this.talk) this.closeDialogue();
      else this.requestExit();
      return;
    }
    if (this.modal > 0 || this.stage?.breathing) return;
    if (e.key === '1') this.stage?.toggleSit();
    else if (e.key === '2') this.startBreathing();
    else if (e.key === '3') this.confide.open();
    else return;
    this.wake();
  }

  // ------------------------------------------------------------ 숨쉬기

  /** 4초 들이쉬기 → 2초 멈춤 → 6초 내쉬기, 3회 */
  startBreathing(): void {
    const st = this.stage;
    if (!st || st.breathing || this.confide.isOpen()) return;
    this.closeDialogue();
    st.breathing = true;
    this.el.classList.add('breathing');
    this.setLayer(this.breatheLayer, true);
    audio.start();
    audio.chime();
    audio.setBreathing(true);
    const Bc = COPY.breathe;
    const IN = 4;
    const HOLD = 2;
    const OUT = 6;
    const CYCLE = IN + HOLD + OUT;
    const ROUNDS = 3;
    const t0 = performance.now();
    let phase = '';
    const setText = (p: string, text: string): void => {
      if (phase !== p) {
        phase = p;
        this.breatheText.textContent = text;
      }
    };
    const tick = (): void => {
      const t = (performance.now() - t0) / 1000;
      if (t >= CYCLE * ROUNDS) {
        this.stopBreathing(false, true);
        return;
      }
      const c = t % CYCLE;
      let amt: number;
      if (c < IN) {
        const k = c / IN;
        amt = k * k * (3 - 2 * k);
        setText('in', Bc.inhale);
      } else if (c < IN + HOLD) {
        amt = 1;
        setText('hold', Bc.hold);
      } else {
        const k = (c - IN - HOLD) / OUT;
        amt = 1 - k * k * (3 - 2 * k);
        setText('out', Bc.exhale);
      }
      st.breathAmount = amt;
      this.breatheCircle.style.transform = `scale(${(0.55 + amt * 0.45).toFixed(4)})`;
      this.breatheRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  private stopBreathing(byUser: boolean, completed = false): void {
    const st = this.stage;
    if (!st || !st.breathing) return;
    cancelAnimationFrame(this.breatheRaf);
    st.breathing = false;
    st.breathAmount = 0;
    this.el.classList.remove('breathing');
    this.setLayer(this.breatheLayer, false, 1000);
    audio.setBreathing(false);
    audio.chime();
    this.wake();
    if (completed || byUser) {
      if (completed) track('breathe_done', { count: 3 });
      toast(COPY.breathe.done, 4200);
    }
  }

  // ------------------------------------------------------------ 숲지기 연구원

  private openResearcher(id: string): void {
    if (this.stage?.breathing || this.confide.isOpen()) return;
    // 재방문자에게는 처음 만나는 연구원이 질문을 건넴(누를 때만)
    if (this.stage?.quizPending) {
      this.stage.quizPending = false;
      this.metResearcher = true;
      track('researcher_click', { id });
      this.openQuiz();
      return;
    }
    if (this.talk && this.talk.id === id) {
      this.advanceDialogue();
      return;
    }
    this.metResearcher = true;
    track('researcher_click', { id });
    window.clearTimeout(this.talk?.timer);
    this.talk = { id, idx: 0, timer: 0 };
    this.renderDialogue();
    this.setLayer(this.dialogueBackdrop, true, 10);
    this.setLayer(this.dialogue, true);
  }

  private renderDialogue(): void {
    if (!this.talk) return;
    const lines = COPY.researchers[this.talk.id] || [];
    this.dialogueLine.textContent = lines[this.talk.idx % lines.length] || '';
    this.stage?.keepTalking(this.talk.id);
    window.clearTimeout(this.talk.timer);
    // 5초 뒤 자동으로 닫힘
    this.talk.timer = window.setTimeout(() => this.closeDialogue(), 5000);
  }

  private advanceDialogue(): void {
    if (!this.talk) return;
    this.talk.idx++;
    this.renderDialogue();
  }

  private closeDialogue(): void {
    if (!this.talk) return;
    window.clearTimeout(this.talk.timer);
    this.talk = null;
    this.setLayer(this.dialogue, false);
    this.dialogueBackdrop.hidden = true;
    this.dialogueBackdrop.classList.remove('on');
  }

  // ------------------------------------------------------------ 표찰·질문 카드

  private openSign(id: string): void {
    const s = COPY.signs[id];
    if (!s || this.stage?.breathing) return;
    track('sign_read', { id });
    const card = h('div', { class: 'card-box sign-card', role: 'dialog', 'aria-label': s.name }, h('h2', null, s.name), h('p', null, s.line));
    card.addEventListener('click', () => this.closeCard());
    this.cardLayer.dataset.kind = 'sign';
    this.cardLayer.replaceChildren(card);
    this.setLayer(this.cardLayer, true);
    window.clearTimeout(this.cardTimer);
    this.cardTimer = window.setTimeout(() => this.closeCard(), 6000);
  }

  private closeCard(): void {
    window.clearTimeout(this.cardTimer);
    if (this.cardLayer.hidden) return;
    if (this.cardLayer.dataset.kind === 'quiz') this.modal = Math.max(0, this.modal - 1);
    this.cardLayer.dataset.kind = '';
    this.setLayer(this.cardLayer, false, 800);
  }

  /** 숲지기의 질문 (재방문자 전용, 지연 기억 측정). 채점 느낌 없이 */
  private openQuiz(): void {
    const R = COPY.recall;
    const options = [...shuffle(R.options), R.dontKnow];
    const list = h('div', { class: 'options' });
    const card = h('div', { class: 'card-box', role: 'dialog', 'aria-label': R.question }, h('p', { class: 'lead' }, R.lead), h('h2', null, R.question), list);
    for (const text of options) {
      const b = h('button', { type: 'button', class: 'btn block' }, text);
      b.addEventListener('click', () => {
        const correct = text === SIGNATURE_FULL;
        track('recall_answer', { answer: text, correct });
        card.replaceChildren(h('p', { class: 'lead' }, COPY.forest.researcherName), h('p', { style: 'font-size:21px;color:var(--title);margin:8px 0 4px' }, correct ? R.correct : R.wrong));
        window.clearTimeout(this.cardTimer);
        this.cardTimer = window.setTimeout(() => this.closeCard(), 3800);
      });
      list.appendChild(b);
    }
    this.modal++;
    this.cardLayer.dataset.kind = 'quiz';
    this.cardLayer.replaceChildren(card);
    this.setLayer(this.cardLayer, true);
  }

  get reducedMotion(): boolean {
    return prefersReducedMotion;
  }
}
