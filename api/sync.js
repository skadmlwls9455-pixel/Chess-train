// 기록 동기화 (Vercel 서버리스 함수 + Upstash Redis, 예전 이름 Vercel KV)
// 비밀 코드 하나로 기록을 저장·불러온다. 코드 자체는 저장하지 않고 SHA-256 해시만 키로 쓴다.
//   GET  /api/sync            헤더 x-sync-code → { updatedAt, data } 또는 404
//   PUT  /api/sync            헤더 x-sync-code, 본문 { updatedAt, data }
//        서버에 더 새 기록이 있으면 409 + 서버 기록을 돌려준다 (나중에 저장한 쪽이 이김)
// 필요한 환경 변수: KV_REST_API_URL, KV_REST_API_TOKEN (Vercel 마켓플레이스 Upstash 연결 시 자동)
import { createHash } from "node:crypto";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const MAX = 900 * 1024; // Upstash 무료 요청 한도(1MB) 아래로

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).result;
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  let s = "";
  for await (const c of req) { s += c; if (s.length > MAX) break; }
  return s;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) return res.status(503).json({ error: "storage not configured" });
  const code = String(req.headers["x-sync-code"] || "");
  if (code.length < 8 || code.length > 128) return res.status(400).json({ error: "bad code" });
  const key = "chess-train:" + createHash("sha256").update(code).digest("hex");
  try {
    if (req.method === "GET") {
      const v = await redis(["GET", key]);
      if (!v) return res.status(404).json({ error: "not found" });
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).send(v);
    }
    if (req.method === "PUT") {
      const raw = await readBody(req);
      if (raw.length > MAX) return res.status(413).json({ error: "too large" });
      let body;
      try { body = JSON.parse(raw); } catch (_) { return res.status(400).json({ error: "bad json" }); }
      if (!body || typeof body.updatedAt !== "number" || typeof body.data !== "object") return res.status(400).json({ error: "bad body" });
      const cur = await redis(["GET", key]);
      if (cur) {
        const c = JSON.parse(cur);
        if (c.updatedAt > body.updatedAt) { res.setHeader("Content-Type", "application/json; charset=utf-8"); return res.status(409).send(cur); }
      }
      await redis(["SET", key, JSON.stringify({ updatedAt: body.updatedAt, data: body.data })]);
      return res.status(200).json({ ok: true, updatedAt: body.updatedAt });
    }
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "method" });
  } catch (e) {
    return res.status(502).json({ error: "storage failed" });
  }
}
