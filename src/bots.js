// 구간별 "사람 같은" 봇.
// 엔진 후보수(MultiPV) 위에 사람 실수 모델을 얹는다:
//  - 초반은 그 구간에서 실제로 자주 나오는 수(오프닝북)
//  - 일정 확률로 "눈에 띄는" 아무 수 (잡기·체크·전개 위주) → 기물 흘림, 위협 못 봄
//  - 그 외에는 후보수 중 softmax(온도)로 고름 → 온도가 높을수록 미묘하게 나쁜 수
//  - 메이트가 보여도 일정 확률로 놓침
import { Chess } from "../vendor/chess.js";
import { scoreOf } from "./engine.js";
import { bookMove } from "./book.js";
import { sample } from "./maia.js";

// Maia-3는 리체스 점수로 학습됐어. 우리 구간은 체스닷컴 점수라서 저레이팅 차이(약 250~400점)만큼 올려서 넣는다.
export const MAIA_ELO = { 400: 700, 600: 900, 800: 1050, 1000: 1250, 1200: 1450 };

export const TIERS = [
  { id: 400,  stage: "baby",  depth: 4, mpv: 8, temp: 260, pRandom: 0.24,  pMissMate: 0.60, queenLove: 2.2 },
  { id: 600,  stage: "baby",  depth: 5, mpv: 8, temp: 200, pRandom: 0.17,  pMissMate: 0.45, queenLove: 1.7 },
  { id: 800,  stage: "baby",  depth: 5, mpv: 8, temp: 150, pRandom: 0.12,  pMissMate: 0.32, queenLove: 1.3 },
  { id: 1000, stage: "adult", depth: 6, mpv: 7, temp: 115, pRandom: 0.085, pMissMate: 0.20, queenLove: 1.1 },
  { id: 1200, stage: "adult", depth: 7, mpv: 6, temp: 85,  pRandom: 0.06,  pMissMate: 0.12, queenLove: 1.0 },
];
export const tierOf = (id) => TIERS.find((t) => t.id === id) || TIERS[0];

function pickWeighted(items, rnd) {
  const total = items.reduce((s, x) => s + x.w, 0);
  let r = rnd() * total;
  for (const x of items) { if ((r -= x.w) <= 0) return x; }
  return items[items.length - 1];
}

// "눈에 띄는" 수 가중치. 초보는 잡기·체크·퀸 움직임을 좋아하고, 무엇이 걸려 있는지는 잘 안 본다.
function naturalWeight(m, tier, ply) {
  let w = 1;
  if (m.captured) w += 2.5;
  if (m.san.includes("+")) w += 1.5;
  if (m.piece === "q") w *= tier.queenLove;
  if (m.piece === "k" && !m.flags.includes("k") && !m.flags.includes("q")) w *= 0.3;
  if (m.flags.includes("k") || m.flags.includes("q")) w += 1.5;
  const backRank = m.color === "w" ? "1" : "8";
  if ((m.piece === "n" || m.piece === "b") && m.from[1] === backRank && ply < 24) w += 1.5;
  if (m.piece === "p" && ply < 16 && "de".includes(m.from[0])) w += 1;
  return w;
}

const uciOf = (m) => m.from + m.to + (m.promotion || "");

// 봇이 둘 수 하나를 고른다. analyse(fen, depth, multipv) → {infos:[{kind,val,pv}]}
// opts: { history: SAN 배열, rnd: 난수 함수, forced: 강제할 SAN(오프닝 카드), maia: 불러온 Maia 인스턴스 }
// Maia가 있으면 그 구간 사람이 실제로 둘 법한 수를 확률대로 뽑는다. 없으면 엔진 + 실수 모델.
export async function botMove(analyse, fen, tierId, opts = {}) {
  const tier = tierOf(tierId);
  const rnd = opts.rnd || Math.random;
  const g = new Chess(fen);
  const legal = g.moves({ verbose: true });
  if (!legal.length) return null;
  const ply = opts.history ? opts.history.length : 0;

  if (opts.forced) {
    const m = legal.find((x) => x.san === opts.forced);
    if (m) return { uci: uciOf(m), san: m.san, why: "card" };
  }
  if (opts.maia) {
    try {
      const elo = MAIA_ELO[tier.id] || tier.id + 300;
      const pol = await opts.maia.policy(fen, elo, elo);
      const m = sample(pol, rnd, 1);
      if (m) return { uci: m.uci, san: m.san, why: "maia" };
    } catch (_) { /* 모델이 실패하면 아래 엔진 봇으로 */ }
  }
  if (opts.history) {
    const san = bookMove(opts.history, tier.id, rnd);
    const m = san && legal.find((x) => x.san === san);
    if (m) return { uci: uciOf(m), san: m.san, why: "book" };
  }

  const { infos } = await analyse(fen, tier.depth, Math.min(tier.mpv, legal.length));
  const cands = infos.filter((i) => i && i.pv && i.pv[0]).map((i) => ({ uci: i.pv[0], s: scoreOf(i) }));

  // 메이트가 보이면 대부분 둔다. 낮은 구간은 자주 놓친다.
  if (cands.length && cands[0].s > 90000 && rnd() > tier.pMissMate) return finish(cands[0].uci, "mate");

  if (rnd() < tier.pRandom) {
    const x = pickWeighted(legal.map((m) => ({ m, w: naturalWeight(m, tier, ply) })), rnd);
    return finish(uciOf(x.m), "human");
  }

  if (!cands.length) return finish(uciOf(legal[0]), "fallback");
  const best = Math.max(...cands.map((c) => Math.max(-3000, Math.min(3000, c.s))));
  const items = cands
    .filter((c) => !(cands[0].s > 90000 && c.s < -90000 && rnd() < 0.5)) // 메이트 놓쳐도 자살수는 절반쯤 피함
    .map((c) => ({ c, w: Math.exp((Math.max(-3000, Math.min(3000, c.s)) - best) / tier.temp) }));
  return finish(pickWeighted(items, rnd).c.uci, "engine");

  function finish(uci, why) {
    const m = legal.find((x) => uciOf(x) === uci) || legal.find((x) => x.from + x.to === uci.slice(0, 4));
    return { uci: uciOf(m), san: m.san, why };
  }
}
