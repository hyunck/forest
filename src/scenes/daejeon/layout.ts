/**
 * 국립대전숲체원 장면 배치 데이터
 * ------------------------------------------------------------
 * 좌표 단위는 미터. x는 동쪽(+), z는 남쪽(+), 북쪽은 -z 입니다.
 * 공식 안내도와 조감도를 보고 배치를 단순화해 옮겼습니다.
 *   입구(남서쪽 아래) → 건물군(중앙) → 나래마을(동쪽 경사지) → 숲(북쪽 위)
 * 숫자만 바꾸면 장면이 그대로 바뀝니다. (건물 내부는 만들지 않습니다)
 */

export type Level = 0 | 1; // 0 = 땅, 1 = 데크로드·관망데크

export interface NavNode {
  id: string;
  x: number;
  z: number;
  level: Level;
  /** 데크(레벨 1) 위 높이. 땅 위 노드는 지형 높이를 씁니다. */
  y?: number;
}
export interface NavEdge {
  a: string;
  b: string;
  /** 길의 반폭(m). 이 폭 안은 자유롭게 걸을 수 있습니다. */
  w: number;
  kind?: 'elevator';
  /** 바닥 종류: 걷는 소리와 길 모양에 사용 */
  surface?: 'dirt' | 'grass' | 'deck';
  /** 길 리본을 그리지 않음(잔디광장 내부 등) */
  hidden?: boolean;
}

export const WORLD = {
  minX: -135,
  maxX: 145,
  minZ: -140,
  maxZ: 125,
  cell: 2,
};

/** 처음 입장 위치: 현판이 정면에 보이는 입구 앞 */
export const SPAWN = { x: -4, z: 53.5, lookX: -4, lookZ: 30 };

/** 안내도 왼쪽을 따라 흐르는 개울 (북 → 남) */
export const STREAM: Array<[number, number]> = [
  [-26, -128],
  [-30, -104],
  [-36, -80],
  [-41, -63],
  [-43.5, -50],
  [-44.5, -38],
  [-44, -24],
  [-45, -8],
  [-47, 10],
  [-50, 30],
  [-52, 55],
  [-56, 90],
  [-60, 122],
];
export const STREAM_HALF_WIDTH = 1.7;

/** 걸을 수 있는 길 (웨이포인트) */
export const NAV_NODES: NavNode[] = [
  // 입구 → 잔디광장
  { id: 'g0', x: -4, z: 57, level: 0 },
  { id: 'g1', x: -4, z: 44, level: 0 },
  { id: 'g2', x: -3, z: 31, level: 0 },
  { id: 'i1', x: -12.5, z: 27.5, level: 0 }, // 안내센터 앞
  { id: 'ps', x: 0, z: 17, level: 0 },
  { id: 'pc', x: 2, z: 3, level: 0 },
  { id: 'pn', x: 3, z: -9, level: 0 },
  { id: 'pw', x: -8, z: 1, level: 0 },
  { id: 'pe', x: 12, z: 6, level: 0 },
  // 엘리베이터 타워
  { id: 'e1', x: 17.5, z: 11, level: 0 },
  { id: 'el0', x: 23, z: 11, level: 0 },
  // 골짜기숲길
  { id: 'v0', x: -7, z: -8, level: 0 },
  { id: 'v1', x: -16, z: -15.5, level: 0 },
  { id: 'v2', x: -27, z: -24, level: 0 },
  { id: 'v3', x: -35.5, z: -36, level: 0 },
  { id: 'v3b', x: -39.2, z: -39, level: 0 },
  { id: 'v4', x: -38, z: -50, level: 0 },
  { id: 'v5', x: -34, z: -63, level: 0 },
  // 데크로드 (엘리베이터 위 → 지그재그 → 관망데크)
  { id: 'el1', x: 23, z: 11, level: 1, y: 6.6 },
  { id: 'd0', x: 28.5, z: 11, level: 1, y: 6.6 },
  { id: 'd1', x: 35, z: 15.5, level: 1, y: 7.2 },
  { id: 'd2', x: 42, z: 9, level: 1, y: 8.1 },
  { id: 'd3', x: 49, z: 15, level: 1, y: 9.3 },
  { id: 'd3b', x: 49.02, z: 15.02, level: 1, y: 9.3 }, // 데크로드 중간 쉼터(둥근 참)
  { id: 'd4', x: 56, z: 8, level: 1, y: 11.0 },
  { id: 'dj', x: 60, z: 3.2, level: 1, y: 12.4 },
  { id: 'dkS', x: 61, z: -1.5, level: 1, y: 12.4 },
  { id: 'dkN', x: 61, z: -7.5, level: 1, y: 12.4 },
];

