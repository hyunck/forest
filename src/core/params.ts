/** 링크 파라미터 (제작 지시서 4-2) */
export interface LinkParams {
  /** 숲 고르기를 건너뛰고 바로 들어갈 숲 ID */
  forest: string | null;
  /** 유입 경로: kakao / homepage / booth / reporter / sns / search / direct */
  src: string;
  /** 발송 대상군 코드. 화면에 보이지 않고 측정에만 사용 */
  c: string;
  /** demo=quiz: 재방문 질문을 첫 방문에도 띄움 */
  demoQuiz: boolean;
  /** debug=1: 측정 패널 표시 */
  debug: boolean;
  /** nowebgl=1: 3D 대체 화면을 강제로 확인 (점검용) */
  forceFallback: boolean;
}

const KNOWN_SRC = ['kakao', 'homepage', 'booth', 'reporter', 'sns', 'search'];

export function readParams(): LinkParams {
  const q = new URLSearchParams(window.location.search);
  const rawSrc = (q.get('src') || '').toLowerCase();
  const rawC = (q.get('c') || '').slice(0, 60).replace(/[^\w\-.]/g, '');
  return {
    forest: q.get('forest'),
    src: KNOWN_SRC.includes(rawSrc) ? rawSrc : 'direct',
    c: rawC,
    demoQuiz: q.get('demo') === 'quiz',
    debug: q.get('debug') === '1',
    forceFallback: q.get('nowebgl') === '1',
  };
}

export const params = readParams();
