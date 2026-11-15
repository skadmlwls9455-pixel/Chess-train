// 폐관 수련 도장 — 화면 흐름
import { Chess } from "../vendor/chess.js";
import { Engine } from "./engine.js";
import { Board } from "./board.js";
import { TIERS, tierOf, botMove } from "./bots.js";
import { CARDS, GROUPS, cardMoves, whyFor } from "./cards.js";
import { evalPos, judgeMove, analyseGame, topThree, serious, hangingAfter, SOLVE, PIECE_KO } from "./review.js";
import { faceSrc, onFaceError, line } from "./coach.js";
import * as store from "./store.js";
import { Maia } from "./maia.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const S = store.state;

/* ---------- 엔진 ---------- */
let engine = null;
function eng() {
  if (!engine || engine.dead) engine = new Engine("vendor/stockfish-19-lite-single.js");
  return engine;
}
async function analyse(fen, depth, mpv) {
  try { return await eng().analyse(fen, depth, mpv); }
  catch (e) {
    try { engine && engine.stop(); } catch (_) {}
    engine = null;
    return await eng().analyse(fen, depth, mpv);
  }
}

/* ---------- Maia-3: 사람다운 봇 (불러오는 동안·실패하면 엔진 봇) ---------- */
let maia = null, maiaState = "loading";
(async () => {
  try {
    const ort = await import("../vendor/ort/ort.wasm.min.mjs");
    ort.env.wasm.wasmPaths = new URL("../vendor/ort/", import.meta.url).href;
    ort.env.wasm.numThreads = 1;
    const m = new Maia(ort, "assets/maia/maia3-5m.int8.onnx");
    await m.load();
    await m.policy("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 900);
    maia = m; maiaState = "ready";
  } catch (e) {
    console.warn("Maia 불러오기 실패, 엔진 봇으로 대신", e);
    maiaState = "failed";
  }
  if (VIEW === "setup") renderMaiaState();
})();
const botOpts = (hist) => ({ history: hist, maia });
function renderMaiaState() {
  const el = $("maiaState"); if (!el) return;
  el.textContent = { loading: "사람다운 봇(Maia-3) 불러오는 중… 그 전엔 엔진 봇이 둬.", ready: "사람다운 봇(Maia-3) 준비됨.", failed: "사람다운 봇을 못 불러와서 엔진 봇이 둬." }[maiaState];
}

/* ---------- 소리 ---------- */
const SFX = {};
["click", "hit", "swish", "riser"].forEach((k) => { const a = new Audio(`assets/sfx/${k}.wav`); a.preload = "auto"; a.volume = k === "riser" ? 0.35 : 0.6; SFX[k] = a; });
function sound(m) {
  if (!S().settings.sound) return;
  const k = !m ? "riser" : m.san.includes("+") || m.san.includes("#") ? "swish" : m.captured ? "hit" : "click";
  try { const a = SFX[k].cloneNode(); a.volume = SFX[k].volume; a.play().catch(() => {}); } catch (_) {}
}

/* ---------- 코치 ---------- */
let coachTier = 400;
function say(text, face = "smile", tierId = coachTier) {
  coachTier = tierId;
  const stage = tierOf(tierId).stage;
  const img = $("face");
  const src = faceSrc(stage, face);
  if (!img.src.endsWith(src)) {
    img.onerror = () => onFaceError(img, stage, face);
    img.src = src;
    const av = img.parentElement; av.classList.remove("pop"); void av.offsetWidth; av.classList.add("pop");
  }
  $("say").textContent = text;
}
const sayKey = (key, face, vars) => say(line(key, coachTier, vars), face);

/* ---------- 화면 전환 ---------- */
let VIEW = "home";
function show(v) {
  if (VIEW === "play" && v !== "play" && P && !P.over && P.mode === "game") {
    if (!confirm("대국 중이야. 나가면 기권으로 처리할까?")) return;
    endGame("loss", "resign");
  }
  if (v !== "play") { P = null; document.body.classList.remove("playing"); }
  VIEW = v;
  document.querySelectorAll(".view").forEach((s) => s.classList.toggle("on", s.id === "v-" + v));
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  ({ home: renderHome, setup: renderSetup, cards: renderCards, notes: renderNotes, log: renderLog }[v] || (() => {}))();
  window.scrollTo(0, 0);
}
document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => show(b.dataset.v)));

/* =========================================================
   도장 (홈)
   ========================================================= */
function maxTier() { return Math.max(...S().unlocked); }
function dueNotes() { return S().notes.filter(store.isDue); }
function dueCards() {
  const unseen = CARDS.filter((c) => !store.cardState(c.id).seen);
  const due = CARDS.filter((c) => store.cardState(c.id).seen && store.isDue(store.cardState(c.id)));
  return [...due, ...unseen].slice(0, 3);
}

