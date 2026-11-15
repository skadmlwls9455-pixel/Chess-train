// 폐관 수련 도장 — 화면 흐름
import { Chess } from "../vendor/chess.js";
import { Engine } from "./engine.js";
import { Board } from "./board.js";
import { TIERS, tierOf, botMove } from "./bots.js";
import { CARDS, GROUPS, cardMoves, whyFor } from "./cards.js";
import { evalPos, judgeMove, analyseGame, topThree, serious, hangingAfter, SOLVE, PIECE_KO, iGa } from "./review.js";
import { faceSrc, onFaceError, line } from "./coach.js";
import * as store from "./store.js";
import { Maia } from "./maia.js";
import { icon } from "./icons.js";
import { PIECE } from "./pieces.js";
const kingImg = (c, size = 22) => `<img class="kimg" src="${PIECE[c + "k"]}" width="${size}" height="${size}" alt="">`;

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
document.querySelectorAll("#tabs button").forEach((b) => { b.insertAdjacentHTML("afterbegin", icon(b.dataset.i, 22)); b.onclick = () => show(b.dataset.v); });

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

const TIPS = [
  "두기 전에 세 가지만 확인해. 상대가 노리는 것, 내 계획, 이 수 다음 상대의 응수.",
  "퀸은 나이트와 비숍 다음에 꺼내고, 캐슬링은 일찍 해.",
  "진 판은 되감기로 끝까지 다시 둬 보자.",
  "2연패하면 판보다 카드와 오답을 먼저 풀자.",
];
function renderHome() {
  const d = store.daily();
  const nDue = dueNotes().length;
  const nCards = dueCards().length;
  const last = S().games.filter((g) => g.points).slice(-1)[0];
  const canRewind = last && !last.rewound && serious(last.points).length;
  const items = [
    { k: "notes", t: "오답", done: d.notes > 0 || nDue === 0, n: nDue, go: () => startNotes(dueNotes()) },
    { k: "cards", t: "카드", done: d.cards >= 3 || !nCards, n: Math.max(0, Math.min(3, nCards) - d.cards), go: () => startCardQueue(dueCards()) },
    { k: "play", t: "대국", done: d.game >= 1, n: 0, go: () => show("setup") },
    { k: "rewind", t: "되감기", done: d.rewind >= 1, n: canRewind ? 1 : 0, go: () => (canRewind ? startRewind(last) : show("setup")) },
  ];
  const done = items.filter((x) => x.done).length;
  $("today").innerHTML = `<div class="prog"><b>오늘</b><span class="pbar"><i style="width:${(done / 4) * 100}%"></i></span><span>${done}/4</span></div>
    <div class="tiles">${items.map((x, i) => `<button class="tile ${x.done ? "done" : ""}" data-i="${i}">${icon(x.k === "rewind" ? "rewind" : x.k, 24)}<span>${x.t}</span>${x.done ? `<em class="ok">${icon("check", 14)}</em>` : x.n ? `<em>${x.n}</em>` : ""}</button>`).join("")}</div>`;
  $("today").querySelectorAll(".tile").forEach((b) => (b.onclick = () => items[+b.dataset.i].go()));
  const next = items.find((x) => !x.done) || items[2];
  $("nextBtn").innerHTML = `${icon(next.k === "rewind" ? "rewind" : next.k, 22)} ${next.t}${next.n ? ` ${next.n}` : ""}`;
  $("nextBtn").onclick = next.go;
  $("ladder").innerHTML = TIERS.map(tierRow).join("");
  bindTiers($("ladder"), (id) => { S().settings.tier = id; store.save(); show("setup"); });

  const lose = store.streakLosses();
  coachTier = maxTier();
  if (lose >= 2) sayKey("tilt", "frust", { n: lose });
  else if (nDue) say(`오답 ${nDue}개가 남아 있어. 먼저 풀어 보자.`, "think");
  else say(Math.random() < 0.5 ? TIPS[Math.floor(Math.random() * TIPS.length)] : line("hello", coachTier), "smile");
}