export const NAV_EDGES: NavEdge[] = [
  { a: 'g0', b: 'g1', w: 2.3, surface: 'dirt' },
  { a: 'g1', b: 'g2', w: 2.3, surface: 'dirt' },
  { a: 'g2', b: 'ps', w: 2.3, surface: 'dirt' },
  { a: 'g2', b: 'i1', w: 1.7, surface: 'dirt' },
  { a: 'ps', b: 'pc', w: 8, surface: 'grass', hidden: true },
  { a: 'pc', b: 'pn', w: 8, surface: 'grass', hidden: true },
  { a: 'pc', b: 'pw', w: 8, surface: 'grass', hidden: true },
  { a: 'pc', b: 'pe', w: 8, surface: 'grass', hidden: true },
  { a: 'pe', b: 'e1', w: 2.0, surface: 'dirt' },
  { a: 'e1', b: 'el0', w: 1.2, surface: 'dirt' },
  { a: 'el0', b: 'el1', w: 1.0, kind: 'elevator' },
  { a: 'pc', b: 'v0', w: 6, surface: 'grass', hidden: true },
  { a: 'v0', b: 'v1', w: 1.8, surface: 'dirt' },
  { a: 'v1', b: 'v2', w: 1.8, surface: 'dirt' },
  { a: 'v2', b: 'v3', w: 1.8, surface: 'dirt' },
  { a: 'v3', b: 'v3b', w: 2.6, surface: 'dirt' },
  { a: 'v3', b: 'v4', w: 1.8, surface: 'dirt' },
  { a: 'v4', b: 'v5', w: 1.8, surface: 'dirt' },
  { a: 'el1', b: 'd0', w: 1.25, surface: 'deck' },
  { a: 'd0', b: 'd1', w: 1.25, surface: 'deck' },
  { a: 'd1', b: 'd2', w: 1.25, surface: 'deck' },
  { a: 'd2', b: 'd3', w: 1.25, surface: 'deck' },
  { a: 'd3', b: 'd4', w: 1.25, surface: 'deck' },
  { a: 'd3', b: 'd3b', w: 2.0, surface: 'deck', hidden: true },
  { a: 'd4', b: 'dj', w: 1.25, surface: 'deck' },
  { a: 'dj', b: 'dkS', w: 1.6, surface: 'deck', hidden: true },
  { a: 'dkS', b: 'dkN', w: 5.0, surface: 'deck', hidden: true },
];

/** 핵심 장소 4곳 (장소 바로가기) */
export interface Place {
  id: 'gate' | 'plaza' | 'deck' | 'valley';
  node: string;
  /** 도착 판정 반경 */
  radius: number;
}
export const PLACES: Place[] = [
  { id: 'gate', node: 'g1', radius: 13 },
  { id: 'plaza', node: 'pc', radius: 15 },
  { id: 'deck', node: 'dkS', radius: 8 },
  { id: 'valley', node: 'v3', radius: 12 },
];

/** 관망데크 바닥 (사각형) */
export const DECK_PLATFORM = { minX: 54.5, maxX: 67.5, minZ: -13, maxZ: 4, y: 12.4 };

/** 엘리베이터 타워 */
export const ELEVATOR = { x: 23, z: 11, size: 3.4, topY: 6.6, height: 10.4 };

/** 입구 구조물과 숲 현판 */
export const GATE = { x: -4, z: 44, span: 6.4, height: 4.5 };

/** 잔디광장 */
export const PLAZA = { x: 2, z: 3, radius: 15.5 };

