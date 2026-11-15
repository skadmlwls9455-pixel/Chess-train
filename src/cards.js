// 오프닝 대응 카드.
// moves: 처음부터의 수순(SAN, 공백 구분). 내 수(me 쪽)만 맞히면 되고, 상대 수는 봇이 그대로 둔다.
// why[i]: i번째 반수(0부터)가 내 수일 때, 틀리면 보여 줄 한 줄 이유.
// tools/check-cards.mjs 로 내 수가 엔진 기준으로 손해 보지 않는지 검증한다.

export const GROUPS = [
  { id: "w", title: "백: 이탈리안", me: "w" },
  { id: "be4", title: "흑: 상대 1.e4", me: "b" },
  { id: "bd4", title: "흑: 상대 1.d4", me: "b" },
];

export const CARDS = [
  // ---------------- 백: 이탈리안 + 프라이드 리버 ----------------
  {
    id: "w-italian", group: "w", me: "w", title: "이탈리안 기본",
    goal: "중앙 폰, 나이트, 비숍 순서로 꺼내고 캐슬링까지.",
    moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O",
    why: {
      0: "e4로 중앙을 잡고 비숍과 퀸 길을 연다.",
      2: "Nf3는 e5 폰을 공격하면서 나이트를 꺼낸다.",
      4: "Bc4는 흑의 제일 약한 칸 f7을 노린다.",
      6: "c3는 다음에 d4를 밀 준비야.",
      8: "d3로 e4를 받쳐 둔다. 급하지 않게.",
      10: "킹은 캐슬링으로 피신. 그다음에 싸운다.",
    },
  },
  {
    id: "w-fried", group: "w", me: "w", title: "프라이드 리버 공격", trap: true,
    goal: "흑이 …Nf6로 받으면 Ng5로 f7을 두 번 때린다.",
    moves: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7 Qf3+ Ke6 Nc3",
    why: {
      6: "Ng5! 비숍이랑 같이 f7을 두 번 공격해.",
      8: "exd5로 받아. 흑 나이트가 다시 잡으러 오게 만든다.",
      10: "Nxf7! 나이트를 주고 킹을 끌어낸다.",
      12: "Qf3+로 체크하면서 d5 나이트를 핀 건다.",
      14: "Nc3로 d5 나이트를 한 번 더 공격. 흑은 막기 바빠.",
    },
  },
  {
    id: "w-na5", group: "w", me: "w", title: "투 나이츠 …Na5 받기",
    goal: "흑이 정석대로 Na5로 비숍을 쫓으면 폰 하나 이득을 지킨다.",
    moves: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2",
    why: {
      10: "Bb5+로 체크하면서 비숍을 살린다.",
      12: "dxc6로 받아. 폰 하나 더 가진 상태야.",
      14: "Be2로 비숍을 안전하게. 폰 하나 이득은 그대로.",
    },
  },
  {
    id: "w-traxler", group: "w", me: "w", title: "트랙슬러(…Bc5) 피하기",
    goal: "Ng5에 흑이 …Bc5로 반격하면 Nxf7 대신 Bxf7+.",
    moves: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Bc5 Bxf7+ Ke7 Bd5",
    why: {
      8: "Nxf7은 …Bxf2+로 역공 맞아. Bxf7+가 안전하게 폰을 먹는다.",
      10: "Bd5로 비숍을 중앙에 세워. 흑 킹은 캐슬링을 못 해.",
    },
  },
  {
    id: "w-legal", group: "w", me: "w", title: "레갈 메이트 함정", trap: true,
    goal: "…Bg4로 나이트를 핀 걸어 오면 퀸을 주고 메이트.",
    moves: "e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#",
    why: {
      4: "Bc4로 f7을 노려.",
      6: "Nc3로 전개하면서 d5 칸을 노려 둔다.",
      8: "Nxe5! 핀은 가짜야. 퀸을 내줘도 된다.",
      10: "Bxf7+로 킹을 끌어내.",
      12: "Nd5# 메이트.",
    },
  },
  {
    id: "w-shilling", group: "w", me: "w", title: "…Nd4 미끼 무시", trap: true,
    goal: "e5 폰을 일부러 비워 둔 …Nd4는 함정. Nxe5 대신 Nxd4.",
    moves: "e4 e5 Nf3 Nc6 Bc4 Nd4 Nxd4 exd4 O-O",
    why: {
      6: "Nxe5는 …Qg5로 역공 맞는다. 미끼 나이트를 바로 잡아.",
      8: "캐슬링하고 나중에 c3로 d4 폰을 정리하면 돼.",
    },
  },
  {
    id: "w-damiano", group: "w", me: "w", title: "…f6 방어 응징", trap: true,
    goal: "e5를 f6로 막으면 나이트를 바로 던진다.",
    moves: "e4 e5 Nf3 f6 Nxe5 fxe5 Qh5+ Ke7 Qxe5+ Kf7 Bc4+",
    why: {
      4: "Nxe5! …f6는 킹 앞을 연 나쁜 수야.",
      6: "Qh5+로 체크. …g6이면 Qxe5+로 룩까지 노린다.",
      8: "Qxe5+로 폰 되찾으며 계속 체크.",
      10: "Bc4+로 킹을 계속 몰아.",
    },
  },
  {
    id: "w-petrov", group: "w", me: "w", title: "페트로프(…Nf6) 함정", trap: true,
    goal: "…Nxe4로 따라 잡으면 Qe2로 나이트를 핀 건다.",
    moves: "e4 e5 Nf3 Nf6 Nxe5 Nxe4 Qe2 Nf6 Nc6+",
    why: {
      4: "Nxe5로 폰을 먼저 먹어.",
      6: "Qe2! 흑 나이트를 잡겠다고 위협하면서 e파일을 연다.",
      8: "Nc6+ 디스커버드 체크. 다음에 흑 퀸을 먹는다.",
    },
  },
  {
    id: "w-scandi", group: "w", me: "w", title: "스칸디나비안 받기",
    goal: "…d5엔 받아 먹고 퀸을 나이트로 쫓는다.",
    moves: "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3",
    why: {
      2: "exd5로 받아. 흑 퀸이 일찍 나오게 만든다.",
      4: "Nc3는 전개하면서 퀸을 공격해. 공짜 템포.",
      6: "d4로 중앙.",
      8: "Nf3, 평범하게 전개를 이어 가.",
    },
  },
  {
    id: "w-french", group: "w", me: "w", title: "프렌치(…e6) 받기",
    goal: "e5로 밀어서 공간을 잡는다.",
    moves: "e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3",
    why: {
      2: "d4로 중앙 폰 두 개.",
      4: "e5로 밀어 흑 기물 자리를 좁힌다.",
      6: "c3로 d4를 받쳐.",
      8: "Nf3로 d4를 한 번 더 지킨다.",
    },
  },
  {
    id: "w-caro", group: "w", me: "w", title: "카로칸(…c6) 받기",
    goal: "프렌치랑 같은 생각. e5로 민다.",
    moves: "e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2",
    why: {
      2: "d4로 중앙 폰 두 개.",
      4: "e5로 공간.",
      6: "Nf3 전개.",
      8: "Be2 하고 캐슬링 준비.",
    },
  },
  {
    id: "w-sicilian", group: "w", me: "w", title: "시실리안(…c5) 받기",
    goal: "c3 다음 d4로 중앙을 만든다.",
    moves: "e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3",
    why: {
      2: "c3로 d4를 준비해.",
      4: "exd5로 받아.",
      6: "d4로 중앙.",
      8: "Nf3 전개.",
    },
  },

  // ---------------- 흑: 상대 1.e4 ----------------
  {
    id: "be4-scholar", group: "be4", me: "b", title: "스콜라 메이트 막기",
    goal: "퀸이 f7을 노리면 g6로 쫓고 Nf6로 전개. 또 오면 …Nd4로 역습.",
    moves: "e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6 Qb3 Nd4 Bxf7+ Ke7 Nf3 Nxb3",
    why: {
      1: "e5로 중앙.",
      3: "Nc6로 e5 폰부터 지킨다.",
      5: "g6! 퀸을 쫓으면서 f7 메이트를 막아.",
      7: "Nf6로 f7 앞을 다시 막는다.",
      9: "Nd4! f7보다 퀸이 더 급해. 퀸을 공격하면서 c2도 노린다.",
      11: "Ke7로 비숍 체크를 피해. 폰 하나 줬어도 퀸이 더 커.",
      13: "Nxb3로 퀸을 먹는다.",
    },
  },
  {
    id: "be4-italian", group: "be4", me: "b", title: "이탈리안 받기",
    goal: "백이 조용히 두면 똑같이 전개하고 캐슬링.",
    moves: "e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6 O-O O-O",
    why: {
      1: "e5로 중앙.",
      3: "Nc6로 e5 폰을 지켜.",
      5: "Nf6로 e4를 공격하면서 전개.",
      7: "Bc5도 f2를 노린다.",
      9: "d6로 e5를 단단하게.",
      11: "캐슬링.",
    },
  },
  {
    id: "be4-fried", group: "be4", me: "b", title: "프라이드 리버 막기",
    goal: "Ng5엔 …d5, exd5엔 …Na5. 절대 …Nxd5 하지 않기.",
    moves: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4",
    why: {
      7: "…d5로 비숍 길을 막아.",
      9: "…Nxd5는 Nxf7로 킹이 끌려 나와. …Na5로 비숍을 쫓아.",
      11: "…c6로 막으면서 폰을 되찾을 준비.",
      13: "…bxc6, 폰 하나 줬지만 전개가 빠르다.",
      15: "…h6로 나이트를 쫓아.",
      17: "…e4로 한 번 더 쫓아. 흑이 주도권을 잡는다.",
    },
  },
  {
    id: "be4-forktrick", group: "be4", me: "b", title: "포크 트릭", trap: true,
    goal: "백이 Nc3를 두면 …Nxe4로 폰을 먹고 …d5 포크.",
    moves: "e4 e5 Nf3 Nc6 Bc4 Nf6 Nc3 Nxe4 Nxe4 d5 Bd3 dxe4 Bxe4 Bd6",
    why: {
      7: "…Nxe4! 나이트를 일부러 내준다.",
      9: "…d5 포크. 비숍이랑 나이트를 동시에 공격해.",
      11: "…dxe4로 기물을 되찾아.",
      13: "…Bd6로 e5를 지키고 전개.",
    },
  },
  {
    id: "be4-ruy", group: "be4", me: "b", title: "루이 로페즈(Bb5) 받기",
    goal: "…a6로 비숍에게 먼저 물어보고 평범하게 전개.",
    moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7",
    why: {
      5: "…a6로 비숍을 물어봐.",
      7: "…Nf6로 e4 공격.",
      9: "…Be7 하고 캐슬링 준비.",
    },
  },
  {
    id: "be4-scotch", group: "be4", me: "b", title: "스카치(d4) 받기",
    goal: "…exd4 받고 …Nf6로 e4를 공격.",
    moves: "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7",
    why: {
      5: "…exd4로 받아.",
      7: "…Nf6로 e4 폰 공격.",
      9: "…bxc6, 중앙 쪽으로 잡는다.",
      11: "…Qe7로 e5 폰을 핀 건다.",
    },
  },
  {
    id: "be4-center", group: "be4", me: "b", title: "센터 게임(Qxd4) 받기",
    goal: "일찍 나온 퀸을 나이트로 쫓으며 템포를 번다.",
    moves: "e4 e5 d4 exd4 Qxd4 Nc6 Qe3 Nf6 Nc3 Bb4",
    why: {
      3: "…exd4로 받아.",
      5: "…Nc6! 전개하면서 퀸을 쫓아.",
      7: "…Nf6로 e4 폰 공격.",
      9: "…Bb4로 e4를 지키는 나이트에 핀.",
    },
  },

  // ---------------- 흑: 상대 1.d4 ----------------
  {
    id: "bd4-london", group: "bd4", me: "b", title: "런던 대응 (…c5 …Qb6)",
    goal: "Bf4가 빠져서 비어 있는 b2 폰을 퀸으로 노린다.",
    moves: "d4 d5 Bf4 c5 e3 Nc6 c3 Qb6 Qb3 c4 Qc2 Nf6",
    why: {
      1: "…d5로 중앙.",
      3: "…c5로 d4를 바로 압박.",
      5: "…Nc6로 d4를 한 번 더.",
      7: "…Qb6! 비숍이 떠나서 b2가 약해졌어.",
      9: "…c4로 퀸을 쫓으며 공간.",
      11: "…Nf6 전개.",
    },
  },
  {
    id: "bd4-london-b2", group: "bd4", me: "b", title: "런던 b2 폰 먹기", trap: true,
    goal: "백이 b2를 안 지키고 Bd3를 두면 폰 두 개를 먹는다.",
    moves: "d4 d5 Bf4 c5 e3 Nc6 c3 Qb6 Bd3 Qxb2 Nd2 c4 Bc2 Qxc3",
    why: {
      7: "…Qb6, b2랑 d4를 동시에 노려.",
      9: "…Qxb2! 백이 안 지켰으면 공짜 폰이야.",
      11: "…c4로 비숍을 쫓아. 비숍이 피하면 c3도 빈다.",
      13: "…Qxc3, 폰 두 개 이득.",
    },
  },
  {
    id: "bd4-qgd", group: "bd4", me: "b", title: "퀸즈 갬빗 거절",
    goal: "…e6로 d5를 단단하게 지킨다.",
    moves: "d4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bg5 O-O",
    why: {
      3: "…e6로 d5를 받쳐. 폰은 안 받는다.",
      5: "…Nf6 전개.",
      7: "…Be7로 핀을 풀 준비.",
      9: "캐슬링.",
    },
  },
  {
    id: "bd4-elephant", group: "bd4", me: "b", title: "엘리펀트 트랩", trap: true,
    goal: "d5 폰은 미끼. 백이 나이트로 먹으면 퀸을 내주고 더 큰 걸 먹는다.",
    moves: "d4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5 Nxd5 Bxd8 Bb4+ Qd2 Bxd2+ Kxd2 Kxd8",
    why: {
      7: "…Nbd7! d5 폰을 일부러 약하게 둔다.",
      9: "…exd5로 받아.",
      11: "…Nxd5! 퀸을 내줘도 된다.",
      13: "…Bb4+ 체크로 퀸을 되찾는다.",
      15: "…Bxd2+.",
      17: "…Kxd8. 결국 나이트 하나 이득.",
    },
  },
  {
    id: "bd4-colle", group: "bd4", me: "b", title: "콜레(Nf3 e3) 받기",
    goal: "조용한 백엔 …c5로 먼저 부딪힌다.",
    moves: "d4 d5 Nf3 Nf6 e3 e6 Bd3 c5 c3 Nc6",
    why: {
      1: "…d5로 중앙.",
      3: "…Nf6 전개.",
      5: "…e6로 비숍 길을 연다.",
      7: "…c5로 중앙을 두드려.",
      9: "…Nc6 전개.",
    },
  },
];

export function cardMoves(card) {
  return card.moves.trim().split(/\s+/);
}

// i번째 반수 설명. 이 카드에 없으면 같은 수순으로 시작하는 다른 카드에서 빌려 온다.
export function whyFor(card, i) {
  if (card.why[i]) return card.why[i];
  const pre = cardMoves(card).slice(0, i + 1).join(" ");
  for (const c of CARDS) {
    if (c.me === card.me && c.why[i] && cardMoves(c).slice(0, i + 1).join(" ") === pre) return c.why[i];
  }
  return "";
}
