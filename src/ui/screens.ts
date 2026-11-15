import { COPY } from '../data/copy';
import { h, shuffle, wait } from '../core/util';
import { ICON, symbolSvg } from './icons';
import { track } from '../core/metrics';

export interface Forest {
  id: string;
  name: string;
  region: string;
  group: string;
  status: string;
  preparingLine?: string;
  entryLine?: string;
  bookingUrl?: string;
  thumbnailHue: number;
}

const app = (): HTMLElement => document.getElementById('app')!;

export function showScreen(el: HTMLElement): void {
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add('on');
  el.scrollTop = 0;
}
export async function hideScreen(el: HTMLElement, ms = 800): Promise<void> {
  if (el.hidden) return;
  el.classList.remove('on');
  await wait(ms);
  el.hidden = true;
}

/** 토스트 안내 */
let toastBox: HTMLElement | null = null;
export function toast(text: string, ms = 3600): void {
  if (!toastBox) {
    toastBox = h('div', { id: 'toasts', role: 'status', 'aria-live': 'polite' });
    app().appendChild(toastBox);
  }
  // 같은 안내가 이미 떠 있으면 다시 띄우지 않음
  for (const c of Array.from(toastBox.children)) if (c.textContent === text) return;
  const t = h('div', { class: 'toast' }, text);
  toastBox.appendChild(t);
  void t.offsetWidth;
  t.classList.add('on');
  window.setTimeout(() => {
    t.classList.remove('on');
    window.setTimeout(() => t.remove(), 600);
  }, ms);
}

// ------------------------------------------------------------ ① 첫 로딩

export function createBootScreen(): { el: HTMLElement; run(ready: Promise<unknown>): Promise<void> } {
  const bar = h('i');
  const progress = h('div', { class: 'progress', role: 'progressbar', 'aria-label': COPY.boot.title }, bar);
  const wrap = h('div', { class: 'progress-wrap' }, progress);
  const line = h('p', { class: 'lines fade-line' });
  const el = h(
    'section',
    { id: 'screen-boot', class: 'screen center', 'aria-label': COPY.boot.title },
    h(
      'div',
      { class: 'inner' },
      h('div', { class: 'breathing-symbol', html: symbolSvg(84) }),
      h('h1', { class: 'title big' }, COPY.boot.title),
      h('p', { class: 'subtitle' }, COPY.boot.subtitle),
      wrap,
      line,
    ),
  );
  app().appendChild(el);

  return {
    el,
    async run(ready) {
      showScreen(el);
      const lines = COPY.boot.lines;
      let idx = Math.floor(Math.random() * lines.length);
      const show = (i: number): void => {
        line.textContent = lines[i];
        track('loading_line_shown', { line: i + 1 });
      };
      show(idx);
      let done = false;
      const started = performance.now();
      void ready.then(
        () => (done = true),
        () => (done = true),
      );
      // 진행 바: 실제 준비가 끝나도 최소 3초
      const MIN = 3000;
      let nextSwap = 3000;
      await new Promise<void>((resolve) => {
        const step = (): void => {
          const t = performance.now() - started;
          const p = done ? Math.min(1, t / MIN) : Math.min(0.9, (t / MIN) * 0.9);
          bar.style.width = (p * 100).toFixed(1) + '%';
          if (t >= nextSwap && !(done && t >= MIN)) {
            // 로딩이 3초를 넘으면 3초마다 문구 교체(페이드)
            nextSwap += 3000;
            idx = (idx + 1) % lines.length;
            line.classList.add('out');
            const ni = idx;
            window.setTimeout(() => {
              show(ni);
              line.classList.remove('out');
            }, 600);
          }
          if (done && t >= MIN) resolve();
          else window.setTimeout(step, 80);
        };
        step();
      });
      bar.style.width = '100%';
      await wait(250);
      wrap.replaceChildren(h('p', { class: 'arrived' }, COPY.boot.done));
      await wait(800);
    },
  };
}

// ------------------------------------------------------------ ② 숲 고르기

