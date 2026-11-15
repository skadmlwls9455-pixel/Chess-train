// 보드 UI: 탭 두 번 / 드래그로 두기, 합법수 점, 승진 선택, 배지(??, ?, ✓, ★), 힌트 칸.
// (체스 오답노트의 보드 코드를 컴포넌트로 옮긴 것)
import { PIECE } from "./pieces.js";

const FILES = "abcdefgh";

export class Board {
  // opts: { getGame(), me: 'w'|'b', canMove(): bool, onMove(uci) }
  constructor(el, opts) {
    this.el = el;
    this.o = opts;
    this.sel = null;
    this.last = null;
    this.badge = null;   // {sq, kind:'blunder'|'mistake'|'good'|'best'|'habit'}
    this.hint = [];
    this.warn = null;    // 점검 모드 경고 칸
    this.drag = null;
    this.bind();
  }
  get me() { return this.o.me; }
  sqName(r, f) { const flip = this.me === "b"; return (flip ? FILES[7 - f] : FILES[f]) + (flip ? r + 1 : 8 - r); }
  sqEl(sq) { return this.el.querySelector(`.sq[data-sq="${sq}"]`); }

  draw() {
    const g = this.o.getGame();
    const el = this.el;
    el.innerHTML = "";
    const legal = this.sel ? g.moves({ square: this.sel, verbose: true }) : [];
    const targets = {};
    legal.forEach((m) => (targets[m.to] = m.captured || m.flags.includes("e") ? "cap" : "dot"));
    const inCheck = g.inCheck() ? g.turn() : null;
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = this.sqName(r, f);
      const fi = FILES.indexOf(sq[0]), rk = +sq[1];
      const d = document.createElement("div");
      d.className = "sq " + ((fi + rk) % 2 === 1 ? "l" : "d");
      d.dataset.sq = sq;
      if ((this.last && (this.last.slice(0, 2) === sq || this.last.slice(2, 4) === sq)) || this.sel === sq) d.classList.add("hl");
      if (this.hint.includes(sq)) d.classList.add("hint");
      if (this.warn === sq) d.classList.add("warn");
      if (targets[sq]) d.classList.add(targets[sq]);
      if (f === 0) { const c = document.createElement("span"); c.className = "coord r"; c.textContent = rk; d.appendChild(c); }
      if (r === 7) { const c = document.createElement("span"); c.className = "coord f"; c.textContent = sq[0]; d.appendChild(c); }
      const pc = g.get(sq);
      if (pc) {
        if (pc.type === "k" && pc.color === inCheck) d.classList.add("check");
        const s = document.createElement("div");
        s.className = "pc" + (pc.color === this.me ? " mine" : "");
        s.style.backgroundImage = `url("${PIECE[pc.color + pc.type]}")`;
        d.appendChild(s);
      }
      if (this.badge && this.badge.sq === sq) {
        const b = document.createElement("div");
        b.className = "badge " + this.badge.kind;
        b.textContent = { blunder: "??", mistake: "?", good: "✓", best: "★", habit: "!?" }[this.badge.kind] || "";
        d.appendChild(b);
      }
      el.appendChild(d);
    }
  }

  bind() {
    const bd = this.el;
    const sqAt = (x, y) => { const e = document.elementFromPoint(x, y); const s = e && e.closest && e.closest(".sq"); return s && bd.contains(s) ? s.dataset.sq : null; };
    const clearGhosts = () => document.querySelectorAll(".pc.drag").forEach((g) => g.remove());
    bd.addEventListener("pointerdown", (e) => {
      if (!this.o.canMove()) return;
      if (e.button !== undefined && e.button > 0) return;
      const sq = sqAt(e.clientX, e.clientY); if (!sq) return;
      e.preventDefault();
      clearGhosts();
      const pc = this.o.getGame().get(sq);
      this.drag = { from: sq, own: !!(pc && pc.color === this.me), sx: e.clientX, sy: e.clientY, moved: false, ghost: null, over: null, id: e.pointerId };
      try { bd.setPointerCapture(e.pointerId); } catch (_) {}
    });
    bd.addEventListener("pointermove", (e) => {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      if (!d.moved) {
        if (!d.own || Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 6) return;
        d.moved = true;
        this.sel = d.from; this.draw();
        const node = this.sqEl(d.from).querySelector(".pc");
        const r = node.getBoundingClientRect();
        const g = node.cloneNode(); g.classList.add("drag");
        g.style.width = r.width + "px"; g.style.height = r.height + "px";
        document.body.appendChild(g); d.ghost = g; d.w = r.width;
        node.style.opacity = ".35";
      }
      d.ghost.style.left = e.clientX - d.w / 2 + "px";
      d.ghost.style.top = e.clientY - d.w / 2 + "px";
      const s = sqAt(e.clientX, e.clientY);
      if (s !== d.over) { if (d.over) this.sqEl(d.over)?.classList.remove("over"); d.over = s; if (s && s !== d.from) this.sqEl(s)?.classList.add("over"); }
    });
    const end = (e, cancel) => {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      this.drag = null;
      clearGhosts();
      try { bd.releasePointerCapture(e.pointerId); } catch (_) {}
      if (cancel) { this.draw(); return; }
      if (d.moved) {
        const to = sqAt(e.clientX, e.clientY);
        if (to && to !== d.from) this.tryMove(d.from, to); else this.draw();
      } else this.click(d.from);
    };
    bd.addEventListener("pointerup", (e) => end(e, false));
    bd.addEventListener("pointercancel", (e) => end(e, true));
    bd.addEventListener("lostpointercapture", (e) => { if (this.drag && e.pointerId === this.drag.id) end(e, true); });
  }

  click(sq) {
    if (!this.o.canMove()) return;
    const pc = this.o.getGame().get(sq);
    if (this.sel && this.sel !== sq && !(pc && pc.color === this.me)) { this.tryMove(this.sel, sq); return; }
    if (pc && pc.color === this.me) { this.sel = this.sel === sq ? null : sq; this.draw(); return; }
    this.sel = null; this.draw();
  }

  tryMove(from, to) {
    const legal = this.o.getGame().moves({ square: from, verbose: true }).filter((m) => m.to === to);
    this.sel = null;
    if (!legal.length) { this.draw(); return; }
    if (legal.some((m) => m.promotion)) { this.askPromo(from, to); return; }
    this.o.onMove(from + to);
  }

  askPromo(from, to) {
    const pr = this.el.parentElement.querySelector(".promo");
    pr.innerHTML = "";
    const flip = this.me === "b";
    const fi = FILES.indexOf(to[0]);
    const col = document.createElement("div"); col.className = "col";
    col.style.left = (flip ? 7 - fi : fi) * 12.5 + "%";
    ["q", "n", "r", "b"].forEach((k) => {
      const c = document.createElement("div");
      c.style.backgroundImage = `url("${PIECE[this.me + k]}")`;
      c.onclick = (e) => { e.stopPropagation(); pr.classList.remove("show"); this.o.onMove(from + to + k); };
      col.appendChild(c);
    });
    pr.appendChild(col);
    pr.onclick = () => { pr.classList.remove("show"); this.draw(); };
    pr.classList.add("show");
  }
}
