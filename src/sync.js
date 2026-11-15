// 비밀 코드로 기록 동기화 (api/sync.js). 나중에 저장한 쪽이 이긴다.
// 코드는 이 기기 localStorage에만 따로 두고, 기록 본문에는 넣지 않는다.
import * as store from "./store.js";

const CODE_KEY = "chess-train:sync";
let code = "";
try { code = localStorage.getItem(CODE_KEY) || ""; } catch (_) {}
let timer = null, listeners = [];
export let status = code ? "idle" : "off"; // off | idle | saving | ok | error

const setStatus = (s) => { status = s; listeners.forEach((f) => f(s)); };
export const onStatus = (f) => listeners.push(f);
export const getCode = () => code;

export function newCode() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const a = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(a, (x) => abc[x % abc.length]).join("").replace(/(.{4})(?=.)/g, "$1-");
}

async function call(method, body, keepalive) {
  return fetch("api/sync", {
    method, keepalive,
    headers: { "x-sync-code": code, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// 서버 기록이 더 새로우면 받아오고 true, 아니면 내 기록을 올림
export async function pull() {
  if (!code) return false;
  setStatus("saving");
  try {
    const r = await call("GET");
    if (r.status === 404) { await push(); return false; }
    if (!r.ok) throw new Error(r.status);
    const remote = await r.json();
    const local = store.state().updatedAt || 0;
    if (remote.updatedAt > local) { store.replace(remote.data); setStatus("ok"); return true; }
    if (remote.updatedAt < local) await push(); else setStatus("ok");
    return false;
  } catch (_) { setStatus("error"); return false; }
}

export async function push(keepalive) {
  if (!code) return;
  clearTimeout(timer); timer = null;
  setStatus("saving");
  try {
    const S = store.state();
    const r = await call("PUT", { updatedAt: S.updatedAt || Date.now(), data: S }, keepalive);
    if (r.status === 409) { const remote = await r.json(); store.replace(remote.data); setStatus("ok"); location.reload(); return; }
    if (!r.ok) throw new Error(r.status);
    setStatus("ok");
  } catch (_) { setStatus("error"); }
}

// 저장할 때마다 바로 보내지 않고 3초 모아서 한 번
export function schedule() {
  if (!code) return;
  clearTimeout(timer);
  timer = setTimeout(() => push(), 3000);
}

export async function connect(c) {
  code = c.trim();
  try { localStorage.setItem(CODE_KEY, code); } catch (_) {}
  return pull();
}
export function disconnect() {
  code = ""; clearTimeout(timer);
  try { localStorage.removeItem(CODE_KEY); } catch (_) {}
  setStatus("off");
}

store.setOnSave(schedule);
// 앱을 닫거나 백그라운드로 갈 때 남은 걸 바로 보냄
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && timer) push(true); });