/** 같은 스타일의 단순한 숲 실루엣 (색만 다르게). 실제 시설 모습은 그리지 않습니다. */
function forestThumb(hue: number, open: boolean): string {
  const s = open ? 46 : 26;
  const sky1 = `hsl(${(hue + 200) % 360} 30% 20%)`;
  const sky2 = open ? `hsl(${hue} 62% 46%)` : `hsl(${hue} 22% 34%)`;
  const far = `hsl(${hue} ${s - 14}% 24%)`;
  const mid = `hsl(${hue} ${s}% ${open ? 30 : 22}%)`;
  const near = `hsl(${hue} ${s - 6}% 14%)`;
  const t1 = `hsl(${hue} ${s + 6}% ${open ? 40 : 27}%)`;
  const t2 = `hsl(${(hue + 18) % 360} ${s}% ${open ? 34 : 24}%)`;
  const id = 'g' + hue + (open ? 'o' : 's');
  return `<svg viewBox="0 0 104 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient></defs>
    <rect width="104" height="80" fill="url(#${id})"/>
    <path d="M0 50 L18 36 L34 46 L52 28 L70 44 L88 34 L104 46 V80 H0Z" fill="${far}"/>
    <path d="M0 60 Q26 46 52 56 T104 54 V80 H0Z" fill="${mid}"/>
    <g class="sway"><path d="M22 66 L30 40 L38 66Z" fill="${t2}"/><rect x="29" y="64" width="2" height="6" fill="${near}"/></g>
    <g class="sway b"><circle cx="56" cy="50" r="10" fill="${t1}"/><rect x="55" y="58" width="2.4" height="10" fill="${near}"/></g>
    <g class="sway"><path d="M74 66 L81 44 L88 66Z" fill="${t2}"/><rect x="80" y="64" width="2" height="6" fill="${near}"/></g>
    <g class="sway b"><circle cx="40" cy="58" r="6.500" fill="${t2}"/></g>
    <path d="M0 68 Q30 62 54 68 T104 66 V80 H0Z" fill="${near}"/>
  </svg>`;
}

export function createSelectScreen(forests: Forest[], onPick: (f: Forest) => void): { el: HTMLElement } {
  const inner = h(
    'div',
    { class: 'inner' },
    h('p', { class: 'label' }, COPY.select.label),
    h('h1', { class: 'title' }, COPY.select.title),
    h('p', { class: 'subtitle' }, COPY.select.subtitle),
  );
  const groups: string[] = [];
  for (const f of forests) if (!groups.includes(f.group)) groups.push(f.group);
  for (const g of groups) {
    inner.appendChild(h('h2', { class: 'group-title' }, g));
    const grid = h('div', { class: 'cards' });
    for (const f of forests.filter((x) => x.group === g)) {
      const open = f.status === 'open';
      const statusText = open ? COPY.select.open : COPY.select.soon;
      const card = h(
        'button',
        {
          type: 'button',
          class: 'card ' + (open ? 'open' : 'soon'),
          'aria-label': `${f.name}, ${f.region}, ${statusText}`,
        },
        h('span', { class: 'thumb', html: forestThumb(f.thumbnailHue, open) }),
        h(
          'span',
          null,
          h('span', { class: 'name' }, f.name),
          h('span', { class: 'region' }, f.region),
          h('span', { class: 'status', html: (open ? ICON.bench : ICON.sprout) + `<span>${statusText}</span>` }),
        ),
      );
      card.addEventListener('click', () => {
        if (open) onPick(f);
        else toast(COPY.select.soonToast);
      });
      grid.appendChild(card);
    }
    inner.appendChild(grid);
    if (g === '치유의숲') inner.appendChild(h('p', { class: 'more-note' }, COPY.select.moreHealingForests));
  }
  inner.appendChild(h('p', { class: 'select-footer' }, COPY.select.footer));
  const el = h('section', { id: 'screen-select', class: 'screen', 'aria-label': COPY.select.title, hidden: '' }, inner);
  app().appendChild(el);
  return { el };
}

// ------------------------------------------------------------ ③ 숲 진입 로딩

export function createEntryScreen(): { el: HTMLElement; run(f: Forest, task: Promise<unknown>): Promise<void> } {
  const label = h('p', { class: 'label' });
  const prep = h('p', { class: 'lines' });
  const bar = h('i');
  const entry = h('p', { class: 'lines fade-line' });
  const el = h(
    'section',
    { id: 'screen-entry', class: 'screen center', hidden: '' },
    h(
      'div',
      { class: 'inner' },
      h('div', { class: 'breathing-symbol', html: symbolSvg(72) }),
      h('div', { style: 'height:14px' }),
      label,
      h('div', { style: 'height:8px' }),
      prep,
      h('div', { class: 'progress', role: 'progressbar' }, bar),
      entry,
    ),
  );
  app().appendChild(el);
  return {
    el,
    async run(f, task) {
      label.textContent = COPY.entry.labelOf(f.name);
      prep.textContent = f.preparingLine || '';
      entry.textContent = f.entryLine || '';
      bar.style.transition = 'none';
      bar.style.width = '0%';
      showScreen(el);
      await wait(60);
      bar.style.transition = 'width 2.2s ease';
      bar.style.width = '86%';
      // 최소 2초 표시
      await Promise.all([task.catch(() => undefined), wait(2000)]);
      bar.style.transition = 'width 0.3s ease';
      bar.style.width = '100%';
      await wait(380);
    },
  };
}

// ------------------------------------------------------------ ⑤ 종료 화면

