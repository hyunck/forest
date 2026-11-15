/** 아바타 옷 색 4가지: 이끼색 · 베이지 · 남색 · 밤색 (꾸미기·아이템은 없음) */
export type OutfitId = 'moss' | 'beige' | 'navy' | 'chestnut';

export const OUTFITS: Record<OutfitId, { coat: number; cap: number; scarf: number; css: string }> = {
  moss: { coat: 0x6c7d4c, cap: 0x47552f, scarf: 0xe6dabb, css: '#6c7d4c' },
  beige: { coat: 0xcbb690, cap: 0x8a7350, scarf: 0x8f5f3c, css: '#cbb690' },
  navy: { coat: 0x3a4a68, cap: 0x26324a, scarf: 0xd9c9a0, css: '#3a4a68' },
  chestnut: { coat: 0x7d4d36, cap: 0x52301f, scarf: 0xe2d2ad, css: '#7d4d36' },
};
export const OUTFIT_IDS: OutfitId[] = ['moss', 'beige', 'navy', 'chestnut'];
