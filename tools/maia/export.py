# Maia-3 5M → ONNX → int8. 필요: CSSLab/maia3 클론, torch(cpu), onnx, onnxruntime, python-chess
# 경로는 작업한 환경 기준이라 쓸 때 맞게 바꿔.
import sys, types, torch, numpy as np
sys.path.insert(0, "/tmp/claude-0/maia3src")
from maia3.models import MAIA3Model
from maia3.model_registry import MODEL_SPECS
spec = [s for s in MODEL_SPECS if s.name == "maia3-5m"][0]
cfg = types.SimpleNamespace(**spec.config)
m = MAIA3Model(cfg)
ck = torch.load("/tmp/claude-0/maiaw/maia3-5m.pt", map_location="cpu", weights_only=True)
sd = ck["model_state_dict"] if "model_state_dict" in ck else ck
sd = {k.replace("smolgen", "gab"): v for k, v in sd.items()}
miss, unexp = m.load_state_dict(sd, strict=False); print("missing", miss[:5], "unexpected", unexp[:5])
m.eval()
# RMSNorm을 기본 연산으로 풀어서 내보낸다 (onnxruntime-web 호환)
def _rms(self, x):
    eps = self.eps if self.eps is not None else torch.finfo(x.dtype).eps
    y = x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + eps)
    return y * self.weight if self.weight is not None else y
torch.nn.RMSNorm.forward = _rms
class W(torch.nn.Module):
    def __init__(s, m): super().__init__(); s.m = m
    def forward(s, tokens, self_elo, oppo_elo):
        lm, lv, _ = s.m(tokens, self_elo, oppo_elo)
        return lm, lv
w = W(m)
tok = torch.zeros(1, 64, 12 * cfg.history + 1); se = torch.tensor([800.0]); oe = torch.tensor([800.0])
torch.onnx.export(w, (tok, se, oe), "/tmp/claude-0/maia3-5m.onnx", input_names=["tokens", "self_elo", "oppo_elo"],
                  output_names=["logits_move", "logits_value"], opset_version=17, dynamo=False,
                  dynamic_axes={"tokens": {0: "b"}, "self_elo": {0: "b"}, "oppo_elo": {0: "b"}, "logits_move": {0: "b"}, "logits_value": {0: "b"}})
import onnxruntime as ort
s = ort.InferenceSession("/tmp/claude-0/maia3-5m.onnx")
x = torch.rand(2, 64, 97).round()
a = w(x, torch.tensor([600.0, 1500.0]), torch.tensor([600.0, 1500.0]))[0].detach().numpy()
b = s.run(None, {"tokens": x.numpy(), "self_elo": np.array([600, 1500], np.float32), "oppo_elo": np.array([600, 1500], np.float32)})[0]
print("maxdiff", np.abs(a - b).max())

# int8 양자화 (브라우저용, 약 6.7MB)
from onnxruntime.quantization import quantize_dynamic, QuantType
quantize_dynamic("/tmp/claude-0/maia3-5m.onnx", "/tmp/claude-0/maia3-5m.int8.onnx", weight_type=QuantType.QInt8)