function renderHome() {
  const d = store.daily();
  const nDue = dueNotes().length;
  const last = S().games.filter((g) => g.points).slice(-1)[0];
  const items = [
    { done: d.notes > 0 || nDue === 0, t: "오답 복습", s: nDue ? `복습할 장면 ${nDue}개` : "지금 복습할 건 없어", btn: nDue ? "풀기" : null, go: () => startNotes(dueNotes()) },
    { done: d.cards >= 1, t: "오프닝 카드", s: `오늘 ${Math.min(d.cards, 3)}/3장`, btn: "카드", go: () => startCardQueue(dueCards()) },
    { done: d.game >= 1, t: "대국 한 판", s: "느리게, 두기 전에 세 가지 질문", btn: "대국", go: () => show("setup") },
    { done: d.rewind >= 1, t: "되감기 완주", s: last && !last.rewound ? "아직 안 되감은 판이 있어" : "대국이 끝나면 바로 이어져", btn: last && !last.rewound && serious(last.points).length ? "되감기" : null, go: () => startRewind(last) },
  ];
  $("today").innerHTML = items.map((x, i) => `<li class="${x.done ? "done" : ""}"><span class="ck">${x.done ? "✓" : ""}</span><span class="t">${x.t}<small>${esc(x.s)}</small></span>${x.btn ? `<button data-i="${i}">${x.btn}</button>` : ""}</li>`).join("");
  $("today").querySelectorAll("button").forEach((b) => (b.onclick = () => items[+b.dataset.i].go()));
  $("ladder").innerHTML = TIERS.map(tierRow).join("");
  $("ladder").querySelectorAll(".tier:not(.locked)").forEach((b) => (b.onclick = () => { S().settings.tier = +b.dataset.t; store.save(); show("setup"); }));

  const lose = store.streakLosses();
  coachTier = maxTier();
  if (lose >= 2) sayKey("tilt", "frust", { n: lose });
  else if (nDue) say(`오답 ${nDue}개 기다리고 있어. 그것부터 풀고 두자.`, "think");
  else say(line("hello", coachTier), "smile");
}

function tierRow(t) {
  const locked = !S().unlocked.includes(t.id);
  const res = store.lastResults(t.id);
  const dots = Array.from({ length: 5 }, (_, i) => `<i class="${res[i] || ""}"></i>`).join("");
  const sub = locked ? "앞 구간에서 최근 5판 중 3승" : t.stage === "baby" ? "애기 에이든" : "에이든";
  return `<button class="tier ${locked ? "locked" : ""} ${S().settings.tier === t.id ? "sel" : ""}" data-t="${t.id}">
    <img src="${faceSrc(t.stage, "smile")}" onerror="this.onerror=null;this.src='img/aiden/smile.webp'" alt="">
    <span class="t"><b>${t.id}</b><small>${sub}</small></span>${locked ? "🔒" : `<span class="dots">${dots}</span>`}</button>`;
}

/* =========================================================
   대국 설정
   ========================================================= */
function renderSetup() {
  const st = S().settings;
  if (!st.tier || !S().unlocked.includes(st.tier)) st.tier = maxTier();
  $("setupTiers").innerHTML = TIERS.map(tierRow).join("");
  $("setupTiers").querySelectorAll(".tier:not(.locked)").forEach((b) => (b.onclick = () => { st.tier = +b.dataset.t; store.save(); renderSetup(); }));
  const seg = (id, key) => $(id).querySelectorAll("button").forEach((b) => {
    b.classList.toggle("on", st[key] === b.dataset.v);
    b.onclick = () => { st[key] = b.dataset.v; store.save(); renderSetup(); };
  });
  seg("segColor", "color"); seg("segClock", "clock");
  $("optCheck").checked = !!st.check;
  $("optCheck").onchange = (e) => { st.check = e.target.checked; store.save(); };
  renderMaiaState();
  coachTier = st.tier;
  say(st.tier >= 1000 ? "1000부터는 나도 진지하게 둔다." : "애기라고 봐주면 안 돼!", "playful");
}
$("startGame").onclick = () => {
  const st = S().settings;
  const me = st.color === "r" ? (Math.random() < 0.5 ? "w" : "b") : st.color;
  startGame({ tier: st.tier, me, clock: st.clock, check: st.check });
};

/* =========================================================
   판 공통 상태 (P)
   ========================================================= */
let P = null;      // 지금 판의 상태
let board = null;
let token = 0;     // 판이 바뀌면 오래된 비동기 작업을 버리기 위한 번호

