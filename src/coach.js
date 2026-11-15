// 에이든: 상대 겸 코치. 400~800은 애기 에이든, 1000부터 원래 에이든.
// 애기 그림(img/baby/*.png)이 아직 없으면 원래 에이든 얼굴로 대신한다.
import { tierOf } from "./bots.js";

export const FACES = ["think", "surprise", "smile", "playful", "frust", "joy"];
const babyMissing = new Set();

export function faceSrc(stage, face) {
  if (stage === "baby" && !babyMissing.has(face)) return `img/baby/${face}.png`;
  return `img/aiden/${face}.webp`;
}
export function onFaceError(img, stage, face) {
  if (stage === "baby") { babyMissing.add(face); img.src = `img/aiden/${face}.webp`; }
}

const L = {
  hello: {
    baby: ["에이든이랑 한 판 하자! 이번엔 안 질 거야.", "체스판 꺼냈어! 빨리 앉아.", "나 오늘 퀸 엄청 쓸 거다?"],
    adult: ["또 왔네. 이번엔 어떤 판이 나올지 보자.", "앉아. 대충 두면 바로 티 난다.", "오늘은 끝까지 집중해 봐."],
  },
  myCapture: {
    baby: ["앗 내 거!! 돌려줘…", "으앙 그거 아끼는 건데.", "봤어? 방금 그거 실수 아니야. 작전이야."],
    adult: ["…그건 내가 놓쳤네.", "좋아, 그건 잘 봤어.", "흠. 계산 밖이었다."],
  },
  botCapture: {
    baby: ["에헤헤 내가 먹었다!", "냠. 공짜였어!", "이거 원래 내 거였던 거 아니야?"],
    adult: ["걸려 있었어. 다음엔 한 번 더 봐.", "그 기물, 지켜 줬어야지.", "고마워. 잘 받을게."],
  },
  check: {
    baby: ["체크! 체크! 도망가!", "킹 위험해~"],
    adult: ["체크.", "킹 조심."],
  },
  checked: {
    baby: ["으악 체크야?!", "히잉, 킹 도망!"],
    adult: ["체크라… 괜찮아.", "좋은 체크네."],
  },
  win: {
    baby: ["으아앙 졌어… 한 판만 더!", "너 왜 이렇게 세?!"],
    adult: ["잘 뒀어. 인정.", "이번 판은 네 거야."],
  },
  loss: {
    baby: ["내가 이겼다! 근데 같이 다시 보자. 어디서 꼬였는지 찾아 줄게.", "이겼다~ 히히. 되감기 하러 가자!"],
    adult: ["끝났어. 어디서 갈렸는지 같이 보자.", "졌다고 끝난 거 아니야. 되감아서 다시 두자."],
  },
  draw: {
    baby: ["비겼다! 사이좋게!", "무승부~ 근데 이길 수 있었던 것 같은데?"],
    adult: ["무승부. 이길 수 있던 지점이 있었는지 보자."],
  },
  rewind: {
    baby: ["여기서부터 다시! 다른 수 찾아봐.", "여기야 여기! 아까랑 다르게 둬 봐."],
    adult: ["여기서 갈렸어. 다시 둬 봐.", "이 장면. 더 나은 수가 있어."],
  },
  wrong: {
    baby: ["음… 그건 아닌 것 같아!", "다시! 한 번 더!"],
    adult: ["아니야. 상대가 뭘 노리는지 먼저 봐.", "그 수도 아쉬워. 다시."],
  },
  habit: {
    baby: ["그거 아까 그 수잖아! 손이 기억하고 있어.", "또 그 수야~ 손버릇 발견!"],
    adult: ["그때 둔 그 수야. 손버릇이야.", "똑같은 수. 손이 먼저 나갔지?"],
  },
  right: {
    baby: ["맞았어!! 거기서부터 계속 두자!", "우와 찾았다! 이어서 가자!"],
    adult: ["그거야. 이어서 끝까지 두자.", "좋아. 거기서부터 계속."],
  },
  liveStop: {
    baby: ["잠깐잠깐! 그 수 다시 생각해 봐.", "멈춰! 거기 뭔가 이상해."],
    adult: ["잠깐. 그 수는 다시 봐.", "멈춰. 방금 그 수, 판이 기운다."],
  },
  hint: {
    baby: ["힌트! 반짝이는 기물 움직여 봐.", "이 친구가 정답 기물이야."],
    adult: ["표시한 기물을 봐.", "그 기물로 찾아."],
  },
  reveal: {
    baby: ["정답은 이거야! 똑같이 둬 봐.", "이렇게 두는 거야. 따라 해 봐!"],
    adult: ["답은 이거. 직접 둬 보고 넘어가.", "이 수였어. 손으로 한 번 둬 봐."],
  },
  complete: {
    baby: ["끝까지 다 뒀다!! 이번엔 우리 둘 다 잘했어!", "완주! 머리 쓰다듬어 줘."],
    adult: ["완주. 이번엔 끝까지 버텼네.", "끝까지 뒀어. 이게 수련이야."],
  },
  hang: {
    baby: ["잠깐! {p} 지금 걸려 있어. 그래도 둘 거야?", "어… {p} 먹혀도 괜찮아?"],
    adult: ["그 수 두면 {p}가 걸린다. 확실해?", "{p}가 공짜로 잡혀. 그래도?"],
  },
  mateHang: {
    baby: ["그거 두면 메이트 당해!!", "으악 그 수는 바로 끝나!"],
    adult: ["그 수는 한 수 메이트를 허용해.", "그거 두면 바로 메이트야."],
  },
  tilt: {
    baby: ["{n}연패야… 오늘은 카드 몇 장 풀고 쉬자!"],
    adult: ["{n}연패. 지금은 판보다 머리 식힐 때야. 카드나 오답 몇 개만 풀자."],
  },
  card: {
    baby: ["오프닝 카드 시간! 내가 상대 해 줄게."],
    adult: ["카드야. 수순보다 이유를 기억해."],
  },
  cardWrong: {
    baby: ["땡! 이유는 이거야: {w}"],
    adult: ["아니야. {w}"],
  },
  cardDone: {
    baby: ["카드 끝! 잘했어!"],
    adult: ["카드 완료."],
  },
};

export function line(key, tierId, vars = {}) {
  const stage = tierOf(tierId).stage;
  const arr = (L[key] && (L[key][stage] || L[key].adult)) || [""];
  let s = arr[Math.floor(Math.random() * arr.length)];
  for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}
