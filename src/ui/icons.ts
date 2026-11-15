/** 선 아이콘 (굵기 2px). 모두 직접 그린 SVG입니다. */
const wrap = (inner: string, size = 24, vb = '0 0 24 24'): string =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;

/** 확산의 숲 심볼: 나뭇잎 하나에서 작은 점들이 바람처럼 흩어지는 형태 */
export function symbolSvg(size = 72): string {
  return `<svg class="symbol" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="M9 48C9 30 21 18 39 18 39 36 27 48 9 48Z"/>
    <path d="M9 48C17 40 25 32 32 25"/>
    <path d="M19 38h7M25 32h6" opacity=".55"/>
    <g fill="currentColor" stroke="none">
      <circle class="dot d1" cx="45" cy="27" r="2.3"/>
      <circle class="dot d2" cx="51" cy="18" r="1.9"/>
      <circle class="dot d3" cx="50" cy="35" r="1.6"/>
      <circle class="dot d4" cx="57" cy="27" r="1.3"/>
      <circle class="dot d5" cx="45" cy="11" r="1.3"/>
      <circle class="dot d6" cx="58" cy="12" r="1"/>
    </g>
  </svg>`;
}

export const ICON = {
  sit: wrap('<path d="M4 11V7M20 11V7M3 11h18M5 11v8M19 11v8M5 15h14"/>'),
  stand: wrap('<circle cx="12" cy="5" r="2"/><path d="M12 7v7M12 14l-3 6M12 14l3 6M8 10h8"/>'),
  breathe: wrap('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>'),
  confide: wrap('<path d="M20 4C11 4 5 9 5 16c0 1.4.3 2.7.8 3.9"/><path d="M20 4c0 9-5 15-12 15-1 0-1.9-.1-2.7-.4"/><path d="M4 21c3-6 7-10 12-13"/>'),
  places: wrap('<path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.500 15.4 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.3"/>'),
  soundOn: wrap('<path d="M4 9.5v5h3.5L12 18.5v-13L7.500 9.5H4Z"/><path d="M15.500 9a4.200 4.200 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11"/>'),
  soundOff: wrap('<path d="M4 9.5v5h3.5L12 18.5v-13L7.500 9.5H4Z"/><path d="M16 9.500l5 5M21 9.500l-5 5"/>'),
  exit: wrap('<path d="M10 4H6a1.500 1.500 0 0 0-1.500 1.500v13A1.500 1.500 0 0 0 6 20h4"/><path d="M15 8l4 4-4 4M19 12H9.500"/>'),
  close: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  sprout: wrap('<path d="M12 21v-9"/><path d="M12 13c0-3.500-2.500-6-6.500-6 0 3.800 2.500 6 6.500 6Z"/><path d="M12 11c0-3 2.200-5.500 6-5.500 0 3.500-2.200 5.500-6 5.500Z"/>'),
  bench: wrap('<path d="M4 11V7M20 11V7M3 11h18M5 11v8M19 11v8M5 15h14"/>'),
  phone: wrap('<path d="M6.500 3.500h3l1.500 4-2 1.500a11 11 0 0 0 6 6l1.500-2 4 1.500v3a2 2 0 0 1-2.200 2A16.500 16.500 0 0 1 4.500 5.700a2 2 0 0 1 2-2.200Z"/>'),
  leaf: wrap('<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14Z"/><path d="M5 19c3.500-3.500 7-7 10-10"/>'),
  tree: wrap('<path d="M12 21v-6"/><path d="M12 3l5 7h-3l4 5H6l4-5H7l5-7Z"/>'),
  again: wrap('<path d="M4 12a8 8 0 1 0 2.600-5.900"/><path d="M4 4.500V9h4.500"/>'),
  arrow: wrap('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  skip: wrap('<path d="M5 6l7 6-7 6M13 6l7 6-7 6"/>'),
  gate: wrap('<path d="M5 21V6M19 21V6M3 6h18M5 10h14"/>'),
  lawn: wrap('<path d="M3 20h18M6 20c0-3 0-5-1.500-7M9 20c0-4 .5-6 2-9M13 20c0-3-.5-5 1-8M17 20c0-3 .5-4 2-6"/>'),
  deck: wrap('<path d="M3 13h18M5 13v7M19 13v7M3 9h18M7 9v4M12 9v4M17 9v4"/>'),
  valley: wrap('<path d="M3 8c3 0 3 2 6 2s3-2 6-2 3 2 6 2M3 13c3 0 3 2 6 2s3-2 6-2 3 2 6 2M3 18c3 0 3 2 6 2s3-2 6-2 3 2 6 2"/>'),
};
