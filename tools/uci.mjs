// Node용 Stockfish 래퍼 (src/engine.js 와 같은 analyse 인터페이스). 도구 스크립트 전용.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SF = path.join(path.dirname(fileURLToPath(import.meta.url)), "../vendor/stockfish-19-lite-single.js");

export class NodeEngine {
  constructor(extra = "") {
    this.p = spawn("node", [SF]);
    this.buf = "";
    this.job = null;
    this.queue = [];
    this.p.stdout.on("data", (d) => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf("\n")) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        this._line(line);
      }
    });
    this.p.stdin.write("uci\nsetoption name Hash value 32\n" + extra + "isready\n");
  }
  _line(line) {
    const job = this.job;
    if (!job) return;
    if (line.startsWith("info ") && line.includes(" pv ") && line.includes(" score ")) {
      const t = line.split(" ");
      const get = (k) => t[t.indexOf(k) + 1];
      const mpv = t.includes("multipv") ? +get("multipv") : 1;
      const si = t.indexOf("score");
      job.infos[mpv] = { kind: t[si + 1], val: +t[si + 2], pv: t.slice(t.indexOf("pv") + 1), depth: +get("depth") };
    } else if (line.startsWith("bestmove")) {
      const best = line.split(" ")[1];
      const infos = Object.keys(job.infos).map(Number).sort((a, b) => a - b).map((k) => job.infos[k]);
      this.job = null;
      job.resolve({ infos, best: best && best !== "(none)" ? best : null });
      this._next();
    }
  }
  _next() {
    if (this.job || !this.queue.length) return;
    const j = (this.job = this.queue.shift());
    const go = j.movetime ? `go movetime ${j.movetime}` : `go depth ${j.depth}`;
    this.p.stdin.write(`setoption name MultiPV value ${j.multipv}\nposition fen ${j.fen}\n${go}\n`);
  }
  analyse(fen, depth, multipv = 1) {
    return new Promise((resolve) => { this.queue.push({ fen, depth, multipv, resolve, infos: {} }); this._next(); });
  }
  play(fen, movetime) {
    return new Promise((resolve) => { this.queue.push({ fen, movetime, multipv: 1, resolve, infos: {} }); this._next(); });
  }
  stop() { this.p.kill(); }
}
