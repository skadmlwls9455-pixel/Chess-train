// Maia 봇 강도 확인: 인접 구간끼리, 그리고 같은 구간의 엔진 봇(Maia 없이)과 대국.
// cd tools && npm i && node maia-sim.mjs [판 수=12]
import ort from "onnxruntime-node";
import { Chess } from "../vendor/chess.js";
import { botMove, TIERS } from "../src/bots.js";
import { Maia } from "../src/maia.js";
import { NodeEngine } from "./uci.mjs";

const N = +(process.argv[2] || 12);
const eng = new NodeEngine();
const analyse = (f, d, m) => eng.analyse(f, d, m);
const maia = new Maia(ort, new URL("../assets/maia/maia3-5m.int8.onnx", import.meta.url).pathname);
await maia.load();

// p = { tier, maia: bool }
async function game(w, b) {
  const g = new Chess(); const hist = [];
  while (!g.isGameOver() && hist.length < 240) {
    const p = g.turn() === "w" ? w : b;
    const r = await botMove(analyse, g.fen(), p.tier, { history: hist, maia: p.maia ? maia : null });
    const m = g.move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] });
    hist.push(m.san);
  }
  if (g.isCheckmate()) return g.turn() === "w" ? 0 : 1;
  return 0.5;
}
const name = (p) => `${p.maia ? "maia" : "eng "}${p.tier}`;
async function match(a, b) {
  let sa = 0;
  for (let i = 0; i < N; i++) sa += i % 2 ? 1 - (await game(b, a)) : await game(a, b);
  console.log(`${name(a)} vs ${name(b)}: ${sa}/${N} (${Math.round((100 * sa) / N)}%)`);
}
const ids = TIERS.map((t) => t.id);
for (let i = 0; i + 1 < ids.length; i++) await match({ tier: ids[i + 1], maia: true }, { tier: ids[i], maia: true });
for (const id of ids) await match({ tier: id, maia: true }, { tier: id, maia: false });
eng.stop();
process.exit();
