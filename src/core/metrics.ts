/**
 * 측정 이벤트 (제작 지시서 8장) · 데모용 로컬 기록
 * 외부로 아무것도 보내지 않고 localStorage의 hwaksan_metrics에만 쌓습니다.
 * 실서비스에서는 이 파일의 track()만 분석 도구 호출로 바꾸면 됩니다.
 * 주의: 털어놓기 내용은 어떤 경우에도 여기로 넘기지 않습니다(횟수만).
 */
import { params } from './params';

const KEY = 'hwaksan_metrics';
const KEY_LAST = 'hwaksan_lastVisit';
const MAX_EVENTS = 3000;

export type EventName =
  | 'visit'
  | 'forest_enter'
  | 'loading_line_shown'
  | 'place_visit'
  | 'sit'
  | 'breathe_done'
  | 'confide_done'
  | 'researcher_click'
  | 'sign_read'
  | 'exit_shown'
  | 'survey_answer'
  | 'recall_answer'
  | 'booking_click';

export interface MetricEvent {
  e: EventName;
  t: number;
  src: string;
  c: string;
  d?: Record<string, string | number | boolean>;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 사생활 보호 모드 등에서는 기록 없이 진행 */
  }
}

export function readEvents(): MetricEvent[] {
  const raw = safeGet(KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as MetricEvent[]) : [];
  } catch {
    return [];
  }
}

const listeners: Array<() => void> = [];
export function onMetricsChanged(fn: () => void): void {
  listeners.push(fn);
}

export function track(e: EventName, d?: Record<string, string | number | boolean>): void {
  const events = readEvents();
  const ev: MetricEvent = { e, t: Date.now(), src: params.src, c: params.c };
  if (d) ev.d = d;
  events.push(ev);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  safeSet(KEY, JSON.stringify(events));
  listeners.forEach((fn) => fn());
}

export function clearMetrics(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
  listeners.forEach((fn) => fn());
}

/** 이전 방문 시각(ms). 이번 방문을 기록하기 전에 읽어 둡니다. */
const previousVisit: number | null = (() => {
  const raw = safeGet(KEY_LAST);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
})();

/** 재방문자 판정: 이전 방문 기록이 있고 1일 이상 지났을 때 */
export function isReturningVisitor(): boolean {
  if (previousVisit === null) return false;
  return Date.now() - previousVisit >= 24 * 60 * 60 * 1000;
}

export function markVisit(): void {
  safeSet(KEY_LAST, String(Date.now()));
}

/** 간단한 설정 저장 (소리 켜짐 여부 등) */
export function getPref(key: string): string | null {
  return safeGet('hwaksan_' + key);
}
export function setPref(key: string, value: string): void {
  safeSet('hwaksan_' + key, value);
}

/** 디버그 패널용 집계 */
export interface Summary {
  visitsBySrc: Record<string, number>;
  visitsByCohort: Record<string, number>;
  enters: number;
  survey: Record<string, Record<string, number>>;
  recall: { total: number; correct: number };
  counts: Record<string, number>;
}

export function summarize(): Summary {
  const s: Summary = {
    visitsBySrc: {},
    visitsByCohort: {},
    enters: 0,
    survey: {},
    recall: { total: 0, correct: 0 },
    counts: {},
  };
  for (const ev of readEvents()) {
    s.counts[ev.e] = (s.counts[ev.e] || 0) + 1;
    if (ev.e === 'visit') {
      s.visitsBySrc[ev.src] = (s.visitsBySrc[ev.src] || 0) + 1;
      const c = ev.c || '(없음)';
      s.visitsByCohort[c] = (s.visitsByCohort[c] || 0) + 1;
    } else if (ev.e === 'forest_enter') {
      s.enters++;
    } else if (ev.e === 'survey_answer' && ev.d) {
      const q = 'Q' + String(ev.d.q);
      const a = ev.d.skipped ? '(건너뜀)' : String(ev.d.answer);
      s.survey[q] = s.survey[q] || {};
      s.survey[q][a] = (s.survey[q][a] || 0) + 1;
    } else if (ev.e === 'recall_answer' && ev.d) {
      s.recall.total++;
      if (ev.d.correct) s.recall.correct++;
    }
  }
  return s;
}
