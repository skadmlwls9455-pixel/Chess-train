# 폐관 수련 도장 ♞

에이든이랑 두면서 크는 체스 수련장. 400점대부터 1200점대까지 구간별로 사람처럼 실수하는 봇과 두고, 진 판은 실수한 지점으로 되감아서 끝까지 다시 둔다.

## 수련 구성

- **대국**: 400 / 600 / 800 / 1000 / 1200 구간. 400~800은 애기 에이든, 1000부터는 에이든.
  - 봇은 [Maia-3](https://github.com/CSSLab/maia3)(리체스 실전 기보로 학습한 "사람 수 예측" 모델)이 그 점수대 사람이 둘 법한 수를 확률대로 뽑아. 브라우저 안에서 돌아가고(int8 ONNX 6.7MB), 처음 열 때 몇 초 걸려.
  - Maia는 리체스 점수 기준이라 체스닷컴 점수와의 저레이팅 차이만큼 올려서 넣어: 400→700, 600→900, 800→1050, 1000→1250, 1200→1450. 이 환산은 근사치야.
  - Maia를 못 불러오는 기기에서는 예전 엔진 봇(Stockfish 후보수 + 사람 실수 모델 + 저레이팅 오프닝북)이 대신 둬.
  - 최근 5판 중 3승이면 다음 구간이 열려.
  - 점검 모드: 기물이 공짜로 걸리거나 한 수 메이트를 허용하는 수를 두면 한 번 물어봐.
  - 숫자(평가치, 승률)는 화면에 안 보여 줘. 실수는 `??` `?` 배지와 에이든 말풍선으로만.
- **되감기**: 판이 끝나면 내 실수 지점을 찾아. 판정은 Lichess와 같은 기준이야: 승률이 30%p 떨어지면 블런더 `??`, 20%p면 실수 `?`, 10%p면 부정확 `?!`. 부정확은 일지에 기록만 하고, 되감기와 오답노트는 실수 이상만. 첫 실수 직전으로 돌아가서 더 나은 수를 찾고, 같은 봇과 끝까지 이어 둬. 이어 두다가 또 크게 기우는 수를 두면 그 자리에서 멈추고 다시 찾기. 이기거나 비기면 완주.
  - 그때 둔 수를 또 두면 손버릇으로 기록돼.
  - 두 번 틀리면 기물 힌트, 세 번 틀리면 정답 칸.
- **오프닝 카드**: 레퍼토리는 백 이탈리안(프라이드 리버), 흑은 1.e4에 투 나이츠, 1.d4에 …d5(런던엔 …c5 …Qb6). 틀리면 그 수의 이유를 알려 줘. 간격 반복으로 다시 나와.
- **오답노트**: 모든 실수 장면이 쌓이고, 1·3·7·14·30일 간격으로 다시 나와.
- **일지**: 실수 유형(기물 흘림, 오프닝, 이긴 판 놓침, 메이트 놓침/허용, 스테일메이트), 손버릇, 판마다 제일 컸던 실수 3개.

## 실행

빌드 없는 정적 사이트야.

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Vercel / GitHub Pages / Netlify에 폴더째 올려도 돼. 기록은 그 기기 브라우저(localStorage)에만 저장되고, 일지 탭에서 백업 파일로 옮길 수 있어.

## 애기 에이든 그림

`img/baby/`의 표정 6장(think, surprise, smile, playful, frust, joy)이 400~800 구간에서 쓰여. 원본에서 얼굴 쪽을 256px 정사각형으로 잘라 webp로 넣었어. 파일이 없으면 원래 에이든 얼굴로 대신해.

## 개발 도구

```bash
node tools/check-cards.mjs   # 오프닝 카드 수순이 합법이고 내 수가 엔진 기준 손해가 없는지 검증
node tools/bot-sim.mjs 16    # 엔진 봇(대체용) 인접 구간끼리 대국
cd tools && npm i && node maia-sim.mjs 12   # Maia 봇 인접 구간끼리, 같은 구간 엔진 봇과 대국
```

## 구조

```
index.html, style.css
src/app.js       화면 흐름 (대국, 되감기, 카드, 오답, 일지)
src/bots.js      구간별 봇 (Maia-3 우선, 엔진 봇 대체)
src/maia.js      Maia-3 입력 인코딩과 추론 (onnxruntime-web)
src/book.js      봇 오프닝북 (저레이팅에서 자주 나오는 수)
src/cards.js     오프닝 대응 카드
src/review.js    판 분석, 실수 판정, 점검 모드
src/coach.js     에이든 대사와 표정
src/board.js     보드 UI
src/store.js     저장, 간격 반복, 구간 진행
src/engine.js    Stockfish 워커 래퍼
vendor/          chess.js, Stockfish WASM, onnxruntime-web
assets/maia/     Maia-3 5M int8 ONNX 모델
assets/sfx/      효과음
img/             에이든 그림 (코드와 다른 라이선스, 아래 참고)
```

## 라이선스

코드: Copyright (C) 2026 Katherine Nahm, **AGPL-3.0-or-later** (`LICENSE`). Maia-3 코드·가중치가 AGPL-3.0이라 같이 따라가 (Stockfish의 GPLv3와도 함께 쓸 수 있어). 웹에 올려 서비스할 때도 소스 공개 조건이 붙는데, 이 레포가 공개라 충족돼.

에이든 그림(`img/`): © 2026 Kate Nahm. All rights reserved. GPL 적용 대상이 아니고, 허락 없이 복제, 수정, 배포, 상업적 이용을 할 수 없어.

서드파티: [Maia-3](https://github.com/CSSLab/maia3) 코드·5M 가중치 (AGPL-3.0, `assets/maia/`), [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (MIT), [Stockfish](https://stockfishchess.org/) / [Stockfish.js](https://github.com/nmrugg/stockfish.js) (GPLv3), [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause), cburnett 기물 by Colin M.L. Burnett (CC BY-SA 3.0).
