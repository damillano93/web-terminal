"use strict";
/* eslint-disable no-console */
//
// pty-host: owns the shells so the web server can restart without killing them.
//
// server.js spawns this once (detached, in its own session) and talks to it over
// a Unix socket; every later server start finds it already running and just
// reconnects. It keeps, per session, the PTY plus a headless xterm.js mirror of
// the screen, so a client that reattaches gets the exact screen back (colours,
// alternate screen, cursor, modes) instead of a replay of raw output.
//
// Restarting this process DOES end every shell. Only do it when this file
// changes (scripts/restart-pty-host.sh).
//
// Protocol: newline-delimited JSON both ways.
//   client → host  {op, rid?, ...}   ops: hello, list, create, input, resize,
//                                         kill, snapshot, fg
//   host → client  {rid, ...result}  replies to ops that carry an rid
//                  {ev:"data", id, d} | {ev:"exit", id, exitCode, signal}

const fs = require("fs");
const net = require("net");
const path = require("path");
const os = require("os");
const pty = require("node-pty");
const { Terminal } = require("@xterm/headless");
const { SerializeAddon } = require("@xterm/addon-serialize");

const VERSION = 1;
const SOCKET = process.env.WEB_TERMINAL_PTY_SOCKET || path.join(os.homedir(), ".web-terminal", "pty-host.sock");
const MIRROR_SCROLLBACK = 2000;      // lines the mirror keeps
const SNAPSHOT_SCROLLBACK = 1000;    // lines sent back on reattach

const sessions = new Map();   // id -> { term, mirror, serializer, meta }
const clients = new Set();

function log(...args) { console.log(new Date().toISOString(), ...args); }

function broadcast(msg) {
  const line = JSON.stringify(msg) + "\n";
  for (const c of clients) {
    if (!c.destroyed) c.write(line);
  }
}

function meta(s) {
  return {
    id: s.id, owner: s.owner, cols: s.cols, rows: s.rows,
    createdAt: s.createdAt, lastDataAt: s.lastDataAt,
    exited: s.exited, exitInfo: s.exitInfo, cwd: s.cwd,
  };
}

function create({ id, owner, cols, rows, cwd, shell, args, env }) {
  if (sessions.has(id)) throw new Error("exists");
  const term = pty.spawn(shell, args || ["--login"], {
    name: "xterm-256color", cols, rows, cwd: cwd || os.homedir(), env,
  });
  const mirror = new Terminal({ cols, rows, scrollback: MIRROR_SCROLLBACK, allowProposedApi: true });
  const serializer = new SerializeAddon();
  mirror.loadAddon(serializer);
  const s = {
    id, owner, cols, rows, cwd, term, mirror, serializer,
    createdAt: Date.now(), lastDataAt: Date.now(), exited: false, exitInfo: null,
  };
  term.onData((d) => {
    s.lastDataAt = Date.now();
    mirror.write(d);
    broadcast({ ev: "data", id, d });
  });
  term.onExit(({ exitCode, signal }) => {
    s.exited = true;
    s.exitInfo = { exitCode, signal };
    broadcast({ ev: "exit", id, exitCode, signal });
  });
  sessions.set(id, s);
  log("create", id, owner, `${cols}x${rows}`);
  return meta(s);
}

function kill(id) {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  try { s.term.kill(); } catch (_) {}
  try { s.mirror.dispose(); } catch (_) {}
  log("kill", id);
}

// The mirror parses asynchronously; flush pending writes before serialising.
function snapshot(s) {
  return new Promise((resolve) => {
    s.mirror.write("", () => {
      let d = "";
      try { d = s.serializer.serialize({ scrollback: SNAPSHOT_SCROLLBACK }); } catch (_) {}
      resolve(d);
    });
  });
}

async function handle(sock, msg) {
  const reply = (r) => { if (msg.rid != null && !sock.destroyed) sock.write(JSON.stringify({ rid: msg.rid, ...r }) + "\n"); };
  const s = msg.id != null ? sessions.get(msg.id) : null;
  try {
    switch (msg.op) {
      case "hello": return reply({ ok: true, version: VERSION, pid: process.pid });
      case "list": return reply({ ok: true, sessions: [...sessions.values()].map(meta) });
      case "create": return reply({ ok: true, session: create(msg) });
      case "input": if (s && !s.exited) s.term.write(msg.d); return;
      case "resize":
        if (s && !s.exited) {
          s.cols = msg.cols; s.rows = msg.rows;
          try { s.term.resize(msg.cols, msg.rows); } catch (_) {}
          try { s.mirror.resize(msg.cols, msg.rows); } catch (_) {}
        }
        return;
      case "kill": kill(msg.id); return reply({ ok: true });
      case "snapshot": return reply({ ok: !!s, d: s ? await snapshot(s) : "" });
      case "fg": {
        let name = "";
        try { name = s && !s.exited ? String(s.term.process || "") : ""; } catch (_) {}
        return reply({ ok: true, name });
      }
      default: return reply({ ok: false, error: "unknown op" });
    }
  } catch (e) {
    reply({ ok: false, error: String(e && e.message || e) });
  }
}

function serve() {
  fs.mkdirSync(path.dirname(SOCKET), { recursive: true, mode: 0o700 });
  try { fs.unlinkSync(SOCKET); } catch (_) {}
  const server = net.createServer((sock) => {
    clients.add(sock);
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("data", (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch (_) { continue; }
        handle(sock, msg);
      }
    });
    sock.on("close", () => clients.delete(sock));
    sock.on("error", () => clients.delete(sock));
  });
  server.listen(SOCKET, () => {
    fs.chmodSync(SOCKET, 0o600);
    log(`pty-host v${VERSION} pid ${process.pid} listening on ${SOCKET}`);
  });
  const stop = (sig) => {
    log("stopping on", sig, "sessions:", sessions.size);
    for (const id of [...sessions.keys()]) kill(id);
    try { fs.unlinkSync(SOCKET); } catch (_) {}
    process.exit(0);
  };
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
  // The parent server going away must not take us with it.
  process.on("SIGHUP", () => {});
}

module.exports = { VERSION, SOCKET };
if (require.main === module) serve();
