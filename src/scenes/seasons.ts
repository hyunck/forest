/**
 * 계절 팔레트 (조명·나뭇잎·하늘 색)
 * 지금은 가을 초저녁이 기본입니다. 봄(벚꽃) 팔레트는 조감도의 벚나무를 참고해
 * 정의만 해 두었고, ACTIVE_SEASON만 바꾸면 전환되는 구조입니다.
 */
export interface SeasonPalette {
  id: string;
  /** 활엽수 잎 색 (무작위로 섞어 씀) */
  broadleaf: number[];
  conifer: number[];
  hinoki: number[];
  bush: number[];
  grassLawn: number;
  grassWild: number;
  forestFloor: number;
  dirt: number;
  fallenLeaves: number[];
  sky: { zenith: number; mid: number; horizon: number; glow: number };
  fog: number;
  fogDensity: number;
  sun: { color: number; intensity: number; dir: [number, number, number] };
  hemi: { sky: number; ground: number; intensity: number };
  ambient: { color: number; intensity: number };
  lamp: number;
  window: number;
  exposure: number;
}

export const AUTUMN_DUSK: SeasonPalette = {
  id: 'autumn-dusk',
  broadleaf: [0xd9672b, 0xc8452c, 0xe08a2e, 0xe3a93a, 0xb8382f, 0xcf7a34, 0xd99a3d, 0xa84a2a, 0x9b8a3a],
  conifer: [0x2f4a3a, 0x29443a, 0x35523c, 0x2b4a44],
  hinoki: [0x3d5b3c, 0x466640, 0x38553f],
  bush: [0x5b6b3a, 0x7a6a34, 0x8a5a30, 0x4f6238, 0xa0622e],
  grassLawn: 0x7f9652,
  grassWild: 0x5a6e3e,
  forestFloor: 0x54482f,
  dirt: 0x9a7b56,
  fallenLeaves: [0xd9672b, 0xe08a2e, 0xc8452c, 0xe3a93a, 0x9c5a2c],
  sky: { zenith: 0x121a3c, mid: 0x27496b, horizon: 0x3f7a82, glow: 0xf0a468 },
  fog: 0x35506a,
  fogDensity: 0.0062,
  sun: { color: 0xffb27a, intensity: 2.1, dir: [-0.72, 0.42, 0.36] },
  hemi: { sky: 0x7c9ccc, ground: 0x554832, intensity: 1.7 },
  ambient: { color: 0x44547a, intensity: 0.85 },
  lamp: 0xffb45a,
  window: 0xffba62,
  exposure: 1.12,
};

/** 봄 벚꽃 팔레트 (정의만, 아직 쓰지 않음) */
export const SPRING_BLOSSOM: SeasonPalette = {
  ...AUTUMN_DUSK,
  id: 'spring-blossom',
  broadleaf: [0xf6d5df, 0xf2c4d3, 0xfae6ec, 0xa9c98a, 0x8fbf7a, 0xf4cfe0],
  bush: [0x7fae62, 0x8fbf7a, 0x6f9d58],
  grassLawn: 0x86b060,
  grassWild: 0x74a055,
  forestFloor: 0x5d6b3c,
  fallenLeaves: [0xf6d5df, 0xfae6ec, 0xf2c4d3],
};

export const ACTIVE_SEASON: SeasonPalette = AUTUMN_DUSK;
