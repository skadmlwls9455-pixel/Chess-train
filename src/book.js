// 봇 오프닝북: 저레이팅 판에서 실제로 자주 나오는 수 (이상한 수 포함).
// 키: 지금까지 수순(SAN, 공백), 값: [수, 가중치, 최대 구간(이 구간 이하에서만), 최소 구간]
// 수순이 책에 없으면 엔진으로 넘어간다.
const B = {
  // ---- 봇이 백 ----
  "": [["e4", 6], ["d4", 3], ["Nf3", 0.5], ["c4", 0.4]],
  "e4 e5": [["Nf3", 5], ["Qh5", 3, 600], ["Bc4", 2], ["Qf3", 1, 400], ["Nc3", 1], ["d4", 1]],
  "e4 e5 Qh5 Nc6": [["Bc4", 5], ["Nf3", 1]],
  "e4 e5 Qh5 Nc6 Bc4 g6": [["Qf3", 5], ["Qe2", 1], ["Qh3", 0.5, 600]],
  "e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6": [["Qb3", 3, 800], ["Ne2", 2], ["d3", 1], ["g4", 1, 400]],
  "e4 e5 Bc4 Nc6": [["Qh5", 2, 600], ["Qf3", 1, 400], ["Nf3", 3], ["d3", 1]],
  "e4 e5 Bc4 Nf6": [["d3", 2], ["Nf3", 2], ["Qf3", 0.7, 400]],
  "e4 e5 Nf3 Nc6": [["Bc4", 5], ["Bb5", 1.2], ["d4", 1.5], ["Nc3", 1.5]],
  "e4 e5 Nf3 Nc6 Bc4 Nf6": [["Ng5", 3], ["d3", 2], ["Nc3", 2], ["O-O", 1]],
  "e4 e5 Nf3 Nc6 Bc4 Bc5": [["c3", 2], ["d3", 2], ["O-O", 2], ["Nc3", 2]],
  "e4 e5 Nf3 Nc6 d4 exd4": [["Nxd4", 4], ["Bc4", 1]],
  "e4 e5 d4 exd4": [["Qxd4", 4], ["c3", 1], ["Nf3", 1]],
  "e4 e5 Nf3 Nc6 Bb5 a6": [["Ba4", 3], ["Bxc6", 2]],
  "d4 d5": [["Bf4", 4], ["c4", 2], ["Nf3", 2], ["e3", 1]],
  "d4 d5 Bf4 c5": [["e3", 4], ["c3", 1], ["dxc5", 1]],
  "d4 d5 Bf4 c5 e3 Nc6": [["c3", 3], ["Nf3", 3], ["Bd3", 1, 800], ["Nd2", 1]],
  "d4 d5 Bf4 c5 e3 Nc6 c3 Qb6": [["Qb3", 3], ["Qc2", 1], ["Bd3", 1.2, 800], ["Nd2", 1]],
  "d4 d5 c4 e6": [["Nc3", 4], ["Nf3", 2]],
  "d4 d5 c4 e6 Nc3 Nf6": [["Bg5", 3], ["Nf3", 2]],
  "d4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5": [["Nxd5", 2, 800], ["e3", 3]],
  "d4 d5 Nf3 Nf6": [["e3", 2], ["Bf4", 3], ["c4", 1]],

  // ---- 봇이 흑 (내가 1.e4) ----
  "e4": [["e5", 6], ["c5", 1], ["d5", 1.4], ["e6", 0.7], ["c6", 0.7], ["Nc6", 0.4, 600]],
  "e4 e5 Nf3": [["Nc6", 6], ["d6", 2], ["Nf6", 1], ["f6", 0.6, 600], ["Qf6", 0.5, 400]],
  "e4 e5 Nf3 Nc6 Bc4": [["Nf6", 3], ["Bc5", 3], ["d6", 1], ["Nd4", 0.6, 800], ["h6", 0.7, 600]],
  "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5": [["d5", 4], ["Bc5", 0.5], ["h6", 1, 600], ["d6", 1, 600], ["Qe7", 0.6, 400]],
  "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5": [["Nxd5", 3, 800], ["Na5", 2], ["Nd4", 0.4], ["b5", 0.4]],
  "e4 e5 Nf3 d6 Bc4": [["Bg4", 2], ["Nf6", 2], ["Be7", 1], ["Nc6", 1]],
  "e4 e5 Nf3 d6 Bc4 Bg4 Nc3": [["g6", 1.5, 800], ["Nc6", 2], ["Nf6", 1.5]],
  "e4 e5 Nf3 Nf6 Nxe5": [["Nxe4", 2, 800], ["d6", 3], ["Qe7", 1]],
  "e4 e5 Nf3 Nf6 Nxe5 Nxe4 Qe2": [["Nf6", 2, 600], ["Qe7", 2]],
  "e4 d5 exd5": [["Qxd5", 4], ["Nf6", 1]],
  "e4 d5 exd5 Qxd5 Nc3": [["Qa5", 3], ["Qd8", 1], ["Qe5+", 0.8, 600]],
};

export function bookMove(history, tierId, rnd = Math.random) {
  if (history.length > 14) return null;
  const opts = (B[history.join(" ")] || []).filter(([, , max, min]) => (!max || tierId <= max) && (!min || tierId >= min));
  if (!opts.length) return null;
  // 높은 구간일수록 책을 덜 따른다 (엔진다운 수로 넘어감)
  if (rnd() < (tierId - 400) / 2000) return null;
  const total = opts.reduce((s, x) => s + x[1], 0);
  let r = rnd() * total;
  for (const [san, w] of opts) if ((r -= w) <= 0) return san;
  return opts[opts.length - 1][0];
}