/** 건물 (박공지붕 목조 건물군). ridge: 용마루 방향 */
export interface BuildingDef {
  id: string;
  x: number;
  z: number;
  w: number; // x 방향 길이
  d: number; // z 방향 길이
  wallH: number;
  roofH: number;
  ridge: 'x' | 'z';
  floors: number;
  /** 유리가 큰 박공면 방향 */
  glassGable?: 'n' | 's' | 'e' | 'w';
  /** 지형을 평평하게 고를 높이(없으면 그 자리 지형 높이) */
  padY?: number;
}
export const BUILDINGS: BuildingDef[] = [
  // ① 안내센터: 입구에서 정면 왼쪽으로 보이는 큰 박공 건물
  { id: 'info', x: -21, z: 25, w: 13, d: 20, wallH: 7.4, roofH: 5.2, ridge: 'z', floors: 2, glassGable: 's' },
  // ② 강당: 안내센터 뒤의 더 큰 건물
  { id: 'hall', x: -28.5, z: 1, w: 16, d: 20, wallH: 8.6, roofH: 6.4, ridge: 'z', floors: 2, glassGable: 's' },
  // ③ 체험관(식당·세미나실): 잔디광장 북쪽
  { id: 'exp', x: -1, z: -27, w: 21, d: 11, wallH: 5.8, roofH: 4.2, ridge: 'x', floors: 2 },
  { id: 'expWing', x: 13.5, z: -29, w: 8.5, d: 10, wallH: 5.0, roofH: 3.8, ridge: 'z', floors: 1, glassGable: 's' },
  // ④ 새솔관(단체 숙박동): 언덕 위 가로로 긴 3층 건물
  { id: 'saesol', x: 23, z: -55, w: 38, d: 10.5, wallH: 10.2, roofH: 3.8, ridge: 'x', floors: 3, padY: 5.6 },
];

/** ⑤ 나래마을: 동쪽 계단식 잔디 경사지의 개별 오두막 */
export interface CabinDef {
  x: number;
  z: number;
  rot: number; // 라디안
  s: number; // 크기 배율
}
export const CABINS: CabinDef[] = [
  { x: 31, z: -5.5, rot: 0.25, s: 1.0 },
  { x: 39.5, z: -1.5, rot: -0.15, s: 0.95 },
  { x: 36, z: -15, rot: 0.1, s: 1.05 },
  { x: 45, z: -10, rot: 0.35, s: 1.0 },
  { x: 33, z: -25.5, rot: -0.2, s: 0.95 },
  { x: 43, z: -22, rot: 0.2, s: 1.05 },
  { x: 49.5, z: -19, rot: -0.1, s: 0.9 },
  { x: 40.5, z: -33, rot: 0.3, s: 1.0 },
];

