import { COPY, CRISIS_PATTERNS } from '../data/copy';
import { h, prefersReducedMotion, wait } from '../core/util';
import { ICON } from './icons';
import { audio } from '../core/audio';
import { track } from '../core/metrics';

/**
 * 털어놓기 ('임금님 귀는 당나귀 귀')
 * ------------------------------------------------------------
 * 개인정보 원칙 (제작 지시서 2-6)
 *  - 입력 내용은 어디에도 저장·전송하지 않습니다. localStorage·네트워크·콘솔 어디에도 쓰지 않습니다.
 *  - "숲에 묻기"를 누르는 순간 입력창과 변수를 비우고, 화면에 흩어지는 낱글자만
 *    연출이 끝날 때까지 메모리에 두었다가 즉시 비웁니다.
 *  - 측정에는 횟수만 남깁니다(내용 없음).
 */

interface Glyph {
  ch: string;
  x: number;
  y: number;
  delay: number;
  life: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  ph: number;
  size: number;
}

export interface ConfideHost {
  root: HTMLElement;
  onOpen(): void;
  onClose(): void;
  /** 흩어지는 연출까지 끝났을 때 */
  onConfided(): void;
}

export function createConfide(host: ConfideHost): { open(): void; close(): void; isOpen(): boolean } {
  const C = COPY.confide;
  const backdrop = h('div', { class: 'sheet-backdrop', hidden: '' });
  const textarea = h('textarea', {
    maxlength: '200',
    placeholder: C.placeholder,
    'aria-label': C.placeholder,
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
  });
  const count = h('p', { class: 'count', 'aria-hidden': 'true' }, '0 / 200');
  const submit = h('button', { type: 'button', class: 'btn primary', 'aria-label': C.submit, html: ICON.leaf + `<span>${C.submit}</span>` });
  const closeBtn = h('button', { type: 'button', class: 'btn', 'aria-label': C.close, html: ICON.close + `<span>${C.close}</span>` });
  const sheet = h(
    'div',
    { class: 'sheet paper', role: 'dialog', 'aria-modal': 'true', 'aria-label': COPY.forest.buttons.confide, hidden: '' },
    h('p', { class: 'guide' }, C.guide),
    textarea,
    count,
    h('div', { class: 'row' }, closeBtn, submit),
    h('p', { class: 'foot' }, C.footer),
  );
  const canvas = h('canvas', { id: 'scatter', hidden: '' });
  const leaf = h('div', { class: 'falling-leaf', html: ICON.leaf });
  const message = h(
    'div',
    { class: 'center-layer passive', hidden: '', role: 'status' },
    leaf,
    h('div', { class: 'message' }, h('p', { class: 'm-title' }, C.after.title), h('p', null, C.after.line1), h('p', null, C.after.line2)),
  );
  // 위기 표현 안내
  const K = COPY.crisis;
  const call = h('a', { class: 'btn primary', href: 'tel:109', 'aria-label': `${K.call} ${K.number}`, html: ICON.phone + `<span>${K.call}</span>` });
  const crisisClose = h('button', { type: 'button', class: 'btn', html: ICON.close + `<span>${K.close}</span>` });
  const crisis = h(
    'div',
    { class: 'center-layer dim', hidden: '' },
    h(
      'div',
      { class: 'card-box', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': K.title },
      h('h2', null, K.title),
      h('p', null, K.line1),
      h('p', null, K.line2pre, h('strong', null, K.number), K.line2post),
      h('div', { class: 'row' }, crisisClose, call),
    ),
  );
  host.root.append(backdrop, sheet, canvas, message, crisis);

  let opened = false;
  let busy = false;

  const setLayer = async (el: HTMLElement, on: boolean, ms = 800): Promise<void> => {
    if (on) {
      el.hidden = false;
      void el.offsetWidth;
      el.classList.add('on');
    } else {
      el.classList.remove('on');
      await wait(ms);
      el.hidden = true;
    }
  };

  const open = (): void => {
    if (opened || busy) return;
    opened = true;
    host.onOpen();
    textarea.value = '';
    count.textContent = '0 / 200';
    void setLayer(backdrop, true);
    void setLayer(sheet, true);
    window.setTimeout(() => {
      try {
        textarea.focus({ preventScroll: true });
      } catch {
        /* noop */
      }
    }, 350);
  };

  const close = (): void => {
    if (!opened) return;
    opened = false;
    textarea.value = '';
    textarea.blur();
    void setLayer(backdrop, false, 400);
    void setLayer(sheet, false, 500);
    host.onClose();
  };

  textarea.addEventListener('input', () => {
    if (textarea.value.length > 200) textarea.value = textarea.value.slice(0, 200);
    count.textContent = `${textarea.value.length} / 200`;
  });
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  crisisClose.addEventListener('click', () => void setLayer(crisis, false, 500));

  /** 입력창의 글자 위치를 그대로 재서 낱글자로 만듦 */
  const measure = (text: string): Glyph[] => {
    const mirror = h('div', { class: 'mirror' });
    const rect = textarea.getBoundingClientRect();
    const srect = sheet.getBoundingClientRect();
    mirror.style.left = rect.left - srect.left + 'px';
    mirror.style.top = rect.top - srect.top + 'px';
    mirror.style.width = rect.width + 'px';
    mirror.style.height = rect.height + 'px';
    const spans: HTMLSpanElement[] = [];
    for (const ch of Array.from(text)) {
      if (ch === '\n') {
        mirror.appendChild(document.createElement('br'));
        continue;
      }
      const s = document.createElement('span');
      s.textContent = ch;
      mirror.appendChild(s);
      if (ch.trim()) spans.push(s);
    }
    sheet.appendChild(mirror);
    mirror.scrollTop = textarea.scrollTop;
    const n = spans.length;
    const per = Math.min(0.022, 1.25 / Math.max(1, n));
    const glyphs: Glyph[] = [];
    spans.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      if (r.bottom < rect.top - 4 || r.top > rect.bottom + 4) return;
      glyphs.push({
        ch: s.textContent || '',
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        delay: i * per + Math.random() * 0.05,
        life: 1.35 + Math.random() * 0.5,
        vx: 40 + Math.random() * 90,
        vy: -(70 + Math.random() * 90),
        rot: 0,
        vr: (Math.random() - 0.5) * 5,
        ph: Math.random() * 6.28,
        size: r.height * 0.72,
      });
    });
    mirror.remove();
    return glyphs;
  };

  /** 글자들이 한 글자씩 떨어져 나와 바람을 타고 숲 쪽으로 흩어지며 사라짐 */
  const scatter = (glyphs: Glyph[]): Promise<void> =>
    new Promise((resolve) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const hgt = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hgt * dpr);
      canvas.hidden = false;
      const g = canvas.getContext('2d')!;
      const family = getComputedStyle(textarea).fontFamily;
      // 숲 쪽(화면 위 가운데)으로 모이며 흩어짐
      const targetX = w * 0.5;
      const targetY = hgt * 0.3;
      let last = performance.now();
      let t = 0;
      const total = Math.max(...glyphs.map((p) => p.delay + p.life), 0.5);
      const trail: Array<{ x: number; y: number; life: number; r: number }> = [];
      const frame = (now: number): void => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        t += dt;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, hgt);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (const p of glyphs) {
          const a = t - p.delay;
          if (a > p.life) continue;
          let alpha = 1;
          let k = 0;
          if (a > 0) {
            k = a / p.life;
            // 바람: 처음엔 살짝 떠오르다가 점점 빨라지며 숲 쪽으로
            const pull = k * k * 2.2;
            p.vx += ((targetX - p.x) * 0.9 * pull + Math.sin(t * 3.1 + p.ph) * 120) * dt;
            p.vy += ((targetY - p.y) * 0.9 * pull - 60 + Math.cos(t * 2.3 + p.ph * 1.7) * 90) * dt;
            p.x += p.vx * dt * (0.4 + k * 1.4);
            p.y += p.vy * dt * (0.4 + k * 1.4);
            p.rot += p.vr * dt * (0.3 + k * 2);
            alpha = 1 - k * k;
            if (Math.random() < 0.18) trail.push({ x: p.x, y: p.y, life: 0.6, r: 1 + Math.random() * 1.6 });
          }
          const scale = 1 - k * 0.6;
          // 종이 위에서는 먹색, 종이가 내려가면 따뜻한 빛으로 바뀌어 어두운 숲 위에서도 보이게
          const lk = Math.min(1, t / 0.45);
          const c = 'rgba(' + Math.round(47 + 194 * lk) + ',' + Math.round(40 + 186 * lk) + ',' + Math.round(30 + 160 * lk) + ',' + alpha + ')';
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.scale(scale, scale);
          g.font = `500 ${p.size}px ${family}`;
          if (lk > 0.3) {
            g.shadowColor = 'rgba(0,0,0,0.6)';
            g.shadowBlur = 6;
          }
          g.fillStyle = c;
          g.fillText(p.ch, 0, 0);
          g.restore();
        }
        for (let i = trail.length - 1; i >= 0; i--) {
          const q = trail[i];
          q.life -= dt;
          q.y -= 14 * dt;
          q.x += 22 * dt;
          if (q.life <= 0) {
            trail.splice(i, 1);
            continue;
          }
          g.beginPath();
          g.arc(q.x, q.y, q.r, 0, Math.PI * 2);
          g.fillStyle = `rgba(233,201,138,${q.life * 0.9})`;
          g.fill();
        }
        if (t < total + 0.5) requestAnimationFrame(frame);
        else {
          g.clearRect(0, 0, w, hgt);
          canvas.hidden = true;
          // 연출이 끝나면 낱글자도 즉시 비움
          for (const p of glyphs) p.ch = '';
          glyphs.length = 0;
          trail.length = 0;
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });

  const bury = async (): Promise<void> => {
    if (busy) return;
    let text = textarea.value;
    if (!text.trim()) {
      textarea.focus();
      return;
    }
    busy = true;
    // 위기 표현이 있으면 흩어지는 연출 대신 차분한 안내
    const isCrisis = CRISIS_PATTERNS.some((re) => re.test(text));
    if (isCrisis) {
      textarea.value = '';
      text = '';
      close();
      await setLayer(crisis, true);
      busy = false;
      return;
    }
    const glyphs = prefersReducedMotion ? [] : measure(text);
    // 연출 시작과 동시에 입력 내용 삭제
    textarea.value = '';
    text = '';
    count.textContent = '0 / 200';
    textarea.blur();
    opened = false;
    void setLayer(backdrop, false, 400);
    void setLayer(sheet, false, 500);
    audio.gust();
    track('confide_done', { count: 1 });
    if (glyphs.length) await scatter(glyphs);
    else await wait(1200);
    await wait(1000);
    // 나뭇잎 하나가 떨어지며 문구
    leaf.classList.remove('go');
    void leaf.offsetWidth;
    if (!prefersReducedMotion) leaf.classList.add('go');
    await setLayer(message, true);
    host.onConfided();
    await wait(5000);
    await setLayer(message, false, 900);
    busy = false;
    host.onClose();
  };
  submit.addEventListener('click', () => void bury());

  return { open, close, isOpen: () => opened || busy };
}
