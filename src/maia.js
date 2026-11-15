// Maia-3 (사람 수 예측 모델) 브라우저/노드 추론.
// 모델: UofTCSSLab/Maia3-5M, ONNX로 변환 후 int8 양자화 (tools/maia/export.py).
// 입력 인코딩은 CSSLab/maia3 의 maia3/dataset.py, maia3/utils.py 를 그대로 옮긴 것 (AGPL-3.0).
//  - 흑 차례면 판을 상하 반전 + 색 교환해서 항상 "두는 쪽 = 백" 시점으로 넣는다
//  - 칸(a1=0 … h8=63)마다 12채널 원핫, 같은 판을 8번 반복(히스토리 없음, 공식 UCI 기본값과 같음) + 시간 채널 1개
//  - 출력 4352개 = 64×64 (출발×도착) + 승진 256개 (출발 파일×도착 파일×q,r,b,n)
import { Chess } from "../vendor/chess.js";

const HISTORY = 8;
const CH = 12 * HISTORY + 1;
const FILES = "abcdefgh";
const TYPE = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };
const PROMO = { q: 0, r: 1, b: 2, n: 3 };

const sqIdx = (s) => FILES.indexOf(s[0]) + 8 * (+s[1] - 1);
const mirrorSq = (s) => s[0] + (9 - +s[1]);

export function moveIndex(uci) {
  const from = sqIdx(uci.slice(0, 2)), to = sqIdx(uci.slice(2, 4));
  if (uci.length > 4) return 4096 + (((from % 8) * 8 + (to % 8)) * 4 + PROMO[uci[4]]);
  return from * 64 + to;
}

// 판 → Float32Array(64 × 97)
export function encode(fen) {
  const g = new Chess(fen);
  const black = g.turn() === "b";
  const one = new Float32Array(64 * 12);
  for (const row of g.board()) for (const p of row) {
    if (!p) continue;
    let sq = sqIdx(p.square), color = p.color;
    if (black) { sq ^= 56; color = color === "w" ? "b" : "w"; }
    one[sq * 12 + TYPE[p.type] + (color === "b" ? 6 : 0)] = 1;
  }
  const out = new Float32Array(64 * CH);
  for (let sq = 0; sq < 64; sq++) {
    for (let h = 0; h < HISTORY; h++) for (let c = 0; c < 12; c++) out[sq * CH + h * 12 + c] = one[sq * 12 + c];
  }
  return out;
}

// 합법수 목록과 각 수의 모델 인덱스 (흑이면 반전한 좌표로)
export function legalIndex(fen) {
  const g = new Chess(fen);
  const black = g.turn() === "b";
  return g.moves({ verbose: true }).map((m) => {
    const uci = m.from + m.to + (m.promotion || "");
    const key = black ? mirrorSq(m.from) + mirrorSq(m.to) + (m.promotion || "") : uci;
    return { uci, san: m.san, idx: moveIndex(key) };
  });
}

export class Maia {
  // ort: onnxruntime-web 또는 onnxruntime-node 모듈, model: URL/경로 또는 바이트
  constructor(ort, model) { this.ort = ort; this.model = model; this.session = null; this.loading = null; }
  load() {
    if (!this.loading) this.loading = this.ort.InferenceSession.create(this.model).then((s) => (this.session = s));
    return this.loading;
  }
  // 수마다 확률. selfElo: 두는 쪽, oppoElo: 상대 (리체스 기준 점수)
  async policy(fen, selfElo, oppoElo = selfElo) {
    await this.load();
    const { Tensor } = this.ort;
    const feeds = {
      tokens: new Tensor("float32", encode(fen), [1, 64, CH]),
      self_elo: new Tensor("float32", Float32Array.from([selfElo]), [1]),
      oppo_elo: new Tensor("float32", Float32Array.from([oppoElo]), [1]),
    };
    const out = await this.session.run(feeds);
    const logits = out.logits_move.data;
    const legal = legalIndex(fen);
    let max = -Infinity;
    for (const m of legal) max = Math.max(max, logits[m.idx]);
    let sum = 0;
    for (const m of legal) { m.logit = logits[m.idx]; m.p = Math.exp(m.logit - max); sum += m.p; }
    for (const m of legal) m.p /= sum;
    return legal.sort((a, b) => b.p - a.p);
  }
}

// 확률 목록에서 하나 뽑기 (temperature 1 = 모델 그대로, 낮을수록 최빈수 쪽)
export function sample(moves, rnd = Math.random, temperature = 1) {
  if (!moves.length) return null;
  if (temperature <= 0) return moves[0];
  const max = Math.max(...moves.map((m) => m.logit / temperature));
  const ws = moves.map((m) => Math.exp(m.logit / temperature - max));
  const tot = ws.reduce((a, b) => a + b, 0);
  let r = rnd() * tot;
  for (let i = 0; i < moves.length; i++) if ((r -= ws[i]) <= 0) return moves[i];
  return moves[moves.length - 1];
}
