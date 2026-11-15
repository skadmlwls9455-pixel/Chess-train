# Maia-3 5M (int8)

- 원본: [UofTCSSLab/Maia3-5M](https://huggingface.co/UofTCSSLab/Maia3-5M), 코드 [CSSLab/maia3](https://github.com/CSSLab/maia3) — AGPL-3.0 (`LICENSE-maia3`)
- 논문: Monroe et al., *Chessformer: A Unified Architecture for Chess Modeling* (ICLR 2026)
- 변환: `tools/maia/export.py` 로 ONNX(opset 17) 내보내기 → onnxruntime 동적 int8 양자화
  - fp32 대비 최선수 일치 58/59 국면, 평균 KL 0.0008
- 입력: tokens [1, 64, 97], self_elo [1], oppo_elo [1] (리체스 기준 점수) / 출력: logits_move [1, 4352], logits_value [1, 3]
