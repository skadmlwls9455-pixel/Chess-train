// 봇 강도 확인: 구간끼리, 그리고 1200 구간 vs Stockfish UCI_Elo 1320(엔진이 허용하는 최저치) 대국.
// node tools/bot-sim.mjs [판 수=12]
import { Chess } from "../vendor/chess.js";
import { botMove, TIERS } from "../src/bots.js";
import { NodeEngine } from "./uci.mjs";

const N = +(process.argv[2] || 12);
const eng = new NodeEngine();
const sfLimited = new NodeEngine("setoption name UCI_LimitStrength value true\nsetoption name UCI_Elo value 1320\n");
const analyse = (f, d, m) => eng.analyse(f, d, m);

async function player(p, g, hist) {
  if (p === "sf") { const r = await sfLimited.play(g.fen(), 80); return r.best; }
  return (await botMove(analyse, g.fen(), p, { history: hist })).uci;
}
async function game(w, b) {
  const g = new Chess(); const hist = [];
  while (!g.isGameOver() && hist.length < 240) {
    const u = await player(g.turn() === "w" ? w : b, g, hist);
    const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    hist.push(m.san);
  }
  if (g.isCheckmate()) return g.turn() === "w" ? 0 : 1;
  return 0.5;
}
async function match(a, b) {
  let sa = 0;
  for (let i = 0; i < N; i++) sa += i % 2 ? 1 - (await game(b, a)) : await game(a, b);
  console.log(`${String(a).padEnd(5)} vs ${String(b).padEnd(5)}: ${sa}/${N} (${Math.round(100 * sa / N)}%)`);
}
const ids = TIERS.map((t) => t.id);
for (let i = 0; i + 1 < ids.length; i++) await match(ids[i + 1], ids[i]);
eng.stop(); sfLimited.stop(); process.exit();