/** 앉을 자리 */
export interface SeatDef {
  id: string;
  place: 'gate' | 'plaza' | 'deck' | 'valley' | 'deckroad';
  type: 'bench' | 'platform' | 'rock' | 'log';
  x: number;
  z: number;
  level: Level;
  /** 앉았을 때 바라보는 지점 */
  look: [number, number];
  /** 가구는 따로 만들고 자리만 추가할 때(평상의 두 번째 자리 등) */
  noProp?: boolean;
}
export const SEATS: SeatDef[] = [
  // 숲 입구: 현판과 안내센터, 빈계산이 보이는 자리
  { id: 'gate-1', place: 'gate', type: 'bench', x: -9.2, z: 51.0, level: 0, look: [-6, 20] },
  { id: 'gate-2', place: 'gate', type: 'bench', x: 1.6, z: 50.2, level: 0, look: [-9, 20] },
  { id: 'gate-3', place: 'gate', type: 'log', x: 0.6, z: 37.2, level: 0, look: [-14, 10] },
  // 잔디광장: 체험관과 언덕 위 새솔관의 불 켜진 창이 보이는 자리
  { id: 'plaza-1', place: 'plaza', type: 'bench', x: -6.5, z: 15.2, level: 0, look: [6, -45] },
  { id: 'plaza-2', place: 'plaza', type: 'bench', x: 6.2, z: 17.0, level: 0, look: [8, -45] },
  { id: 'plaza-3', place: 'plaza', type: 'platform', x: 14.0, z: -5.2, level: 0, look: [-22, 6] },
  { id: 'plaza-3b', place: 'plaza', type: 'platform', x: 14.6, z: -3.6, level: 0, look: [-22, 6], noProp: true },
  { id: 'plaza-4', place: 'plaza', type: 'bench', x: -12.4, z: 8.6, level: 0, look: [22, -40] },
  { id: 'plaza-5', place: 'plaza', type: 'platform', x: -9.6, z: -3.4, level: 0, look: [24, -6] },
  { id: 'plaza-6', place: 'plaza', type: 'bench', x: 15.8, z: 13.6, level: 0, look: [-10, -30] },
  // 관망데크: 아래로 나래마을과 단지 전경, 멀리 능선
  { id: 'deck-1', place: 'deck', type: 'bench', x: 56.0, z: -10.2, level: 1, look: [20, -18] },
  { id: 'deck-2', place: 'deck', type: 'bench', x: 56.0, z: -6.4, level: 1, look: [20, -12] },
  { id: 'deck-3', place: 'deck', type: 'bench', x: 56.0, z: -2.6, level: 1, look: [20, -8] },
  { id: 'deck-4', place: 'deck', type: 'bench', x: 56.0, z: 1.2, level: 1, look: [20, -4] },
  { id: 'deck-5', place: 'deck', type: 'bench', x: 60.0, z: -11.4, level: 1, look: [30, -60] },
  { id: 'deck-6', place: 'deck', type: 'bench', x: 64.2, z: -11.4, level: 1, look: [34, -60] },
  // 데크로드 중간 쉼터
  { id: 'road-1', place: 'deckroad', type: 'bench', x: 49.2, z: 17.25, level: 1, look: [30, -14] },
  // 골짜기숲길: 개울가 넓은 바위와 통나무 벤치
  { id: 'valley-1', place: 'valley', type: 'rock', x: -40.6, z: -36.6, level: 0, look: [-47, -46] },
  { id: 'valley-2', place: 'valley', type: 'rock', x: -41.0, z: -41.2, level: 0, look: [-46, -30] },
  { id: 'valley-3', place: 'valley', type: 'log', x: -33.4, z: -33.6, level: 0, look: [-45, -41] },
  { id: 'valley-4', place: 'valley', type: 'log', x: -40.4, z: -51.5, level: 0, look: [-45, -60] },
  { id: 'valley-5', place: 'valley', type: 'rock', x: -36.8, z: -61.6, level: 0, look: [-42, -70] },
];

/** 숲지기 연구원 (잔디광장·데크로드·골짜기숲길에 한 명씩. 입구에는 두지 않음) */
export interface ResearcherDef {
  id: 'plaza' | 'deckroad' | 'valley';
  x: number;
  z: number;
  level: Level;
  look: [number, number];
  /** 평소 동작 */
  behavior: 'lookup' | 'write' | 'crouch';
}
export const RESEARCHERS: ResearcherDef[] = [
  { id: 'plaza', x: 10.6, z: -5.6, level: 0, look: [13.4, -9.4], behavior: 'lookup' },
  { id: 'deckroad', x: 51.05, z: 15.9, level: 1, look: [58, 20], behavior: 'write' },
  { id: 'valley', x: -40.2, z: -45.6, level: 0, look: [-44, -47], behavior: 'crouch' },
];

/** 나무 표찰 (골짜기숲길 3개, 잔디광장·관망데크·입구 1개씩) */
export interface SignDef {
  id: 'hinoki' | 'pine' | 'valley' | 'maple' | 'deck' | 'gate';
  x: number;
  z: number;
  level: Level;
  /** 표찰이 바라보는 지점(길 쪽) */
  look: [number, number];
  /** 표찰 옆에 세울 나무 */
  tree?: { kind: 'hinoki' | 'pine' | 'maple'; x: number; z: number };
}
export const SIGNS: SignDef[] = [
  { id: 'hinoki', x: -29.6, z: -29.4, level: 0, look: [-31, -27.5], tree: { kind: 'hinoki', x: -28.2, z: -31.2 } },
  { id: 'valley', x: -37.6, z: -42.4, level: 0, look: [-36, -41], },
  { id: 'pine', x: -34.6, z: -56.4, level: 0, look: [-36.6, -56], tree: { kind: 'pine', x: -32.4, z: -57.6 } },
  { id: 'maple', x: 11.2, z: 15.6, level: 0, look: [6, 9], tree: { kind: 'maple', x: 13.2, z: 17.6 } },
  { id: 'deck', x: 63.6, z: 2.6, level: 1, look: [61, -2] },
  { id: 'gate', x: -0.6, z: 46.8, level: 0, look: [-3, 50] },
];

