import { COPY } from '../data/copy';
import { h } from '../core/util';
import { clearMetrics, onMetricsChanged, summarize } from '../core/metrics';

/**
 * 측정 패널 (?debug=1)
 * 발표에서 "이렇게 측정한다"를 보여주기 위한 화면 구석의 작은 패널입니다.
 * 경로별·대상군별 방문 수, 설문 응답 분포, 재방문 질문 정답률, FPS.
 */
export function mountDebugPanel(getFps: () => { fps: number; low: boolean } | null): void {
  const body = h('div');
  const fps = h('span', null, 'FPS –');
  const reset = h('button', { type: 'button' }, COPY.debug.reset);
  const head = h('h3', null, h('span', null, COPY.debug.title), fps);
  const el = h('aside', { id: 'debug', 'aria-label': COPY.debug.title }, head, body, h('div', { style: 'margin-top:8px;text-align:right' }, reset));
  document.body.appendChild(el);
  head.addEventListener('click', () => el.classList.toggle('min'));
  reset.addEventListener('click', () => clearMetrics());

  const table = (title: string, rows: Array<[string, string | number]>): string =>
    `<h4>${title}</h4><table>${rows.length ? rows.map(([k, v]) => `<tr><td>${escapeHtml(String(k))}</td><td>${escapeHtml(String(v))}</td></tr>`).join('') : '<tr><td>–</td><td></td></tr>'}</table>`;

  const D = COPY.debug;
  const render = (): void => {
    const s = summarize();
    let html = '';
    html += table(D.bySrc, Object.entries(s.visitsBySrc));
    html += table(D.byCohort, Object.entries(s.visitsByCohort));
    html += table(D.engage, [
      [D.rows.enter, s.enters],
      [D.rows.place, s.counts.place_visit || 0],
      [D.rows.sit, s.counts.sit || 0],
      [D.rows.breathe, s.counts.breathe_done || 0],
      [D.rows.confide, s.counts.confide_done || 0],
      [D.rows.researcher, s.counts.researcher_click || 0],
      [D.rows.sign, s.counts.sign_read || 0],
      [D.rows.exit, s.counts.exit_shown || 0],
      [D.rows.booking, s.counts.booking_click || 0],
    ]);
    for (const q of Object.keys(s.survey).sort()) {
      html += table(D.surveyOf(q), Object.entries(s.survey[q]));
    }
    const rate = s.recall.total ? Math.round((s.recall.correct / s.recall.total) * 100) + '%' : '–';
    html += table(D.recall, [
      [D.recallCount, s.recall.total],
      [D.recallRate, rate],
    ]);
    body.innerHTML = html;
  };
  render();
  onMetricsChanged(render);
  window.setInterval(() => {
    const f = getFps();
    fps.textContent = f ? `FPS ${Math.round(f.fps)}${f.low ? ' · ' + D.lowTier : ''}` : 'FPS –';
  }, 500);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
