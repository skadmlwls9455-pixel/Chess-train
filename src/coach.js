// 에이든: 상대 겸 코치. 400~800은 애기 에이든, 1000부터 원래 에이든.
// 애기 그림(img/baby/*.webp)이 없으면 원래 에이든 얼굴로 대신한다.

export const FACES = ["think", "surprise", "smile", "playful", "frust", "joy"];
const babyMissing = new Set();

export function faceSrc(stage, face) {
  if (stage === "baby" && !babyMissing.has(face)) return `img/baby/${face}.webp`;
  return `img/aiden/${face}.webp`;
}
export function onFaceError(img, stage, face) {
  if (stage === "baby") { babyMissing.add(face); img.src = `img/aiden/${face}.webp`; }
}

// 대사: 캐릭터 연기 없이 상황만 짧게. 구간(애기/어른)과 상관없이 같은 말투.
const L = {
  hello: ["한 판 두자. 천천히 둬도 돼.", "준비되면 시작해.", "시작하자."],
  myCapture: ["잘 잡았어.", "그건 내가 놓쳤어.", "좋은 수야."],
  botCapture: ["그 기물은 지켜지지 않았어.", "걸려 있던 기물이라 가져갈게.", "두기 전에 걸린 기물이 있는지 한 번 봐."],
  check: ["체크."],
  checked: ["체크네."],
  win: ["네가 이겼어. 잘 뒀어."],
  loss: ["끝났어. 어디서 기울었는지 같이 보자."],
  draw: ["무승부야. 이길 수 있던 곳이 있었는지 보자."],
  rewind: ["여기서 판이 기울었어. 다른 수를 찾아봐.", "이 장면에 더 나은 수가 있어."],
  wrong: ["그 수는 아니야. 상대가 뭘 노리는지 먼저 봐.", "아쉬워. 다시 해 보자."],
  habit: ["그때 둔 수랑 같아.", "아까와 같은 수야. 손이 먼저 나간 것 같아."],
  right: ["맞아. 여기서부터 이어서 두자.", "좋아. 계속 가자."],
  liveStop: ["잠깐, 그 수로 판이 크게 기울어. 다시 생각해 봐."],
  hint: ["표시한 기물을 움직여 봐."],
  reveal: ["정답은 표시한 칸이야. 직접 둬 보고 넘어가자."],
  complete: ["끝까지 뒀어. 수고했어."],
  hang: ["그 수를 두면 {p} 잡혀. 그래도 둘까?"],
  mateHang: ["그 수를 두면 바로 메이트야."],
  tilt: ["{n}연패야. 오늘은 카드나 오답부터 풀어 보자."],
  cardWrong: ["{w}"],
  cardDone: ["카드 끝."],
};

export function line(key, tierId, vars = {}) {
  const arr = L[key] || [""];
  let s = arr[Math.floor(Math.random() * arr.length)];
  for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}