/** 광장 가장자리와 주요 지점에 직접 심는 단풍나무 */
export const FEATURE_TREES: Array<{ kind: 'maple' | 'pine' | 'hinoki'; x: number; z: number; s: number }> = [
  { kind: 'maple', x: 13.6, z: -9.6, s: 1.25 },
  { kind: 'maple', x: -11.5, z: 15.5, s: 1.15 },
  { kind: 'maple', x: 18.5, z: 2.0, s: 1.1 },
  { kind: 'maple', x: -13.8, z: -7.6, s: 1.2 },
  { kind: 'maple', x: 9.5, z: 20.5, s: 1.05 },
  { kind: 'maple', x: -2.5, z: -17.5, s: 1.0 },
  { kind: 'maple', x: 8.6, z: -16.8, s: 1.1 },
  { kind: 'maple', x: -9.6, z: 40.5, s: 1.15 },
  { kind: 'maple', x: 2.4, z: 41.5, s: 1.05 },
  { kind: 'maple', x: -10.4, z: 55.5, s: 1.2 },
  { kind: 'maple', x: 3.4, z: 55.0, s: 1.1 },
  { kind: 'maple', x: 27.0, z: 5.4, s: 1.0 },
  { kind: 'pine', x: -44.5, z: -30.5, s: 1.2 },
  { kind: 'hinoki', x: -30.6, z: -41.5, s: 1.2 },
  { kind: 'maple', x: -42.6, z: -55.5, s: 1.0 },
];

/** 정원등. tall: 키 큰 정원등 / low: 낮은 길 등 */
export interface LampDef {
  x: number;
  z: number;
  kind: 'tall' | 'low';
  level?: Level;
  y?: number;
}
export const LAMPS: LampDef[] = [
  // 입구
  { x: -7.6, z: 44.4, kind: 'tall' },
  { x: -0.4, z: 44.4, kind: 'tall' },
  { x: -7.0, z: 53.5, kind: 'low' },
  { x: -1.0, z: 57.0, kind: 'low' },
  { x: -6.4, z: 38.0, kind: 'low' },
  { x: -0.2, z: 33.5, kind: 'low' },
  { x: -5.6, z: 27.0, kind: 'low' },
  { x: 1.2, z: 23.5, kind: 'low' },
  { x: -10.5, z: 30.0, kind: 'low' },
  // 잔디광장 가장자리
  { x: -9.0, z: 13.4, kind: 'tall' },
  { x: 9.0, z: 16.4, kind: 'tall' },
  { x: 16.4, z: 9.0, kind: 'tall' },
  { x: 15.6, z: -7.6, kind: 'tall' },
  { x: -1.5, z: -11.6, kind: 'tall' },
  { x: -12.6, z: -1.0, kind: 'tall' },
  // 엘리베이터 쪽
  { x: 15.5, z: 13.2, kind: 'low' },
  { x: 20.0, z: 8.8, kind: 'low' },
  // 골짜기숲길
  { x: -11.0, z: -13.4, kind: 'low' },
  { x: -20.5, z: -17.4, kind: 'low' },
  { x: -25.8, z: -26.0, kind: 'low' },
  { x: -33.0, z: -31.0, kind: 'low' },
  { x: -37.6, z: -35.2, kind: 'tall' },
  { x: -35.4, z: -43.5, kind: 'low' },
  { x: -39.8, z: -48.6, kind: 'low' },
  { x: -34.6, z: -57.0, kind: 'low' },
  { x: -35.8, z: -64.4, kind: 'low' },
  // 건물 앞
  { x: -13.0, z: 22.0, kind: 'low' },
  { x: -18.0, z: 37.0, kind: 'low' },
  { x: 4.0, z: -19.6, kind: 'low' },
  { x: -7.0, z: -19.6, kind: 'low' },
  // 나래마을
  { x: 34.5, z: -9.5, kind: 'low' },
  { x: 41.5, z: -6.5, kind: 'low' },
  { x: 40.0, z: -18.5, kind: 'low' },
  { x: 46.5, z: -15.0, kind: 'low' },
  { x: 37.0, z: -28.5, kind: 'low' },
  // 관망데크 (데크 위)
  { x: 55.2, z: -12.3, kind: 'low', level: 1, y: 12.4 },
  { x: 55.2, z: 3.3, kind: 'low', level: 1, y: 12.4 },
  { x: 66.8, z: -12.3, kind: 'low', level: 1, y: 12.4 },
  { x: 66.8, z: 3.3, kind: 'low', level: 1, y: 12.4 },
];