function tierRow(t) {
  const locked = !S().unlocked.includes(t.id);
  const res = store.lastResults(t.id);
  const dots = Array.from({ length: 5 }, (_, i) => `<i class="${res[i] || ""}"></i>`).join("");
  return `<button class="tier ${locked ? "locked" : ""} ${S().settings.tier === t.id ? "sel" : ""}" data-t="${t.id}">
    <img src="${faceSrc(t.stage, "smile")}" onerror="this.onerror=null;this.src='img/aiden/smile.webp'" alt="">
    <b>${t.id}</b>${locked ? `<span class="lk">${icon("lock", 18)}</span>` : `<span class="dots">${dots}</span>`}</button>`;
}
function bindTiers(root, pick) {
  root.querySelectorAll(".tier").forEach((b) => (b.onclick = () => {
    if (b.classList.contains("locked")) { say("앞 구간에서 최근 5판 중 3승이면 열려.", "playful"); return; }
    pick(+b.dataset.t);
  }));
}

/* =========================================================
   대국 설정
   ========================================================= */
function renderSetup() {
  const st = S().settings;
  if (!st.tier || !S().unlocked.includes(st.tier)) st.tier = maxTier();
  $("setupTiers").innerHTML = TIERS.map(tierRow).join("");
  bindTiers($("setupTiers"), (id) => { st.tier = id; store.save(); renderSetup(); });
  const seg = (id, key, opts) => {
    $(id).innerHTML = opts.map(([v, h]) => `<button data-v="${v}" class="${st[key] === v ? "on" : ""}">${h}</button>`).join("");
    $(id).querySelectorAll("button").forEach((b) => (b.onclick = () => { st[key] = b.dataset.v; store.save(); renderSetup(); }));
  };
  seg("segColor", "color", [["w", `${kingImg("w")} 백`], ["b", `${kingImg("b")} 흑`], ["r", icon("dice", 20)]]);
  seg("segClock", "clock", [["none", icon("infinity", 22)], ["10+5", "10+5"], ["15+10", "15+10"]]);
  $("checkLbl").innerHTML = `${icon("shield", 20)} 점검`;
  $("checkInfo").innerHTML = icon("info", 20);
  $("checkInfo").onclick = () => say("점검을 켜면 기물이 공짜로 잡히거나 바로 메이트당하는 수를 두기 전에 한 번 확인해.", "think");
  $("optCheck").checked = !!st.check;
  $("optCheck").onchange = (e) => { st.check = e.target.checked; store.save(); };
  coachTier = st.tier;
  say("상대와 시간을 고르고 시작해.", "smile");
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
    b.innerHTML = `${a.icon ? icon(a.icon, 22) : ""}<span>${a.label}</span>`;
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
    { icon: "shield", label: "점검", on: P.check, fn: () => { P.check = !P.check; gameActions(); say(P.check ? "점검 켰어." : "점검 껐어.", "smile"); } },
    { icon: "flag", label: "기권", fn: () => { if (!P.over && confirm("기권할까?")) endGame("loss", "resign"); } },
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
      say(h.mate ? line("mateHang", P.tier) : line("hang", P.tier, { p: iGa(PIECE_KO[h.piece]) }), "surprise");
      overlay(`<h3>이 수를 둘까?</h3><p>${h.mate ? "바로 메이트당해." : `${iGa(PIECE_KO[h.piece])} 잡혀.`}</p>`, [
        { label: "다시 생각하기", primary: true, fn: () => { hideOverlay(); board.warn = null; board.draw(); say("상대가 뭘 노리는지 한 번 더 봐.", "smile"); } },
        { label: "그대로 두기", fn: () => { hideOverlay(); board.warn = null; P.confirmed = true; userGameMove(uci); } },
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
  const title = { win: "승리", loss: "패배", draw: "무승부" }[result];
  const sub = { mate: "체크메이트", resign: "기권", time: "시간 초과", stalemate: "스테일메이트", draw: "무승부" }[why];
  const unl = unlocked ? `<p>${icon("lock", 16)} ${unlocked} 구간 열림</p>` : "";
  overlay(`<h3>${title}</h3><p>${sub}</p>${unl}<div class="progress"><i id="anaBar"></i></div>`, []);
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
  const list = top.length ? `<p class="mlist">${top.map((p) => `<span class="kind ${p.kind}">${p.kind === "blunder" ? "??" : "?"}</span> <b>${esc(p.played)}</b> ${esc(p.tags[0])}`).join("<br>")}</p>` : "<p>큰 실수 없이 뒀어.</p>";
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
  status(`<span class="chip">${icon(P.phase === "find" ? "target" : "rewind", 14)} ${P.fixed}</span>`);
}
function rewindActions() {
  actions([
    { icon: "bulb", label: "힌트", disabled: P.phase !== "find", fn: () => { P.tries = Math.max(P.tries, 2); giveHint(); } },
    { icon: "close", label: "그만", fn: () => show("home") },
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
    overlay(`<h3>완주</h3><p>${g.isCheckmate() ? "체크메이트로 끝냈어." : "비김으로 지켜 냈어."} 고친 수 ${P.fixed}개.</p>`, [
      { label: "도장으로", primary: true, fn: () => show("home") },
      { label: "오답 복습", fn: () => startNotes(dueNotes()) },
    ]);
  } else {
    say("이번엔 졌어. 마지막으로 고친 곳부터 다시 해 보자.", "think");
    overlay(`<h3>패배</h3>`, [
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
  status(`<span class="chip">${esc(n.tags[0] || "")}</span>${n.habit ? '<span class="chip habit">손버릇</span>' : ""}${left ? `<span class="chip">+${left}</span>` : ""}`);
  say(n.habit ? "전에 같은 수를 반복했던 장면이야." : "이 장면에서 실수했었어. 더 나은 수를 찾아봐.", "think");
  actions([{ icon: "bulb", label: "힌트", fn: () => { P.tries = Math.max(P.tries, 2); noteHint(); } }, { icon: "skip", label: "넘기기", fn: () => nextNote() }, { icon: "close", label: "그만", fn: () => show("notes") }]);
  const t = P.token;
  P.busy = true;
  P.before = await evalPos(analyse, n.fen, P.me);
  if (alive(t)) { P.busy = false; board.draw(); }
}
function noteHint() {
  const b = P.before && P.before.best; if (!b) return;
  board.hint = P.tries >= 3 ? [b.slice(0, 2), b.slice(2, 4)] : [b.slice(0, 2)];
  say(P.tries >= 3 ? "정답은 표시한 칸이야. 직접 둬 봐." : "표시한 기물을 움직여 봐.", "smile");
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
    say(clean ? "한 번에 찾았어." : "찾았어. 이 장면은 곧 다시 나올 거야.", "joy");
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
  status(card.trap ? `<span class="chip trap">${icon("bolt", 14)} 함정</span>` : "");
  say(card.goal, "smile");
  actions([{ icon: "restart", label: "처음", fn: () => startCard(card) }, { icon: "close", label: "그만", fn: () => show("cards") }]);
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
  say(line("cardDone", P.tier), "joy");
  const more = cardQueue.length;
  overlay(`<h3>${esc(P.card.title)}</h3><p>${P.wrong ? `틀린 수 ${P.wrong}` : "다 맞혔어."}</p>`, [
    more ? { label: `다음 카드 (${more})`, primary: true, fn: () => nextCard() } : { label: "카드 목록", primary: true, fn: () => show("cards") },
    { label: "한 번 더", fn: () => startCard(P.card) },
  ]);
}

const GROUP_SHORT = { w: "백 · 이탈리안", be4: "흑 · 1.e4", bd4: "흑 · 1.d4" };
function renderCards() {
  coachTier = maxTier();
  say("틀리면 그 수를 두는 이유를 알려 줄게.", "smile");
  const due = dueCards().length;
  $("dueCards").innerHTML = `${icon("cards", 22)} 오늘의 카드${due ? ` ${due}` : ""}`;
  $("dueCards").disabled = !due;
  $("dueCards").onclick = () => startCardQueue(dueCards());
  $("cardGroups").innerHTML = GROUPS.map((gr) => `<h2>${GROUP_SHORT[gr.id] || gr.title}</h2><div class="cardgrid">${CARDS.filter((c) => c.group === gr.id).map((c) => {
    const st = store.cardState(c.id);
    const due = st.seen && store.isDue(st);
    const lv = Array.from({ length: 5 }, (_, i) => `<i class="${i < st.box ? "on" : ""}"></i>`).join("");
    const mark = due ? '<span class="mark due"></span>' : c.trap ? `<span class="mark trap">${icon("bolt", 14)}</span>` : "";
    return `<button class="ocard" data-id="${c.id}">${mark}<b>${esc(c.title)}</b><span class="lv">${lv}</span></button>`;
  }).join("")}</div>`).join("");
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
  $("noteFilters").innerHTML = all.length ? tags.map((x) => `<button class="${x === noteFilter ? "on" : ""}">${esc(x)}</button>`).join("") : "";
  $("noteFilters").querySelectorAll("button").forEach((b) => (b.onclick = () => { noteFilter = b.textContent; renderNotes(); }));
  const list = all.filter((n) => noteFilter === "전체" || (noteFilter === "복습" ? store.isDue(n) : noteFilter === "손버릇" ? n.habit : n.tags.includes(noteFilter))).slice().reverse();
  const due = dueNotes();
  $("dueNotes").innerHTML = `${icon("notes", 22)} 복습${due.length ? ` ${due.length}` : ""}`;
  $("dueNotes").disabled = !due.length;
  $("dueNotes").onclick = () => startNotes(dueNotes());
  $("noteList").innerHTML = list.length ? list.map((n) => `<button class="row" data-id="${n.id}"><span class="kind ${n.kind}">${n.kind === "blunder" ? "??" : "?"}</span><b class="san">${esc(n.played)}</b><span class="chip">${esc(n.tags[0] || "")}</span>${n.habit ? '<span class="chip habit">손버릇</span>' : ""}<span class="sp"></span>${icon("chevron", 18)}</button>`).join("")
    : `<div class="empty">${icon("check", 32)}<span>오답 없음</span></div>`;
  $("noteList").querySelectorAll(".row").forEach((b) => (b.onclick = () => startNotes([all.find((n) => n.id === b.dataset.id)])));
  say(due.length ? `복습할 장면이 ${due.length}개 있어.` : "틀린 장면은 여기 모이고, 때가 되면 다시 나와.", "think");
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
  if (inacc) ent.push(["부정확", inacc]);
  const max = Math.max(1, ...ent.map((e) => e[1]));
  const wins = S().games.filter((g) => g.result === "win").length;
  const rew = S().games.filter((g) => g.rewound).length;
  $("stats").innerHTML = [["판", S().games.length], ["승", wins], ["완주", rew]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join("");
  $("tagBars").innerHTML = ent.length ? ent.map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><span class="b"><i style="width:${(100 * v) / max}%"></i></span><b>${v}</b></div>`).join("") : "";
  $("gameList").innerHTML = games.length ? games.slice(0, 30).map((g) => {
    const r = { win: "승", loss: "패", draw: "무" }[g.result];
    const n = serious(g.points).length;
    const t = tierOf(g.tier);
    return `<button class="row ${n ? "" : "static"}" data-id="${g.id}"><span class="res ${g.result}">${r}</span><img src="${faceSrc(t.stage, "smile")}" onerror="this.onerror=null;this.src='img/aiden/smile.webp'" alt=""><b>${g.tier}</b>${kingImg(g.me, 20)}${g.rewound ? `<span class="chip ok">${icon("check", 12)}</span>` : ""}<span class="sp"></span>${n ? `<span class="kind blunder">${n}</span>${icon("rewind", 18)}` : ""}</button>`;
  }).join("") : `<div class="empty">${icon("log", 32)}<span>아직 둔 판 없음</span></div>`;
  $("gameList").querySelectorAll(".row:not(.static)").forEach((b) => (b.onclick = () => startRewind(S().games.find((g) => g.id === b.dataset.id))));
  $("exportBtn").innerHTML = `${icon("download", 16)} 백업`;
  $("importLbl").innerHTML = `${icon("upload", 16)} 불러오기`;
  const top = ent[0];
  say(top ? `가장 많은 실수는 "${top[0]}"이야.` : "판을 두면 여기에 기록이 쌓여.", "think");
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

/* ---------- 앱 설치(홈 화면) + 저장소 보존 요청 ---------- */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
// 브라우저가 공간이 부족할 때 기록을 지우지 않도록 요청 (설치된 앱이면 대개 허용됨)
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- 시작 ---------- */
show("home");

// 테스트용: 지금 판 상태 엿보기
window.__ct = { P: () => P, maia: () => maiaState };
