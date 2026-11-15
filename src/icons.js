// 선 아이콘 한 세트 (24px 그리드, 선 굵기 2). currentColor 를 따라간다.
const P = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  play: '<path d="M9 3h6l-1 4h-4z"/><path d="M8 21h8"/><path d="M9 21l1-10h4l1 10"/><circle cx="12" cy="9" r="0" />',
  cards: '<rect x="4" y="6" width="13" height="15" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v13"/>',
  notes: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  log: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-8"/><path d="M22 20H2"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  restart: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>',
  skip: '<path d="M5 5l8 7-8 7z"/><path d="M17 5v14"/>',
  rewind: '<path d="M11 6L4 12l7 6z"/><path d="M20 6l-7 6 7 6z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.5"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
  infinity: '<path d="M7 9c-2 0-3.5 1.3-3.5 3s1.5 3 3.5 3c3 0 7-6 10-6 2 0 3.5 1.3 3.5 3s-1.5 3-3.5 3c-3 0-7-6-10-6z"/>',
  download: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 15V4"/><path d="M7 9l5-5 5 5"/><path d="M5 20h14"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
};
// 폰 모양은 따로 (채움)
const PAWN = '<path fill="currentColor" stroke="none" d="M12 3a3 3 0 0 0-1.9 5.3C8.8 9 8 10.3 8 12h2l-1.5 5H7v3h10v-3h-1.5L14 12h2c0-1.7-.8-3-2.1-3.7A3 3 0 0 0 12 3z"/>';

export function icon(name, size = 22) {
  const body = name === "play" ? PAWN : P[name] || "";
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