function openPlay(p) {
  token++;
  P = Object.assign({ token, game: new Chess(), busy: false, over: false }, p);
  document.body.classList.add("playing");
  VIEW = "play";
  document.querySelectorAll(".view").forEach((s) => s.classList.toggle("on", s.id === "v-play"));
  $("overlay").classList.remove("show");
  if (!board) {
    board = new Board($("board"), {
      getGame: () => P.game,
      canMove: () => !!P && !P.busy && !P.over && P.game.turn() === P.me,
      onMove: (uci) => onUserMove(uci),
      me: "w",
    });
  }
  board.o.me = P.me;
  board.sel = null; board.last = null; board.badge = null; board.hint = []; board.warn = null;
  coachTier = P.tier || coachTier;
  $("oppName").textContent = P.oppName || `에이든 ${P.tier}`;
  $("myName").textContent = "나";
  $("oppClock").textContent = ""; $("myClock").textContent = "";
  status("");
  board.draw();
}
const alive = (t) => P && P.token === t;
function status(html) { $("status").innerHTML = html; }
function actions(list) {
  const el = $("actions");
  el.innerHTML = "";
  for (const a of list) {
    const b = document.createElement("button");
    b.textContent = a.label;
    if (a.on) b.classList.add("on");
    if (a.disabled) b.disabled = true;
    b.onclick = a.fn;
    el.appendChild(b);
  }
}
function overlay(html, buttons) {
  const o = $("overlay");
  o.innerHTML = `<div class="card">${html}<div class="btns"></div></div>`;
  const box = o.querySelector(".btns");
  for (const b of buttons || []) {
    const e = document.createElement("button");
    e.textContent = b.label;
    if (b.primary) e.className = "primary";
    e.onclick = b.fn;
    box.appendChild(e);
  }
  o.classList.add("show");
}
const hideOverlay = () => $("overlay").classList.remove("show");

function applyUci(uci) {
  const m = P.game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" });
  board.last = uci.slice(0, 4);
  return m;
}

function onUserMove(uci) {
  if (!P) return;
  ({ game: userGameMove, rewind: userRewindMove, card: userCardMove, note: userNoteMove }[P.mode])(uci);
}

/* =========================================================
   대국
   ========================================================= */
function startGame({ tier, me, clock, check }) {
  const [base, inc] = clock === "none" ? [0, 0] : clock.split("+").map(Number);
  openPlay({ mode: "game", tier, me, check, clock: base ? { w: base * 60000, b: base * 60000, inc: inc * 1000, t0: 0 } : null, hist: [] });
  board.hint = [];
  sound(null);
  say(line("hello", tier), "smile", tier);
  gameActions();
  renderClocks();
  if (P.clock) tick(P.token);
  if (P.game.turn() !== me) botTurn();
}
function gameActions() {
  actions([
    { label: P.check ? "점검 켬" : "점검 끔", on: P.check, fn: () => { P.check = !P.check; gameActions(); } },
    { label: "기권", fn: () => { if (!P.over && confirm("기권할까?")) endGame("loss", "resign"); } },
  ]);
}