export interface ExitOptions {
  forest: Forest;
  variant: 'A' | 'B' | 'C';
  stayedSeconds: number;
  onStay(): void;
  onOtherForests(): void;
}

export function createExitScreen(): { el: HTMLElement; show(o: ExitOptions): void } {
  const el = h('section', { id: 'screen-exit', class: 'screen center', hidden: '' });
  app().appendChild(el);
  let timer = 0;

  return {
    el,
    show(o) {
      window.clearTimeout(timer);
      const E = COPY.exit;
      const minutes = Math.floor(o.stayedSeconds / 60);
      const time = minutes < 1 ? E.moment : E.minutes(minutes);
      const body = h('div', { class: 'lines exit-body' });
      let title = '';
      if (o.variant === 'B') {
        title = E.B.title;
        body.append(h('p', null, E.B.line1), h('p', null, E.B.line2), h('p', { class: 'sign' }, E.B.sign));
      } else if (o.variant === 'C') {
        title = E.C.title;
        body.append(h('p', null, E.C.line1), h('p', { class: 'sign' }, E.C.sign));
      } else {
        title = E.A.title;
        body.append(h('p', null, E.A.line1.replace('{time}', time)), h('p', null, E.A.line2));
      }

      const stay = h('button', { type: 'button', class: 'btn primary', 'aria-label': E.stay, html: ICON.bench + `<span>${E.stay}</span>` });
      const revisit = h('button', { type: 'button', class: 'btn', 'aria-label': E.revisit, html: ICON.tree + `<span>${E.revisit}</span>` });
      const other = h('button', { type: 'button', class: 'text-link' }, E.otherForests);
      stay.addEventListener('click', o.onStay);
      other.addEventListener('click', o.onOtherForests);
      revisit.addEventListener('click', () => {
        track('booking_click', { forest: o.forest.id });
        if (o.forest.bookingUrl) window.open(o.forest.bookingUrl, '_blank', 'noopener');
        else toast(E.bookingMissing);
      });

      const survey = h('div', { class: 'survey', 'aria-live': 'polite' });
      const inner = h(
        'div',
        { class: 'inner' },
        h('div', { class: 'breathing-symbol', html: symbolSvg(64) }),
        h('div', { style: 'height:12px' }),
        // 라벨은 항상 같은 자리, 같은 표기
        h('p', { class: 'label' }, E.labelOf(o.forest.name)),
        h('h1', { class: 'title' }, title),
        body,
        h('div', { class: 'exit-actions' }, stay, revisit),
        other,
        survey,
        h('p', { class: 'exit-footer' }, E.footer),
      );
      el.replaceChildren(inner);
      buildSurvey(survey);
      // 종료 메시지가 먼저 3초 보인 뒤 설문 영역이 부드럽게 열림
      timer = window.setTimeout(() => survey.classList.add('on'), 3000);
      showScreen(el);
    },
  };
}

/** 선택형 인지 설문: 한 번에 한 문항, 언제든 건너뛸 수 있음 */
function buildSurvey(box: HTMLElement): void {
  const E = COPY.exit;
  const skip = h('button', { type: 'button', class: 'btn', 'aria-label': E.surveySkip, html: ICON.skip + `<span>${E.surveySkip}</span>` });
  const head = h(
    'div',
    { class: 'survey-head' },
    h('p', null, E.surveyLead + ' ', h('span', null, E.surveyOptional)),
    skip,
  );
  const area = h('div');
  box.replaceChildren(head, area);
  let i = 0;
  const finish = (thanks: boolean): void => {
    head.remove();
    area.replaceChildren(thanks ? h('p', { class: 'thanks' }, E.surveyDone) : h('span'));
    if (!thanks) {
      box.classList.remove('on');
    }
  };
  const render = (): void => {
    if (i >= E.survey.length) {
      finish(true);
      return;
    }
    const q = E.survey[i];
    let opts = q.shuffle ? shuffle(q.options) : q.options.slice();
    if (q.last) opts = [...opts, q.last];
    const list = h('div', { class: 'options' });
    for (const text of opts) {
      const b = h('button', { type: 'button', class: 'btn block' }, text);
      b.addEventListener('click', () => {
        // 응답은 로컬 측정에만 기록 (개인 식별 정보 없음)
        track('survey_answer', { q: i + 1, answer: text, skipped: false });
        i++;
        render();
      });
      list.appendChild(b);
    }
    area.replaceChildren(h('p', { class: 'step' }, `${i + 1} / ${E.survey.length}`), h('p', { class: 'q' }, q.q), list);
  };
  skip.addEventListener('click', () => {
    for (let k = i; k < E.survey.length; k++) track('survey_answer', { q: k + 1, answer: '', skipped: true });
    i = E.survey.length;
    finish(false);
  });
  render();
}
