// 오프닝 카드 검증: 수순이 합법인지, 내 수가 엔진 최선 대비 크게 손해 보지 않는지.
// node tools/check-cards.mjs
import { Chess } from "../vendor/chess.js";
import { CARDS, cardMoves, whyFor } from "../src/cards.js";
import { scoreOf } from "../src/engine.js";
import { NodeEngine } from "./uci.mjs";

const DEPTH = 16, LOSS = 70;
const eng = new NodeEngine();
let bad = 0;
for (const c of CARDS) {
  const g = new Chess();
  const ms = cardMoves(c);
  const notes = [];
  for (let i = 0; i < ms.length; i++) {
    const mine = g.turn() === c.me;
    let best = null;
    if (mine) best = scoreOf((await eng.analyse(g.fen(), DEPTH, 1)).infos[0]);
    let mv;
    try { mv = g.move(ms[i]); } catch (e) { notes.push(`ILLEGAL ${i}:${ms[i]}`); bad++; break; }
    if (mine) {
      if (!whyFor(c, i)) notes.push(`no why @${i}`);
      let after;
      if (g.isCheckmate()) after = 100000; else after = -scoreOf((await eng.analyse(g.fen(), DEPTH, 1)).infos[0]);
      const loss = Math.min(best, 2000) - Math.min(after, 2000);
      if (loss > LOSS && after < 300) { notes.push(`LOSS ${ms[i]} ${best}->${after}`); bad++; }
    }
  }
  // 마지막 국면 평가 (내 관점)
  let fin = 0;
  if (g.isCheckmate()) fin = g.turn() === c.me ? -9999 : 9999;
  else { const s = scoreOf((await eng.analyse(g.fen(), DEPTH, 1)).infos[0]); fin = g.turn() === c.me ? s : -s; }
  console.log(`${c.id.padEnd(16)} end=${String(fin).padStart(6)} ${notes.join(" | ")}`);
}
eng.stop();
console.log(bad ? `\n${bad} problem(s)` : "\nall ok");
process.exit(bad ? 1 : 0);
