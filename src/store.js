// 저장소: 이 기기의 localStorage 한 곳에 모아 둔다.
import { TIERS } from "./bots.js";

const KEY = "chess-train:v1";
const DAY = 86400000;
export const BOX_DAYS = [0, 1, 3, 7, 14, 30];

const fresh = () => ({
  games: [],          // {id, date, tier, me, result:'win'|'loss'|'draw', pgn, points:[...], rewound:bool}
  notes: [],          // 오답노트 퍼즐 {id, gameId, fen, played, best, accept, tags, tier, box, due, habit, solved}
  cards: {},          // 카드 id → {box, due, seen, clean}
  unlocked: [400],
  settings: { clock: "10+5", check: true, sound: true, color: "w" },
  daily: {},          // 날짜 → {game, rewind, notes, cards}
});

let S = fresh();
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || "null");
  if (raw) S = Object.assign(fresh(), raw, { settings: Object.assign(fresh().settings, raw.settings || {}) });
} catch (_) {}

export const state = () => S;
let onSave = null;
export function setOnSave(fn) { onSave = fn; }
// quiet: 동기화로 받아온 기록을 쓸 때는 다시 올리지 않는다
export function save(quiet) {
  if (!quiet) S.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {}
  if (!quiet && onSave) onSave();
}
// 다른 기기 기록으로 통째로 바꾸기
export function replace(data) {
  S = Object.assign(fresh(), data, { settings: Object.assign(fresh().settings, data.settings || {}) });
  save(true);
}
export const now = () => Date.now();
export const today = () => new Date().toLocaleDateString("sv-SE");
export function daily() { const d = today(); return (S.daily[d] ||= { game: 0, rewind: 0, notes: 0, cards: 0 }); }
export function bump(k) { daily()[k]++; save(); }

/* ---- 구간 진행: 최근 5판 중 3승이면 다음 구간 열림 ---- */
export function lastResults(tier, n = 5) { return S.games.filter((g) => g.tier === tier && !g.drill).slice(-n).map((g) => g.result); }
export function recordGame(g) {
  S.games.push(g);
  if (S.games.length > 300) S.games = S.games.slice(-300);
  let unlockedNew = null;
  const wins = lastResults(g.tier).filter((r) => r === "win").length;
  const idx = TIERS.findIndex((t) => t.id === g.tier);
  const next = TIERS[idx + 1];
  if (wins >= 3 && next && !S.unlocked.includes(next.id)) { S.unlocked.push(next.id); unlockedNew = next.id; }
  save();
  return unlockedNew;
}
export function streakLosses() {
  let n = 0;
  for (let i = S.games.length - 1; i >= 0 && S.games[i].result === "loss"; i--) n++;
  return n;
}

/* ---- 간격 반복 (오답노트·카드 공통) ---- */
export function schedule(item, clean) {
  item.box = clean ? Math.min((item.box || 0) + 1, BOX_DAYS.length - 1) : 0;
  item.due = now() + (clean ? BOX_DAYS[item.box] * DAY : DAY / 2);
}
export const isDue = (item) => !item.due || item.due <= now();
export function cardState(id) { return (S.cards[id] ||= { box: 0, due: 0, seen: 0, clean: 0 }); }

export function addNotes(list) {
  for (const n of list) if (!S.notes.some((x) => x.fen === n.fen && x.played === n.played)) S.notes.push(n);
  if (S.notes.length > 400) S.notes = S.notes.slice(-400);
  save();
}
