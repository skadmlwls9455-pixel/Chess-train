// 판 분석과 되감기 판정. 숫자는 화면에 안 보여 주고, 판정에만 쓴다.
import { Chess } from "../vendor/chess.js";
import { scoreOf } from "./engine.js";

export const REVIEW_DEPTH = 11;
// Lichess와 같은 기준 (lila Advice.scala): 승률이 떨어진 폭으로 판정
export const INACCURACY = 10; // 10%p 이상: 부정확 (기록만)
export const MISTAKE = 20;    // 20%p 이상: 실수 (되감기가 멈춤, 오답노트행)
export const BLUNDER = 30;    // 30%p 이상: 블런더
export const ACCEPT = 6;      // 최선 대비 6%p 안쪽이면 좋은 수
export const SOLVE = INACCURACY; // 퍼즐 정답 인정: 최선 대비 10%p 미만

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// 승률(0~100), Lichess 공식. cp는 두는 쪽 기준.
export function winPct(cp) {
  if (cp > 90000) return 100;
  if (cp < -90000) return 0;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

// 국면 g에서 `me` 관점 승률과 최선수.
export async function evalPos(analyse, fen, me, depth = REVIEW_DEPTH) {
  const g = new Chess(fen);
  if (g.isCheckmate()) return { win: g.turn() === me ? 0 : 100, best: null, pv: [] };
  if (g.isDraw() || g.isStalemate()) return { win: 50, best: null, pv: [] };
  const { infos } = await analyse(fen, depth, 1);
  const s = scoreOf(infos[0]);
  const cp = g.turn() === me ? s : -s;
  return { win: winPct(cp), cp, best: infos[0]?.pv?.[0] || null, pv: infos[0]?.pv || [], mate: infos[0]?.kind === "mate" ? infos[0].val : null };
}

// 내가 둔 수 하나를 판정한다. before: 수 두기 전 evalPos, fenAfter: 둔 뒤 FEN
export async function judgeMove(analyse, before, fenAfter, me) {
  const after = await evalPos(analyse, fenAfter, me);
  const drop = Math.max(0, before.win - after.win);
  // 이미 끝난 판(크게 이기거나 지는 중)에서는 덜 깐깐하게
  const decided = (before.win >= 97 && after.win >= 90) || before.win <= 4;
  const kind = decided ? "ok" : drop >= BLUNDER ? "blunder" : drop >= MISTAKE ? "mistake" : drop >= INACCURACY ? "inaccuracy" : drop <= ACCEPT ? "good" : "ok";
  return { after, drop, kind };
}

// 실수 유형 태그
export function tagsFor({ fenBefore, played, before, after, ply, me }) {
  const tags = [];
  if (ply < 20) tags.push("오프닝");
  if (before.mate && before.mate > 0) tags.push("메이트 놓침");
  if (after.mate && after.mate < 0 && (!before.mate || before.mate > 0)) tags.push("메이트 허용");
  if (before.win >= 80) tags.push("이긴 판 놓침");
  // 기물 흘림: 상대 최선 응수가 잡기이고, 두 수 뒤 물질이 2점 이상 줄어든다
  try {
    const g = new Chess(fenBefore);
    const m0 = material(g, me);
    g.move(played);
    const pv = after.pv || [];
    for (const u of pv.slice(0, 2)) g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    if (m0 - material(g, me) >= 2) tags.push("기물 흘림");
  } catch (_) {}
  // 스테일메이트로 비김
  try {
    const g = new Chess(fenBefore); g.move(played);
    if (g.isStalemate() && before.win >= 70) tags.push("스테일메이트");
  } catch (_) {}
  if (!tags.length) tags.push("판단 실수");
  return tags;
}

function material(g, me) {
  let s = 0;
  for (const row of g.board()) for (const p of row) if (p) s += (p.color === me ? 1 : -1) * VAL[p.type];
  return s;
}

// 끝난 판 전체를 분석해서 내 실수 지점을 찾는다.
export async function analyseGame(analyse, sans, me, onProgress, isCancelled = () => false) {
  const g = new Chess();
  const points = [];
  let prev = null;
  for (let i = 0; i < sans.length; i++) {
    if (isCancelled()) return null;
    onProgress && onProgress(i / sans.length);
    const mine = g.turn() === me;
    const fenBefore = g.fen();
    if (!mine) { g.move(sans[i]); prev = null; continue; }
    const before = prev || (await evalPos(analyse, fenBefore, me));
    const m = g.move(sans[i]);
    const j = await judgeMove(analyse, before, g.fen(), me);
    prev = null;
    if (j.kind === "mistake" || j.kind === "blunder" || j.kind === "inaccuracy") {
      points.push({
        ply: i, fen: fenBefore, played: m.san, playedUci: m.from + m.to + (m.promotion || ""),
        best: before.best, kind: j.kind, drop: j.drop,
        tags: tagsFor({ fenBefore, played: m.san, before, after: j.after, ply: i, me }),
      });
    }
  }
  onProgress && onProgress(1);
  return points;
}

// 되감기·오답노트 대상: 실수와 블런더만 (부정확은 일지에 기록만)
export const isSerious = (p) => p.kind === "mistake" || p.kind === "blunder";
export const serious = (points) => (points || []).filter(isSerious);
// 다시 볼 실수 3개 (가장 크게 떨어진 순)
export const topThree = (points) => [...serious(points)].sort((a, b) => b.drop - a.drop).slice(0, 3);

// 점검 모드: 둔 뒤 상대가 공짜로(또는 이득 보고) 잡을 수 있는 내 기물이 있나
export function hangingAfter(fen, uci) {
  const g = new Chess(fen);
  const me = g.turn();
  try { g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" }); } catch (_) { return null; }
  if (g.isCheckmate()) return null;
  let worst = null;
  for (const c of g.moves({ verbose: true })) {
    if (!c.captured) continue;
    const gain = VAL[c.captured];
    const h = new Chess(g.fen());
    h.move(c);
    const recapture = h.moves({ verbose: true }).some((x) => x.to === c.to);
    const net = recapture ? gain - VAL[c.piece] : gain;
    if (h.isCheckmate()) return { square: c.to, piece: "k", mate: true };
    if (net >= 2 && (!worst || net > worst.net)) worst = { square: c.to, piece: c.captured, net };
  }
  // 1수 메이트 허용
  for (const c of g.moves({ verbose: true })) {
    const h = new Chess(g.fen()); h.move(c);
    if (h.isCheckmate()) return { square: c.to, piece: "k", mate: true };
  }
  return worst;
}

export const PIECE_KO = { p: "폰", n: "나이트", b: "비숍", r: "룩", q: "퀸", k: "킹" };
// 받침에 따라 이/가
export const iGa = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return w + (c >= 0 && c % 28 ? "이" : "가"); };