/* 시계 */
function fmt(ms) { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function renderClocks() {
  if (!P || !P.clock) { $("myClock").textContent = ""; $("oppClock").textContent = ""; return; }
  const c = P.clock, opp = P.me === "w" ? "b" : "w", turn = P.game.turn();
  const live = (side) => c[side] - (turn === side && c.t0 && !P.over ? Date.now() - c.t0 : 0);
  $("myClock").textContent = fmt(live(P.me)); $("oppClock").textContent = fmt(live(opp));
  $("myClock").className = "clock" + (turn === P.me && !P.over ? " run" : "") + (live(P.me) < 30000 ? " low" : "");
  $("oppClock").className = "clock" + (turn === opp && !P.over ? " run" : "");
}
function tick(t) {
  if (!alive(t) || P.over) return;
  const c = P.clock;
  if (c.t0) {
    const side = P.game.turn();
    if (c[side] - (Date.now() - c.t0) <= 0) { c[side] = 0; c.t0 = 0; endGame(side === P.me ? "loss" : "win", "time"); return; }
  }
  renderClocks();
  setTimeout(() => tick(t), 250);
}
function pressClock(side) {
  const c = P.clock; if (!c) return;
  if (c.t0) { c[side] -= Date.now() - c.t0; c[side] += c.inc; }
  c.t0 = P.hist.length >= 1 ? Date.now() : 0; // 첫 수 전에는 시계가 안 간다
  renderClocks();
}

function userGameMove(uci) {
  if (P.check && !P.confirmed) {
    const h = hangingAfter(P.game.fen(), uci);
    if (h) {
      board.warn = h.square; board.draw();
      say(h.mate ? line("mateHang", P.tier) : line("hang", P.tier, { p: PIECE_KO[h.piece] }), "surprise");
      overlay(`<h3>정말 둘 거야?</h3><p>${h.mate ? "한 수 메이트를 허용해." : `${PIECE_KO[h.piece]}가 걸려.`}</p>`, [
        { label: "다시 생각할래", primary: true, fn: () => { hideOverlay(); board.warn = null; board.draw(); say("좋아. 상대가 뭘 노리는지 다시 봐.", "smile"); } },
        { label: "그래도 둔다", fn: () => { hideOverlay(); board.warn = null; P.confirmed = true; userGameMove(uci); } },
      ]);
      return;
    }
  }
  P.confirmed = false;
  const m = applyUci(uci);
  P.hist.push(m.san);
  pressClock(P.me);
  sound(m);
  board.draw();
  if (m.captured) say(line("myCapture", P.tier), "frust");
  else if (m.san.includes("+")) say(line("checked", P.tier), "surprise");
  if (checkOver()) return;
  botTurn();
}

async function botTurn() {
  const t = P.token;
  P.busy = true;
  const started = Date.now();
  const r = (await botMove(analyse, P.game.fen(), P.tier, botOpts(P.hist)).catch(() => null)) || randomMove(P.game);
  if (!alive(t) || P.over) return;
  // 사람처럼 잠깐 생각하는 척 (낮은 구간은 빨리 둔다)
  const think = 350 + Math.random() * (P.tier >= 1000 ? 1400 : 900);
  await sleep(Math.max(0, think - (Date.now() - started)));
  if (!alive(t) || P.over) return;
  const m = applyUci(r.uci);
  P.hist.push(m.san);
  pressClock(P.me === "w" ? "b" : "w");
  sound(m);
  P.busy = false;
  board.draw();
  if (m.captured) say(line("botCapture", P.tier), "playful");
  else if (m.san.includes("+")) say(line("check", P.tier), "joy");
  else if (Math.random() < 0.18) say(["음…", "어디 보자.", "흐음."][Math.floor(Math.random() * 3)], "think");
  checkOver();
}

// 퍼즐에서 틀린 수 배지: 실수 기준에 못 미쳐도 정답이 아니면 최소 "?!"
const badKind = (k) => (k === "blunder" || k === "mistake" || k === "inaccuracy" ? k : "inaccuracy");

function randomMove(g) {
  const ms = g.moves({ verbose: true });
  const m = ms[Math.floor(Math.random() * ms.length)];
  return { uci: m.from + m.to + (m.promotion || ""), san: m.san };
}

function checkOver() {
  const g = P.game;
  if (!g.isGameOver()) return false;
  if (g.isCheckmate()) endGame(g.turn() === P.me ? "loss" : "win", "mate");
  else endGame("draw", g.isStalemate() ? "stalemate" : "draw");
  return true;
}

function endGame(result, why) {
  if (!P || P.over) return;
  P.over = true; P.busy = false;
  if (P.clock) P.clock.t0 = 0;
  renderClocks();
  const g = {
    id: Date.now().toString(36), date: Date.now(), tier: P.tier, me: P.me, result, why,
    sans: P.hist.slice(), points: null, rewound: false,
  };
  const unlocked = store.recordGame(g);
  store.bump("game");
  sound(null);
  say(line(result, P.tier), result === "win" ? "frust" : result === "loss" ? "joy" : "smile");
  const title = { win: "이겼다!", loss: "졌어", draw: "무승부" }[result];
  const sub = { mate: "체크메이트", resign: "기권", time: "시간 초과", stalemate: "스테일메이트", draw: "무승부" }[why];
  const unl = unlocked ? `<p>🔓 ${unlocked} 구간이 열렸어!</p>` : "";
  overlay(`<h3>${title}</h3><p>${sub}</p>${unl}<div class="progress"><i id="anaBar"></i></div><p id="anaTxt">판을 다시 보는 중…</p>`, []);
  actions([]);
  runAnalysis(g);
}

async function runAnalysis(g) {
  const t = P.token;
  let pts;
  try {
    pts = await analyseGame(analyse, g.sans, g.me, (x) => { const b = $("anaBar"); if (b && alive(t)) b.style.width = Math.round(x * 100) + "%"; });
  } catch (e) {
    if (alive(t)) overlay(`<h3>분석이 멈췄어</h3><p>엔진이 응답하지 않았어.</p>`, [
      { label: "다시 분석", primary: true, fn: () => { overlay(`<h3>다시 보는 중</h3><div class="progress"><i id="anaBar"></i></div>`, []); runAnalysis(g); } },
      { label: "도장으로", fn: () => show("home") },
    ]);
    return;
  }
  g.points = pts;
  store.save();
  // 실수 장면은 모두 오답노트로
  store.addNotes(serious(pts).map((p) => ({
    id: g.id + ":" + p.ply, gameId: g.id, fen: p.fen, played: p.played, playedUci: p.playedUci, best: p.best,
    tags: p.tags, kind: p.kind, tier: g.tier, box: 0, due: Date.now(), habit: 0,
  })));
  if (!alive(t)) return;
  const top = topThree(pts);
  const nInacc = pts.length - serious(pts).length;
  const list = top.length ? `<p>실수 ${serious(pts).length}개${nInacc ? ` · 부정확 ${nInacc}개` : ""}. 제일 컸던 것:<br>${top.map((p) => `${Math.floor(p.ply / 2) + 1}수 ${esc(p.played)} · ${p.tags.join(", ")}`).join("<br>")}</p>` : "<p>큰 실수 없이 뒀어. 대단한데?</p>";
  const btns = [];
  if (top.length) btns.push({ label: "되감기 시작", primary: true, fn: () => startRewind(g) });
  btns.push({ label: "한 판 더", primary: !top.length, fn: () => startGame({ tier: g.tier, me: g.me, clock: S().settings.clock, check: S().settings.check }) });
  btns.push({ label: "도장으로", fn: () => show("home") });
  const head = $("overlay").querySelector("h3").outerHTML + $("overlay").querySelector("p").outerHTML;
  overlay(head + list, btns);
}

/* =========================================================
   되감기: 실수 지점부터 다시 두고, 끝까지 이어서 둔다
   ========================================================= */
function startRewind(g) {
  const p0 = g && serious(g.points)[0];
  if (!p0) return;
  openPlay({ mode: "rewind", tier: g.tier, me: g.me, src: g, hist: g.sans.slice(0, p0.ply), fixed: 0, stops: 0 });
  P.game = new Chess();
  for (const s of P.hist) P.game.move(s);
  const prev = P.hist.length ? P.game.history({ verbose: true }).slice(-1)[0] : null;
  board.last = prev ? prev.from + prev.to : null;
  board.draw();
  setPuzzle({ played: p0.played, playedUci: p0.playedUci, noteId: g.id + ":" + p0.ply, first: true });
}

// 지금 국면을 "다시 찾기" 퍼즐로 만든다
async function setPuzzle(target) {
  const t = P.token;
  P.phase = "find"; P.target = target; P.tries = 0; P.busy = true;
  P.checkpoint = { hist: P.hist.slice() };
  board.hint = []; board.badge = null;
  rewindStatus();
  sayKey(target.first ? "rewind" : "liveStop", target.first ? "think" : "surprise");
  P.before = await evalPos(analyse, P.game.fen(), P.me);
  if (!alive(t)) return;
  P.busy = false;
  board.draw();
  rewindActions();
}
function rewindStatus() {
  status(P.phase === "find" ? `다시 찾기 · 고친 수 ${P.fixed}개` : `이어서 두는 중 · 고친 수 ${P.fixed}개`);
}
function rewindActions() {
  actions([
    { label: "힌트", disabled: P.phase !== "find", fn: () => { P.tries = Math.max(P.tries, 2); giveHint(); } },
    { label: "그만", fn: () => show("home") },
  ]);
}
function giveHint() {
  const b = P.before.best; if (!b) return;
  if (P.tries >= 3) { board.hint = [b.slice(0, 2), b.slice(2, 4)]; sayKey("reveal", "smile"); }
  else { board.hint = [b.slice(0, 2)]; sayKey("hint", "think"); }
  board.draw();
}

async function userRewindMove(uci) {
  const t = P.token;
  P.busy = true;
  const fen = P.game.fen();
  const before = P.before || (await evalPos(analyse, fen, P.me));
  const m = applyUci(uci);
  sound(m);
  board.hint = []; board.draw();
  const j = await judgeMove(analyse, before, P.game.fen(), P.me);
  if (!alive(t)) return;

  if (P.phase === "find") {
    const habit = P.target.playedUci && uci.slice(0, 4) === P.target.playedUci.slice(0, 4);
    const revealed = P.tries >= 3;
    const ok = revealed ? uci.slice(0, 4) === (before.best || "").slice(0, 4) || j.drop < SOLVE / 2 : j.drop < SOLVE && !habit;
    if (!ok) {
      P.tries++;
      board.badge = { sq: uci.slice(2, 4), kind: habit ? "habit" : badKind(j.kind) };
      board.draw();
      if (habit) { sayKey("habit", "playful"); markHabit(P.target.noteId); } else sayKey("wrong", "think");
      await sleep(1000);
      if (!alive(t)) return;
      P.game.undo(); board.badge = null;
      const prev = P.game.history({ verbose: true }).slice(-1)[0];
      board.last = prev ? prev.from + prev.to : null;
      P.busy = false;
      if (P.tries >= 2) giveHint(); else board.draw();
      return;
    }
    P.fixed++;
    board.badge = { sq: uci.slice(2, 4), kind: uci.slice(0, 4) === (before.best || "").slice(0, 4) ? "best" : "good" };
    sayKey("right", "joy");
    P.hist.push(m.san);
    P.phase = "play";
    rewindStatus(); rewindActions();
    board.draw();
    await sleep(600);
    if (!alive(t)) return;
    return rewindBot();
  }

  // 이어 두는 중: 크게 기우는 수를 두면 그 자리에서 멈추고 다시 찾기
  if (j.kind === "mistake" || j.kind === "blunder") {
    board.badge = { sq: uci.slice(2, 4), kind: j.kind };
    board.draw();
    P.stops++;
    store.addNotes([{
      id: P.src.id + ":r" + P.hist.length + ":" + Date.now().toString(36), gameId: P.src.id, fen, played: m.san, playedUci: uci, best: before.best,
      tags: ["되감기 중"], kind: j.kind, tier: P.tier, box: 0, due: Date.now(), habit: 0,
    }]);
    await sleep(900);
    if (!alive(t)) return;
    P.game.undo(); board.badge = null;
    const prev = P.game.history({ verbose: true }).slice(-1)[0];
    board.last = prev ? prev.from + prev.to : null;
    P.before = before;
    return setPuzzle({ played: m.san, playedUci: uci, noteId: null });
  }
  P.hist.push(m.san);
  if (rewindOver()) return;
  rewindBot();
}

async function rewindBot() {
  const t = P.token;
  P.busy = true;
  board.badge = null;
  const r = (await botMove(analyse, P.game.fen(), P.tier, botOpts(P.hist)).catch(() => null)) || randomMove(P.game);
  if (!alive(t)) return;
  await sleep(350);
  if (!alive(t)) return;
  const m = applyUci(r.uci);
  P.hist.push(m.san);
  sound(m);
  board.draw();
  if (m.captured) say(line("botCapture", P.tier), "playful");
  if (rewindOver()) return;
  // 내 차례: 판정 기준이 될 평가를 미리 계산
  P.before = null;
  const fen = P.game.fen();
  evalPos(analyse, fen, P.me).then((b) => { if (alive(t) && P.game.fen() === fen) P.before = b; });
  P.busy = false;
  board.draw();
}

function rewindOver() {
  const g = P.game;
  if (!g.isGameOver()) return false;
  P.over = true; P.busy = false;
  const lost = g.isCheckmate() && g.turn() === P.me;
  if (!lost) {
    P.src.rewound = true; store.save(); store.bump("rewind");
    sayKey("complete", "joy");
    overlay(`<h3>완주!</h3><p>${g.isCheckmate() ? "체크메이트로 끝냈어." : "비김으로 지켜 냈어."} 고친 수 ${P.fixed}개.</p>`, [
      { label: "도장으로", primary: true, fn: () => show("home") },
      { label: "오답 복습", fn: () => startNotes(dueNotes()) },
    ]);
  } else {
    say("이번엔 버티지 못했어. 마지막으로 고친 곳부터 다시 해 보자.", "think");
    overlay(`<h3>아깝다</h3><p>조금씩 밀리다가 졌어.</p>`, [
      { label: "마지막 지점부터", primary: true, fn: () => retryFromCheckpoint() },
      { label: "도장으로", fn: () => show("home") },
    ]);
  }
  return true;
}
function retryFromCheckpoint() {
  hideOverlay();
  const cp = P.checkpoint;
  P.over = false;
  P.game = new Chess();
  for (const s of cp.hist) P.game.move(s);
  P.hist = cp.hist.slice();
  const prev = P.game.history({ verbose: true }).slice(-1)[0];
  board.last = prev ? prev.from + prev.to : null;
  board.draw();
  setPuzzle({ played: null, playedUci: P.target.playedUci, noteId: P.target.noteId });
}
function markHabit(noteId) {
  const n = noteId && S().notes.find((x) => x.id === noteId);
  if (n) { n.habit = (n.habit || 0) + 1; store.save(); }
}

/* =========================================================
   오답노트 복습: 한 장면씩, 좋은 수를 찾으면 정답
   ========================================================= */
let noteQueue = [];
function startNotes(list) {
  noteQueue = list.slice(0, 10);
  if (!noteQueue.length) { show("notes"); return; }
  nextNote();
}
async function nextNote() {
  const n = noteQueue.shift();
  if (!n) { show("home"); return; }
  const g = new Chess(n.fen);
  openPlay({ mode: "note", tier: n.tier, me: g.turn(), note: n, tries: 0, oppName: "오답노트" });
  P.game = g;
  board.draw();
  const left = noteQueue.length;
  status(`${n.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join(" ")} ${n.habit ? '<span class="tag habit">손버릇</span>' : ""} · 남은 장면 ${left}`);
  say(n.habit ? "손버릇 장면이야. 손이 먼저 나가지 않게!" : "이 장면에서 실수했었어. 더 좋은 수를 찾아봐.", "think");
  actions([{ label: "힌트", fn: () => { P.tries = Math.max(P.tries, 2); noteHint(); } }, { label: "건너뛰기", fn: () => nextNote() }]);
  const t = P.token;
  P.busy = true;
  P.before = await evalPos(analyse, n.fen, P.me);
  if (alive(t)) { P.busy = false; board.draw(); }
}
function noteHint() {
  const b = P.before && P.before.best; if (!b) return;
  board.hint = P.tries >= 3 ? [b.slice(0, 2), b.slice(2, 4)] : [b.slice(0, 2)];
  say(P.tries >= 3 ? "정답은 이 칸으로! 직접 둬 봐." : "표시한 기물을 봐.", "smile");
  board.draw();
}
async function userNoteMove(uci) {
  const t = P.token, n = P.note;
  P.busy = true;
  const m = applyUci(uci);
  sound(m); board.hint = []; board.draw();
  const j = await judgeMove(analyse, P.before, P.game.fen(), P.me);
  if (!alive(t)) return;
  const habit = uci.slice(0, 4) === (n.playedUci || "").slice(0, 4);
  const best = uci.slice(0, 4) === (P.before.best || "").slice(0, 4);
  if (j.drop < SOLVE && !habit) {
    board.badge = { sq: uci.slice(2, 4), kind: best ? "best" : "good" }; board.draw();
    const clean = P.tries === 0;
    store.schedule(n, clean);
    if (clean) n.solved = (n.solved || 0) + 1;
    store.save(); store.bump("notes");
    say(clean ? "한 번에 찾았다! 다음 장면." : "찾았어. 이 장면은 금방 또 나올 거야.", "joy");
    await sleep(1100);
    if (alive(t)) nextNote();
    return;
  }
  P.tries++;
  board.badge = { sq: uci.slice(2, 4), kind: habit ? "habit" : badKind(j.kind) };
  board.draw();
  if (habit) { n.habit = (n.habit || 0) + 1; store.save(); sayKey("habit", "playful"); } else sayKey("wrong", "think");
  await sleep(1000);
  if (!alive(t)) return;
  P.game.undo(); board.badge = null; P.busy = false;
  if (P.tries >= 2) noteHint(); else board.draw();
}

/* =========================================================
   오프닝 카드
   ========================================================= */
let cardQueue = [];
function startCardQueue(list) {
  cardQueue = list.slice();
  if (!cardQueue.length) { show("cards"); return; }
  nextCard();
}
function nextCard() {
  const c = cardQueue.shift();
  if (!c) { show("cards"); return; }
  startCard(c);
}
function startCard(card) {
  openPlay({ mode: "card", tier: maxTier(), me: card.me, card, step: 0, wrong: 0, stepWrong: 0, oppName: card.title });
  status(`${esc(card.goal)}${card.trap ? ' <span class="tag trap">함정</span>' : ""}`);
  say(line("card", P.tier) + " " + card.title, "smile");
  actions([{ label: "처음부터", fn: () => startCard(card) }, { label: "그만", fn: () => show("cards") }]);
  cardAdvance();
}
async function cardAdvance() {
  const t = P.token, ms = cardMoves(P.card);
  while (alive(t) && P.step < ms.length && P.game.turn() !== P.me) {
    P.busy = true;
    await sleep(450);
    if (!alive(t)) return;
    const m = P.game.move(ms[P.step]);
    board.last = m.from + m.to; P.step++;
    sound(m); board.draw();
  }
  if (!alive(t)) return;
  P.busy = false;
  if (P.step >= ms.length) return cardDone();
  board.draw();
}
async function userCardMove(uci) {
  const t = P.token, ms = cardMoves(P.card);
  const expect = new Chess(P.game.fen()).move(ms[P.step]);
  const okUci = expect.from + expect.to;
  P.busy = true;
  const m = applyUci(uci);
  sound(m);
  if (uci.slice(0, 4) === okUci) {
    board.badge = { sq: m.to, kind: "good" }; board.hint = [];
    const w = whyFor(P.card, P.step);
    if (w) say(w, "smile");
    P.step++; P.stepWrong = 0;
    board.draw();
    await sleep(500);
    if (!alive(t)) return;
    board.badge = null;
    return cardAdvance();
  }
  P.wrong++; P.stepWrong++;
  board.badge = { sq: m.to, kind: "mistake" }; board.draw();
  say(line("cardWrong", P.tier, { w: whyFor(P.card, P.step) || "카드 수순이랑 달라." }), "think");
  await sleep(1100);
  if (!alive(t)) return;
  P.game.undo(); board.badge = null;
  const prev = P.game.history({ verbose: true }).slice(-1)[0];
  board.last = prev ? prev.from + prev.to : null;
  if (P.stepWrong >= 2) board.hint = [expect.from, expect.to];
  P.busy = false;
  board.draw();
}
function cardDone() {
  const st = store.cardState(P.card.id);
  st.seen++;
  if (!P.wrong) st.clean++;
  store.schedule(st, P.wrong === 0);
  store.save(); store.bump("cards");
  P.over = true;
  say(`${line("cardDone", P.tier)} ${P.card.goal}`, "joy");
  const more = cardQueue.length;
  overlay(`<h3>${esc(P.card.title)}</h3><p>${P.wrong ? `틀린 수 ${P.wrong}개. 금방 또 나와.` : "한 번도 안 틀렸어!"}</p>`, [
    more ? { label: `다음 카드 (${more})`, primary: true, fn: () => nextCard() } : { label: "카드 목록", primary: true, fn: () => show("cards") },
    { label: "한 번 더", fn: () => startCard(P.card) },
  ]);
}

function renderCards() {
  coachTier = maxTier();
  say("수순 외우기보다 왜 그 수인지! 틀리면 이유를 알려 줄게.", "smile");
  $("dueCards").textContent = `오늘의 카드 (${dueCards().length})`;
  $("dueCards").onclick = () => startCardQueue(dueCards());
  $("cardGroups").innerHTML = GROUPS.map((gr) => `<div class="group"><h2>${gr.title}</h2><div class="cardgrid">${CARDS.filter((c) => c.group === gr.id).map((c) => {
    const st = store.cardState(c.id);
    const due = st.seen && store.isDue(st);
    const lv = Array.from({ length: 5 }, (_, i) => `<i class="${i < st.box ? "on" : ""}"></i>`).join("");
    return `<button class="ocard" data-id="${c.id}"><b>${esc(c.title)}</b><small>${esc(c.goal)}</small><span class="meta"><span class="lv">${lv}</span><span>${c.trap ? '<span class="tag trap">함정</span> ' : ""}${due ? '<span class="tag due">복습</span>' : !st.seen ? '<span class="tag">새 카드</span>' : ""}</span></span></button>`;
  }).join("")}</div></div>`).join("");
  $("cardGroups").querySelectorAll(".ocard").forEach((b) => (b.onclick = () => { cardQueue = []; startCard(CARDS.find((c) => c.id === b.dataset.id)); }));
}

/* =========================================================
   오답노트 목록
   ========================================================= */
let noteFilter = "전체";
function renderNotes() {
  coachTier = maxTier();
  const all = S().notes;
  const tags = ["전체", "복습", "손버릇", ...new Set(all.flatMap((n) => n.tags))];
  if (!tags.includes(noteFilter)) noteFilter = "전체";
  $("noteFilters").innerHTML = tags.map((x) => `<button class="${x === noteFilter ? "on" : ""}">${esc(x)}</button>`).join("");
  $("noteFilters").querySelectorAll("button").forEach((b) => (b.onclick = () => { noteFilter = b.textContent; renderNotes(); }));
  const list = all.filter((n) => noteFilter === "전체" || (noteFilter === "복습" ? store.isDue(n) : noteFilter === "손버릇" ? n.habit : n.tags.includes(noteFilter))).slice().reverse();
  const due = dueNotes();
  $("dueNotes").textContent = due.length ? `복습 시작 (${due.length})` : "복습할 장면 없음";
  $("dueNotes").disabled = !due.length;
  $("dueNotes").onclick = () => startNotes(dueNotes());
  $("noteList").innerHTML = list.length ? list.map((n) => `<div class="note"><span class="res ${n.kind === "blunder" ? "loss" : "draw"}">${n.kind === "blunder" ? "??" : "?"}</span><span class="t">${esc(n.played)} 대신 다른 수 <small>${n.tags.map(esc).join(" · ")} · ${n.tier}${n.habit ? " · 손버릇" : ""}</small></span><button data-id="${n.id}">풀기</button></div>`).join("")
    : `<div class="empty">아직 오답이 없어. 한 판 두고 오면 여기 쌓여.</div>`;
  $("noteList").querySelectorAll("button").forEach((b) => (b.onclick = () => startNotes([all.find((n) => n.id === b.dataset.id)])));
  say(due.length ? `복습할 장면 ${due.length}개. 하루에 조금씩!` : "틀린 장면은 여기 모여. 시간이 지나면 다시 나와.", "think");
}

/* =========================================================
   일지
   ========================================================= */
function renderLog() {
  coachTier = maxTier();
  const games = S().games.slice().reverse();
  const counts = {};
  let inacc = 0;
  for (const g of S().games) for (const p of g.points || []) {
    if (p.kind === "inaccuracy") { inacc++; continue; }
    for (const tg of p.tags) counts[tg] = (counts[tg] || 0) + 1;
  }
  const habits = S().notes.filter((n) => n.habit).length;
  if (habits) counts["손버릇"] = habits;
  const ent = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (inacc) ent.push(["부정확(기록만)", inacc]);
  const max = Math.max(1, ...ent.map((e) => e[1]));
  $("tagBars").innerHTML = ent.length ? ent.map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><span class="b"><i style="width:${(100 * v) / max}%"></i></span><span>${v}</span></div>`).join("") : `<div class="empty">판을 두면 실수 유형이 쌓여.</div>`;
  $("gameList").innerHTML = games.length ? games.slice(0, 30).map((g) => {
    const top = g.points ? topThree(g.points) : [];
    const r = { win: "승", loss: "패", draw: "무" }[g.result];
    const d = new Date(g.date);
    return `<div class="game"><span class="res ${g.result}">${r}</span><span class="t">에이든 ${g.tier} · ${g.me === "w" ? "백" : "흑"} · ${Math.ceil(g.sans.length / 2)}수<small>${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}${g.rewound ? " · 되감기 완주" : ""}</small>${top.length ? `<div class="mist">${top.map((p) => `${Math.floor(p.ply / 2) + 1}수 ${esc(p.played)} (${p.tags.join(", ")})`).join(" / ")}</div>` : ""}</span>${serious(g.points).length ? `<button data-id="${g.id}">되감기</button>` : ""}</div>`;
  }).join("") : `<div class="empty">아직 둔 판이 없어.</div>`;
  $("gameList").querySelectorAll("button").forEach((b) => (b.onclick = () => startRewind(S().games.find((g) => g.id === b.dataset.id))));
  const top = ent[0];
  say(top ? `제일 많은 건 "${top[0]}". 거기부터 잡자.` : "판을 두면 여기 기록이 쌓여.", "think");
}
$("exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(S())], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `chess-train-${store.today()}.json`;
  a.click();
};
$("importFile").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.games)) throw 0;
    localStorage.setItem("chess-train:v1", JSON.stringify(d));
    location.reload();
  } catch (_) { alert("백업 파일을 읽을 수 없어."); }
};

window.addEventListener("beforeunload", (e) => {
  if (P && P.mode === "game" && !P.over && P.hist.length) { e.preventDefault(); e.returnValue = ""; }
});

/* ---------- 시작 ---------- */
show("home");

// 테스트용: 지금 판 상태 엿보기
window.__ct = { P: () => P, maia: () => maiaState };