/** 실제로 빛을 내는 포인트 라이트(성능을 위해 6개). 나머지 등은 발광 재질만 사용 */
export const POINT_LIGHTS: Array<{ x: number; y: number; z: number; intensity: number; distance: number }> = [
  { x: -4, y: 3.4, z: 45.5, intensity: 26, distance: 20 },
  { x: -7, y: 3.0, z: 12, intensity: 22, distance: 20 },
  { x: 13, y: 3.0, z: -5, intensity: 22, distance: 20 },
  { x: 21.5, y: 3.0, z: 11, intensity: 16, distance: 15 },
  { x: 60.5, y: 14.2, z: -4.5, intensity: 26, distance: 20 },
  { x: -38, y: 2.8, z: -37, intensity: 22, distance: 20 },
];

/** 소품: 장작더미, 화단, 바위 등 */
export const WOODPILES: Array<{ x: number; z: number; rot: number }> = [
  { x: 28.0, z: -8.5, rot: 0.3 },
  { x: 42.5, z: -13.5, rot: 1.2 },
  { x: -15.4, z: 12.8, rot: 1.57 },
  { x: -31.0, z: -36.5, rot: 0.6 },
  { x: 9.5, z: -20.6, rot: 0 },
];

/** 나무를 심지 않거나 드물게 심는 곳 (원형). density 0 = 전혀 없음 */
export const CLEARINGS: Array<{ x: number; z: number; r: number; density: number }> = [
  { x: PLAZA.x, z: PLAZA.z, r: PLAZA.radius + 0.5, density: 0 },
  { x: -4, z: 49, r: 9, density: 0 },
  { x: 40, z: -14, r: 21, density: 0.1 }, // 나래마을 잔디 경사지
  { x: 61, z: -4.5, r: 10.5, density: 0 }, // 관망데크
  { x: 47, z: -8, r: 10, density: 0.04 }, // 관망데크에서 내려다보는 시야
  { x: -37.5, z: -38, r: 5.5, density: 0 },
  { x: 23, z: -45, r: 12, density: 0.12 }, // 새솔관 앞
  { x: 8, z: -40, r: 10, density: 0.25 },
];

/**
 * 시연용 방문자 (실제 접속자가 아닙니다)
 * seat: 그 자리에 앉아 있음 / route: 노드 사이를 천천히 오감
 */
export interface VisitorDef {
  color: 'moss' | 'beige' | 'navy' | 'chestnut';
  seat?: string;
  route?: string[];
}
export const VISITORS: VisitorDef[] = [
  { color: 'beige', seat: 'gate-2' },
  { color: 'navy', seat: 'plaza-2' },
  { color: 'chestnut', seat: 'plaza-3' },
  { color: 'moss', seat: 'deck-2' },
  { color: 'beige', seat: 'deck-5' },
  { color: 'navy', seat: 'valley-2' },
  { color: 'chestnut', route: ['g2', 'ps', 'pc', 'pe', 'pc', 'ps'] },
  { color: 'moss', route: ['v1', 'v2', 'v3', 'v4', 'v5', 'v4', 'v3', 'v2'] },
  { color: 'beige', route: ['d1', 'd2', 'd3', 'd4', 'd3', 'd2'] },
];
