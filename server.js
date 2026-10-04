"use strict";
/* eslint-disable no-console */

const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const express = require("express");
const expressWs = require("express-ws");
const cookieParser = require("cookie-parser");
const pty = require("node-pty");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || "7681", 10);
const BIND = process.env.BIND || "127.0.0.1";

// --- Auth methods -----------------------------------------------------------
// Two ways in, either or both: Google OAuth (restricted by domain or an email
// allowlist) and a shared password. Plus an optional local-network bypass. At
// least one must be enabled at startup, or there is no door.
const GOOGLE_CLIENT_ID = process.env.WEB_TERMINAL_GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.WEB_TERMINAL_GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.WEB_TERMINAL_GOOGLE_REDIRECT || "";
// Restrict OAuth logins to a Workspace domain and/or an explicit email list.
// If neither is set, ANY verified Google account is accepted — fine for a
// personal instance, risky if public, so the README warns about it.
const ALLOWED_DOMAIN = (process.env.WEB_TERMINAL_ALLOWED_DOMAIN || "").toLowerCase();
const ALLOWED_EMAILS = (process.env.WEB_TERMINAL_ALLOWED_EMAILS || "")
  .toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
// Shared-password auth for self-hosting without Google (e.g. behind a VPN).
const PASSWORD = process.env.WEB_TERMINAL_PASSWORD || "";
// The account name recorded as the owner of password/bypass sessions.
const LOCAL_USER = (process.env.WEB_TERMINAL_USER || "user").toLowerCase();
const MIGRATION_OWNER = (process.env.WEB_TERMINAL_MIGRATION_OWNER || LOCAL_USER).toLowerCase();

const OAUTH_ENABLED = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
const PASSWORD_ENABLED = !!PASSWORD;
// Cloudflare Access in front of the tunnel. When both are set, the edge does
// the login (its own policy decides who), and every request that reaches us
// through Cloudflare must carry the Access JWT (Cf-Access-Jwt-Assertion) for
// THIS application — signed by the team's keys, unexpired, right audience —
// or it is refused outright. The email inside the JWT is the user, still
// subject to the same ALLOWED_EMAILS / ALLOWED_DOMAIN filter as OAuth.
// TEAM is the Zero Trust team name (<team>.cloudflareaccess.com); AUD is the
// application's Audience tag from the Access dashboard.
const CF_ACCESS_TEAM = (process.env.WEB_TERMINAL_CF_ACCESS_TEAM || "").toLowerCase().trim();
const CF_ACCESS_AUD = (process.env.WEB_TERMINAL_CF_ACCESS_AUD || "").trim();
const CF_ACCESS_ENABLED = !!(CF_ACCESS_TEAM && CF_ACCESS_AUD);
const CF_ACCESS_ISSUER = `https://${CF_ACCESS_TEAM}.cloudflareaccess.com`;
// Overridable only so the test suite can point it at a local JWKS.
const CF_ACCESS_CERTS_URL = process.env.WEB_TERMINAL_CF_ACCESS_CERTS_URL || `${CF_ACCESS_ISSUER}/cdn-cgi/access/certs`;

// Who may log in, regardless of which door they used (OAuth, Access).
function isEmailAllowed(email) {
  const domain = email.split("@")[1] || "";
  const domainOk = ALLOWED_DOMAIN ? domain === ALLOWED_DOMAIN : false;
  const emailOk = ALLOWED_EMAILS.length ? ALLOWED_EMAILS.includes(email) : false;
  const noRestriction = !ALLOWED_DOMAIN && !ALLOWED_EMAILS.length;
  return domainOk || emailOk || noRestriction;
}

if (!OAUTH_ENABLED && !PASSWORD_ENABLED && !CF_ACCESS_ENABLED && process.env.WEB_TERMINAL_LOCAL_BYPASS !== "1") {
  console.error(
    "FATAL: no auth method configured. Set one of:\n" +
    "  - WEB_TERMINAL_PASSWORD=<a strong password>\n" +
    "  - the Google OAuth trio (WEB_TERMINAL_GOOGLE_CLIENT_ID, _SECRET, _REDIRECT)\n" +
    "  - Cloudflare Access (WEB_TERMINAL_CF_ACCESS_TEAM + WEB_TERMINAL_CF_ACCESS_AUD)\n" +
    "  - WEB_TERMINAL_LOCAL_BYPASS=1  (local/private networks only)",
  );
  process.exit(1);
}

const SECRET = process.env.WEB_TERMINAL_SECRET || crypto.randomBytes(32).toString("hex");
const SHELL = process.env.WEB_TERMINAL_SHELL || process.env.SHELL || "/bin/bash";
const PUBLIC_DIR = path.join(__dirname, "public");
const COOKIE_NAME = "wt_auth";
const OAUTH_STATE_COOKIE = "wt_oauth_state";
const OAUTH_RETRY_COOKIE = "wt_oauth_retry";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Sessions live as long as the server runs (code-server style). They are only
// destroyed by: explicit client kill ({t:"kill"}), server restart, or 60s
// after the shell itself exits.
const SESSION_AFTER_EXIT_MS = 60 * 1000;
const MAX_SESSIONS_PER_USER = parseInt(process.env.WEB_TERMINAL_MAX_SESSIONS || "24", 10);

// Same-origin (or a non-browser client with no Origin) only. The public host is
// taken from WEB_TERMINAL_ORIGIN (comma-separated) and/or the OAuth redirect
// URI; localhost/loopback/private hosts cover the LAN and Tailscale paths.
const PUBLIC_HOSTS = new Set();
for (const o of (process.env.WEB_TERMINAL_ORIGIN || "").split(",").map((x) => x.trim()).filter(Boolean)) {
  try { PUBLIC_HOSTS.add(new URL(o).hostname); } catch (_) { PUBLIC_HOSTS.add(o); }
}
if (GOOGLE_REDIRECT_URI) { try { PUBLIC_HOSTS.add(new URL(GOOGLE_REDIRECT_URI).hostname); } catch (_) {} }

// The box's own names. Over the LAN/Tailscale the browser reaches us by
// hostname (mac.local, MagicDNS) rather than by IP, and those are just as
// same-origin as the IP is. Resolved once at startup: the OS hostname, its
// short form and the mDNS ".local" form. Deliberately NOT "whatever the Host
// header says": that would reopen the DNS-rebinding hole the allowlist exists
// to close.
const LOCAL_HOSTS = new Set();
(function collectLocalHosts() {
  const add = (h) => { h = String(h || "").toLowerCase().replace(/\.$/, ""); if (h) LOCAL_HOSTS.add(h); };
  const osName = os.hostname();
  add(osName);
  const short = osName.split(".")[0];
  add(short);
  add(`${short}.local`);
})();

function isAllowedOrigin(origin) {
  if (!origin) return true;                 // curl/native ws — not a browser CSRF vector
  let host;
  try { host = new URL(origin).hostname.toLowerCase().replace(/\.$/, ""); } catch (_) { return false; }
  if (PUBLIC_HOSTS.has(host)) return true;
  if (LOCAL_HOSTS.has(host)) return true;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  // RFC1918 only, the same set the local bypass trusts. The Tailscale range is
  // deliberately absent: that tailnet is a corporate VPN, not this user's.
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}
// Mouse-report filtering when the bare shell is in the foreground (see
// Session.filterInput). SGR mouse reports (ESC[<b;x;yM / m) and focus
// in/out (ESC[I / ESC[O) are the only sequences a browser terminal emits
// unprompted by the user.
const SHELL_NAME = path.basename(SHELL);
const FG_CACHE_MS = 300;
const MOUSE_REPORT_HINT = /\x1b\[(?:<|[IO])/;
const MOUSE_REPORT_RE = /\x1b\[<\d+;\d+;\d+[mM]|\x1b\[[IO]/g;
const MOUSE_TRACKING_OFF = "\x1b[?1003l\x1b[?1002l\x1b[?1000l\x1b[?1006l\x1b[?1004l";

// Audit log -----------------------------------------------------------------
const LOG_DIR = process.env.WEB_TERMINAL_LOG_DIR || path.join(os.homedir(), "Library", "Logs");
fs.mkdirSync(LOG_DIR, { recursive: true });
const AUDIT_PATH = path.join(LOG_DIR, "web-terminal.log");
const AUDIT_INPUT_TEXT = process.env.WEB_TERMINAL_AUDIT_INPUT === "1";
const auditStream = fs.createWriteStream(AUDIT_PATH, { flags: "a" });
function audit(event, fields) {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...fields }) + "\n";
  auditStream.write(line);
}
audit("startup", {
  pid: process.pid, port: PORT, bind: BIND, shell: SHELL,
  allowedDomain: ALLOWED_DOMAIN, redirect: GOOGLE_REDIRECT_URI,
  publicHosts: [...PUBLIC_HOSTS], localHosts: [...LOCAL_HOSTS],
  cfAccess: CF_ACCESS_ENABLED, allowedEmails: ALLOWED_EMAILS, auditInputText: AUDIT_INPUT_TEXT,
});

// ---------------------------------------------------------------------------
// Session manager
// ---------------------------------------------------------------------------
// The shell must NOT inherit the server's own secrets. The process env holds
// WEB_TERMINAL_SECRET (the cookie-signing key) and the Google client secret;
// left in, any terminal session could read them with `env` and, with the
// signing key, forge an auth cookie for any @example.com address — turning one shell
// into persistent access over the public path. Strip everything WEB_TERMINAL_*
// (plus the Google creds by any name) from what the PTY sees.
function sanitizedShellEnv() {
  const out = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("WEB_TERMINAL_")) continue;
    if (k === "GOOGLE_CLIENT_SECRET" || k === "GOOGLE_CLIENT_ID") continue;
    out[k] = v;
  }
  out.TERM = "xterm-256color";
  out.COLORTERM = "truecolor";
  return out;
}

// ---------------------------------------------------------------------------
// pty-host client. The shells live in pty-host.js, a separate long-lived
// process, so restarting this server no longer kills them. This side keeps a
// thin Session per PTY (owner, WebSocket, audit, input filtering) and relays.
// ---------------------------------------------------------------------------
const net = require("net");
const childProcess = require("child_process");
const PTY_HOST = require("./pty-host");

class HostClient {
  constructor() {
    this.sock = null;
    this.buf = "";
    this.rid = 0;
    this.pending = new Map();
    this.ready = this.connect();
  }

  async connect() {
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        await this.open();
        const hello = await this.call({ op: "hello" });
        audit("pty_host_connected", { pid: hello.pid, version: hello.version, expected: PTY_HOST.VERSION });
        if (hello.version !== PTY_HOST.VERSION) {
          console.warn(`pty-host is v${hello.version}, this server expects v${PTY_HOST.VERSION}; run scripts/restart-pty-host.sh (ends all shells)`);
        }
        // Shells that survived a server restart: pick them back up.
        const list = await this.call({ op: "list" });
        let adopted = 0;
        for (const m of list.sessions || []) {
          if (!sessions.has(m.id)) { sessions.set(m.id, new Session(m)); adopted++; }
        }
        if (adopted) audit("sessions_adopted", { count: adopted });
        return;
      } catch (_) {
        if (attempt === 0) this.spawnHost();
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    throw new Error("pty-host unreachable at " + PTY_HOST.SOCKET);
  }

  // Detached and in its own session: when launchd (or anyone) stops this
  // server, the host and its shells keep running.
  spawnHost() {
    const logFile = path.join(LOG_DIR, "web-terminal-ptyhost.log");
    const out = fs.openSync(logFile, "a");
    const child = childProcess.spawn(process.execPath, [path.join(__dirname, "pty-host.js")], {
      detached: true,
      stdio: ["ignore", out, out],
      env: { ...sanitizedShellEnv(), WEB_TERMINAL_PTY_SOCKET: PTY_HOST.SOCKET },
      cwd: os.homedir(),
    });
    child.unref();
    audit("pty_host_spawned", { pid: child.pid });
  }

  open() {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection(PTY_HOST.SOCKET);
      sock.setEncoding("utf8");
      sock.once("connect", () => {
        this.sock = sock;
        sock.on("data", (chunk) => this.onData(chunk));
        sock.on("close", () => this.onClose());
        resolve();
      });
      sock.once("error", reject);
    });
  }

  onData(chunk) {
    this.buf += chunk;
    let nl;
    while ((nl = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, nl);
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (_) { continue; }
      if (msg.rid != null) {
        const p = this.pending.get(msg.rid);
        if (p) { this.pending.delete(msg.rid); p(msg); }
      } else if (msg.ev === "data") {
        const s = sessions.get(msg.id);
        if (s) s.onData(msg.d);
      } else if (msg.ev === "exit") {
        const s = sessions.get(msg.id);
        if (s) s.onExit(msg.exitCode, msg.signal);
      }
    }
  }

  // The host went away (crashed or was restarted): its shells are gone too.
  onClose() {
    audit("pty_host_disconnected", { sessions: sessions.size });
    this.sock = null;
    for (const p of this.pending.values()) p({ ok: false, error: "host closed" });
    this.pending.clear();
    for (const s of [...sessions.values()]) s.onExit(null, "host-closed");
    this.ready = this.connect();
  }

  send(msg) {
    if (this.sock && !this.sock.destroyed) this.sock.write(JSON.stringify(msg) + "\n");
  }

  call(msg, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      if (!this.sock) return reject(new Error("pty-host not connected"));
      const rid = ++this.rid;
      const timer = setTimeout(() => { this.pending.delete(rid); reject(new Error("pty-host timeout")); }, timeoutMs);
      this.pending.set(rid, (r) => { clearTimeout(timer); resolve(r); });
      this.send({ ...msg, rid });
    });
  }
}

const host = new HostClient();

class Session {
  constructor(meta) {
    this.id = meta.id;
    this.owner = meta.owner;
    this.cols = meta.cols;
    this.rows = meta.rows;
    this.createdAt = meta.createdAt || Date.now();
    this.lastDataAt = meta.lastDataAt || this.createdAt;
    this.exited = !!meta.exited;
    this.exitInfo = meta.exitInfo || null;
    this.ws = null;
    this.inputLine = "";
    if (this.exited) this.scheduleCleanup();
  }

  static async spawn(id, { cols, rows, cwd }, owner) {
    const r = await host.call({
      op: "create", id, owner, cols, rows, cwd,
      shell: SHELL, args: ["--login"], env: shellEnvWithIntegration(),
    });
    if (!r.ok) throw new Error(r.error || "create failed");
    return new Session(r.session);
  }

  onData(d) {
    this.lastDataAt = Date.now();
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify({ t: "d", d })); } catch (_) {}
    }
  }

  onExit(exitCode, signal) {
    if (this.exited) return;
    this.exited = true;
    this.exitInfo = { exitCode, signal };
    audit("session_exit", { id: this.id, owner: this.owner, exitCode, signal });
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify({ t: "exit", exitCode, signal })); } catch (_) {}
    }
    this.scheduleCleanup();
  }

  // Keep an exited session around briefly so a returning client can see it.
  scheduleCleanup() {
    setTimeout(() => this.destroy("post-exit"), SESSION_AFTER_EXIT_MS);
  }

  // The exact screen (with scrollback, colours, alternate screen and modes),
  // rebuilt by the host's mirror, instead of replaying raw output.
  async attach(ws) {
    if (this.ws && this.ws !== ws) {
      try { this.ws.close(4001, "replaced by new connection"); } catch (_) {}
    }
    this.ws = ws;
    let snap = "";
    try { snap = (await host.call({ op: "snapshot", id: this.id })).d || ""; } catch (_) {}
    if (this.ws !== ws) return;
    try { ws.send(JSON.stringify({ t: "snap", d: snap })); } catch (_) {}
    if (this.exited) {
      try { ws.send(JSON.stringify({ t: "exit", ...this.exitInfo })); } catch (_) {}
    }
  }

  detach(ws) {
    if (this.ws === ws) this.ws = null;
  }

  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    if (!this.exited) host.send({ op: "resize", id: this.id, cols, rows });
  }

  write(d) {
    if (!this.exited) host.send({ op: "input", id: this.id, d });
  }

  // Name of the process owning the terminal; cached briefly, since mouse-motion
  // reports arrive dozens of times a second while the pointer moves.
  async foregroundProcess() {
    const now = Date.now();
    if (this._fgAt && now - this._fgAt < FG_CACHE_MS) return this._fg;
    let name = "";
    try { name = (await host.call({ op: "fg", id: this.id }, 1000)).name || ""; } catch (_) {}
    this._fg = name;
    this._fgAt = now;
    return name;
  }

  // Mouse and focus reports are only meaningful to the application that asked
  // for them. Claude Code turns on any-motion tracking (DECSET 1003); if it is
  // killed instead of exiting cleanly, nothing sends the matching reset, so the
  // browser keeps reporting every hover and zsh echoes it as "<35;12;40M".
  // When the login shell itself is in the foreground there is no consumer, so
  // drop the reports and tell the terminal to stop tracking.
  async filterInput(d) {
    if (!MOUSE_REPORT_HINT.test(d)) return d;
    const fg = await this.foregroundProcess();
    if (fg !== SHELL_NAME) {
      this._healedShell = false;
      return d;
    }
    const cleaned = d.replace(MOUSE_REPORT_RE, "");
    if (cleaned !== d && !this._healedShell) {
      this._healedShell = true;
      if (this.ws && this.ws.readyState === 1) {
        try { this.ws.send(JSON.stringify({ t: "d", d: MOUSE_TRACKING_OFF })); } catch (_) {}
      }
      audit("mouse_reports_dropped", { id: this.id, owner: this.owner, fg });
    }
    return cleaned;
  }

  // Typed lines can be passwords (sudo, ssh prompts) or tokens (export X=...),
  // and the audit log is a plain file. By default record only that a line was
  // entered and its length; WEB_TERMINAL_AUDIT_INPUT=1 restores full text.
  flushInputLine(ip) {
    if (this.inputLine.length > 0) {
      const fields = { id: this.id, owner: this.owner, ip, len: this.inputLine.length };
      if (AUDIT_INPUT_TEXT) fields.line = this.inputLine.slice(0, 1000);
      audit("input", fields);
      this.inputLine = "";
    }
  }

  destroy(reason) {
    if (this._destroyed) return;
    this._destroyed = true;
    sessions.delete(this.id);
    audit("session_destroy", { id: this.id, owner: this.owner, reason });
    host.send({ op: "kill", id: this.id });
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.close(4002, "session destroyed"); } catch (_) {}
    }
  }
}

// Shell integration (OSC 7 cwd, OSC 133 prompt/command marks) for zsh: point
// ZDOTDIR at shell-integration/zsh, whose rc files source the user's own and
// then add the hooks. Other shells start unchanged.
const INTEGRATION_DIR = path.join(__dirname, "shell-integration", "zsh");
function shellEnvWithIntegration() {
  const env = sanitizedShellEnv();
  if (SHELL_NAME === "zsh" && fs.existsSync(INTEGRATION_DIR)) {
    env.WT_USER_ZDOTDIR = process.env.ZDOTDIR || os.homedir();
    env.ZDOTDIR = INTEGRATION_DIR;
  }
  env.TERM_PROGRAM = "web-terminal";
  return env;
}

const sessions = new Map();

// ---------------------------------------------------------------------------
// Workspaces (named layouts of tabs that can be reopened by URL).
// Now owner-scoped: each workspace stores `owner` (email) and is only visible
// to that user. Legacy entries without owner are migrated to MIGRATION_OWNER.
// ---------------------------------------------------------------------------
const WORKSPACE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const WORKSPACES_FILE = path.join(__dirname, ".workspaces.json");
const workspaces = new Map(); // id -> { owner, tabs, activeTabId, nextTabId, updatedAt }

try {
  const raw = fs.readFileSync(WORKSPACES_FILE, "utf8");
  const obj = JSON.parse(raw);
  if (obj && typeof obj === "object") {
    let migrated = 0;
    for (const [id, ws] of Object.entries(obj)) {
      if (ws && typeof ws === "object") {
        if (!ws.owner) { ws.owner = MIGRATION_OWNER; migrated++; }
        else ws.owner = String(ws.owner).toLowerCase();
        workspaces.set(id, ws);
      }
    }
    audit("workspaces_loaded", { count: workspaces.size, migrated });
    if (migrated) persistWorkspaces(true);
  }
} catch (_) {}

let _wsSaveTimer = null;
function persistWorkspaces(immediate) {
  if (immediate) {
    if (_wsSaveTimer) { clearTimeout(_wsSaveTimer); _wsSaveTimer = null; }
    const obj = {};
    for (const [id, ws] of workspaces) obj[id] = ws;
    try { fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(obj)); } catch (_) {}
    return;
  }
  if (_wsSaveTimer) return;
  _wsSaveTimer = setTimeout(() => {
    _wsSaveTimer = null;
    const obj = {};
    for (const [id, ws] of workspaces) obj[id] = ws;
    fs.writeFile(WORKSPACES_FILE, JSON.stringify(obj), () => {});
  }, 1000);
}

setInterval(() => {
  const cutoff = Date.now() - WORKSPACE_TTL_MS;
  let removed = 0;
  for (const [id, ws] of workspaces) {
    if ((ws.updatedAt || 0) < cutoff) { workspaces.delete(id); removed++; }
  }
  if (removed) { persistWorkspaces(); audit("workspaces_gc", { removed }); }
}, 60 * 60 * 1000).unref();

const VALID_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

// ---------------------------------------------------------------------------
// Appearance preferences (per ACCOUNT, not per browser).
//
// Keyed by email, so signing in on a phone or a borrowed laptop brings your
// theme and font with you. The client also caches them in localStorage, but
// that cache is only a fallback: these are inlined into the HTML on every page
// load (see renderAppHtml) precisely so the very first paint is already the
// right colours. A flash of the wrong theme is ugly on an LCD and genuinely
// bad on e-paper, where it costs a full panel refresh.
//
// Never GC'd: a prefs row is a few dozen bytes and losing it silently resets
// someone's terminal, which is exactly the surprise this feature exists to end.
// ---------------------------------------------------------------------------
const PREFS_FILE = path.join(__dirname, ".prefs.json");
const prefs = new Map(); // email -> { themeId, fontFamily, fontSize, updatedAt }

// bg/fg/variant are paint hints, not settings: the theme catalog lives in the
// client bundle, so the pre-paint script in app.html has no way to turn a theme
// id into a colour on its own. Storing them here is what lets a brand-new
// browser paint the account's theme on the very first frame.
const DEFAULT_PREFS = {
  themeId: "wt-dark", fontFamily: "jetbrains-mono", fontSize: 13,
  bg: "#0a0d12", fg: "#e6edf3", variant: "dark",
};
const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 32;
// Slugs, not CSS. The client owns the font stacks; the server only stores a
// choice, so a malicious body can never inject a font-family string into a page.
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
// The hints are inlined into a <script> and then into a CSS custom property.
// Both are only safe because nothing but a literal #rrggbb ever gets through.
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

try {
  const obj = JSON.parse(fs.readFileSync(PREFS_FILE, "utf8"));
  if (obj && typeof obj === "object") {
    for (const [email, p] of Object.entries(obj)) {
      if (p && typeof p === "object") prefs.set(String(email).toLowerCase(), p);
    }
    audit("prefs_loaded", { count: prefs.size });
  }
} catch (_) {}

let _prefsSaveTimer = null;
function persistPrefs(immediate) {
  const write = (sync) => {
    const obj = {};
    for (const [email, p] of prefs) obj[email] = p;
    const json = JSON.stringify(obj);
    if (sync) { try { fs.writeFileSync(PREFS_FILE, json); } catch (_) {} }
    else fs.writeFile(PREFS_FILE, json, () => {});
  };
  if (immediate) {
    if (_prefsSaveTimer) { clearTimeout(_prefsSaveTimer); _prefsSaveTimer = null; }
    write(true);
    return;
  }
  if (_prefsSaveTimer) return;
  _prefsSaveTimer = setTimeout(() => { _prefsSaveTimer = null; write(false); }, 1000);
}

function getPrefs(email) {
  return { ...DEFAULT_PREFS, ...(prefs.get(email) || {}) };
}

// Returns the sanitised patch, or null if the body contained nothing usable —
// so a typo in the client can't quietly wipe a valid stored preference.
function sanitisePrefs(body) {
  const out = {};
  if (typeof body?.themeId === "string" && SAFE_SLUG_RE.test(body.themeId)) out.themeId = body.themeId;
  if (typeof body?.fontFamily === "string" && SAFE_SLUG_RE.test(body.fontFamily)) out.fontFamily = body.fontFamily;
  if (body?.fontSize != null) {
    const n = Math.round(Number(body.fontSize));
    if (Number.isFinite(n) && n >= FONT_SIZE_MIN && n <= FONT_SIZE_MAX) out.fontSize = n;
  }
  if (typeof body?.bg === "string" && HEX_RE.test(body.bg)) out.bg = body.bg;
  if (typeof body?.fg === "string" && HEX_RE.test(body.fg)) out.fg = body.fg;
  if (body?.variant === "light" || body?.variant === "dark") out.variant = body.variant;
  // Saved commands for the palette: plain strings, bounded.
  if (Array.isArray(body?.snippets)) {
    out.snippets = body.snippets
      .filter((x) => typeof x === "string" && x.trim() && x.length <= 300)
      .slice(0, 40);
  }
  return Object.keys(out).length ? out : null;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
expressWs(app);

app.disable("x-powered-by");
app.set("trust proxy", "loopback, 127.0.0.1, ::1");

// Security headers, set at the origin so they also cover the Tailscale/LAN path
// that never passes through Cloudflare. HSTS only over HTTPS (sending it on the
// plain-http local path would wrongly pin those hostnames to HTTPS).
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Cross-Origin-Opener-Policy", "same-origin");
  if (isHttps(req)) {
    res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(cookieParser(SECRET));
app.use(express.urlencoded({ extended: false, limit: "8kb" }));

// Cloudflare Access -----------------------------------------------------------
// Verify the JWT Access attaches to every request it lets through. RS256 with
// the team's published keys, cached for six hours and refreshed on an unknown
// kid (Cloudflare rotates them). Plain node crypto, no extra dependency.
let cfAccessKeyCache = { fetchedAt: 0, keys: new Map() };
async function cfAccessKeys(force) {
  const now = Date.now();
  if (!force && cfAccessKeyCache.keys.size && now - cfAccessKeyCache.fetchedAt < 6 * 3600 * 1000) {
    return cfAccessKeyCache.keys;
  }
  const r = await fetch(CF_ACCESS_CERTS_URL);
  if (!r.ok) throw new Error(`access certs: HTTP ${r.status}`);
  const j = await r.json();
  const keys = new Map();
  for (const k of (j && j.keys) || []) {
    if (!k || !k.kid) continue;
    try { keys.set(k.kid, crypto.createPublicKey({ key: k, format: "jwk" })); } catch (_) {}
  }
  cfAccessKeyCache = { fetchedAt: now, keys };
  return keys;
}
function b64urlJson(s) { return JSON.parse(Buffer.from(s, "base64url").toString("utf8")); }
// Returns the email on a valid token, otherwise a string reason (never throws
// on a malformed token — only on a certs fetch failure).
async function verifyCfAccessJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return "malformed";
  let header, payload;
  try { header = b64urlJson(parts[0]); payload = b64urlJson(parts[1]); } catch (_) { return "malformed"; }
  if (!header || header.alg !== "RS256" || typeof header.kid !== "string") return "bad_alg";
  let keys = await cfAccessKeys(false);
  let key = keys.get(header.kid);
  if (!key) { keys = await cfAccessKeys(true); key = keys.get(header.kid); }
  if (!key) return "unknown_kid";
  const ok = crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], "base64url"));
  if (!ok) return "bad_signature";
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now - 30) return "expired";
  if (typeof payload.nbf === "number" && payload.nbf > now + 30) return "not_yet_valid";
  if (payload.iss !== CF_ACCESS_ISSUER) return "bad_issuer";
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(CF_ACCESS_AUD)) return "bad_audience";
  const email = String(payload.email || "").toLowerCase();
  if (!email || !email.includes("@")) return "no_email";
  return { email };
}
function cameThroughCloudflare(req) {
  return !!(req.headers["cf-ray"] || req.headers["cf-connecting-ip"] || req.headers["cf-access-jwt-assertion"]);
}
app.use(async (req, res, next) => {
  if (!CF_ACCESS_ENABLED) return next();
  const token = req.headers["cf-access-jwt-assertion"] || (req.cookies && req.cookies.CF_Authorization) || "";
  if (token) {
    try {
      const v = await verifyCfAccessJwt(token);
      if (typeof v === "string") {
        audit("cf_access_rejected", { ip: req.ip, reason: v });
      } else if (!isEmailAllowed(v.email)) {
        audit("cf_access_denied", { ip: req.ip, email: v.email });
      } else {
        req.cfAccessUser = v.email;
      }
    } catch (e) {
      audit("cf_access_error", { ip: req.ip, err: String(e).slice(0, 200) });
      return res.status(503).type("text").send("Cloudflare Access verification unavailable");
    }
  }
  // Traffic from Cloudflare that did not pass Access means the Access policy
  // is off or bypassed. Refuse rather than fall through to the app's own
  // login — with Access on, the edge is the only door for internet traffic.
  if (cameThroughCloudflare(req) && !req.cfAccessUser) {
    audit("cf_access_missing", { ip: req.ip, path: req.path, hadToken: !!token });
    return res.status(403).type("text").send("Cloudflare Access required");
  }
  next();
});
// The worker must be revalidated on every load, or a broken one sticks around
// with no way for the user to evict it. It also has to be served from the root
// so its scope covers the whole app.
app.get("/sw.js", (_req, res) => {
  res.set("Cache-Control", "no-cache, must-revalidate")
     .type("application/javascript")
     .sendFile(path.join(PUBLIC_DIR, "sw.js"));
});
app.get("/manifest.webmanifest", (_req, res) => {
  res.set("Cache-Control", "no-cache")
     .type("application/manifest+json")
     .sendFile(path.join(PUBLIC_DIR, "manifest.webmanifest"));
});
// Static assets are intentionally public: they are the same bundle for everyone
// and carry nothing user-specific. iOS also fetches the manifest and icons
// before any session exists, so gating them behind auth just breaks install.
app.use(express.static(PUBLIC_DIR, { index: false, etag: true, maxAge: 0 }));

function isHttps(req) {
  return req.secure || (req.headers["x-forwarded-proto"] || "").split(",")[0] === "https";
}
// Local access without the Google round-trip.
//
// Reaching this box through Cloudflare costs ~570ms per request because the
// nearest edge is Miami, which makes typing painful. On the LAN the same
// request is ~5ms, but the OAuth redirect_uri is pinned to the public
// hostname, so a login started from an IP address can never complete. Hence:
// trust the network path instead, for private ranges only. NOT the Tailscale
// range: the tailnet this box sits on is a corporate VPN with other people on
// it, and trusting it would hand every one of them a shell.
//
// SECURITY: cloudflared delivers internet traffic to 127.0.0.1 as well, so a
// naive "is the socket local?" check would hand the shell to the whole world.
// Two guards: the peer address is read from the raw socket (never from a
// header), and any request carrying proxy headers is rejected outright.
const TRUSTED_PEER = [
  /^(::ffff:)?127\./,                              // loopback (this Mac)
  /^::1$/,
  /^(::ffff:)?10\./,                               // RFC1918
  /^(::ffff:)?192\.168\./,
  /^(::ffff:)?172\.(1[6-9]|2\d|3[01])\./,
];
const LOCAL_BYPASS = process.env.WEB_TERMINAL_LOCAL_BYPASS === "1";
const LOCAL_OWNER = MIGRATION_OWNER;

function isTrustedLocal(req) {
  if (!LOCAL_BYPASS) return false;
  // Anything relayed by a proxy is internet traffic: make it log in.
  if (req.headers["x-forwarded-for"] || req.headers["cf-connecting-ip"] ||
      req.headers["cf-ray"] || req.headers["x-forwarded-proto"]) {
    return false;
  }
  const peer = (req.socket && req.socket.remoteAddress) || "";
  return TRUSTED_PEER.some((re) => re.test(peer));
}

function currentUser(req) {
  // Edge-verified identity wins: it was checked against Cloudflare's keys on
  // this very request.
  if (req.cfAccessUser) return req.cfAccessUser;
  // The cookie is SIGNED, so a present, well-formed value was issued by us —
  // an OAuth email or the password/bypass user name. (The old check required an
  // "@", which silently rejected password logins.)
  const v = req.signedCookies && req.signedCookies[COOKIE_NAME];
  if (v && typeof v === "string" && v.length > 0 && v.length <= 320) {
    return v.toLowerCase();
  }
  if (isTrustedLocal(req)) return LOCAL_OWNER;
  return null;
}
function isAuthed(req) {
  return !!currentUser(req);
}
function setAuthCookie(req, res, email) {
  res.cookie(COOKIE_NAME, email, {
    signed: true, httpOnly: true, sameSite: "lax", secure: isHttps(req),
    maxAge: COOKIE_MAX_AGE_MS, path: "/",
  });
}
function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.redirect("/login");
  next();
}
function clamp(n, lo, hi, fallback) {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}
function loginErrorPage(res, code, reason) {
  const url = reason ? `/login?err=${encodeURIComponent(reason)}` : "/login?err=1";
  res.status(code).set("Cache-Control", "no-store").redirect(url);
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
// The login page adapts to whichever methods are enabled; the server injects the
// config so the page shows the Google button, the password form, or both.
function renderLoginHtml() {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, "login.html"), "utf8");
  const cfg = JSON.stringify({
    oauth: OAUTH_ENABLED,
    password: PASSWORD_ENABLED,
    domain: ALLOWED_DOMAIN || "",
  }).replace(/</g, "\\u003c");
  return html.replace("/*__WT_AUTH__*/null", cfg);
}

app.get("/login", (req, res) => {
  if (isAuthed(req)) return res.redirect("/");
  res.set("Cache-Control", "no-store").type("html").send(renderLoginHtml());
});

app.get("/auth/google/start", (req, res) => {
  if (!OAUTH_ENABLED) return loginErrorPage(res, 404, "oauth_disabled");
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE, state, {
    signed: true, httpOnly: true, sameSite: "lax", secure: isHttps(req),
    maxAge: 10 * 60 * 1000, path: "/auth/google/callback",
  });
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  if (ALLOWED_DOMAIN) params.set("hd", ALLOWED_DOMAIN);
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get("/auth/google/callback", async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const expected = req.signedCookies[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/auth/google/callback" });
  if (!state || !expected || state !== expected) {
    const retried = req.signedCookies[OAUTH_RETRY_COOKIE] === "1";
    audit("oauth_bad_state", {
      ip: req.ip,
      reason: !state ? "no_state_param" : !expected ? "no_state_cookie" : "mismatch",
      retried, ua: String(req.headers["user-agent"] || "").slice(0, 160),
    });
    res.clearCookie(OAUTH_RETRY_COOKIE, { path: "/auth/google/callback" });
    if (retried) return loginErrorPage(res, 400, "state");
    // One automatic restart: fresh state cookie, straight back to Google
    // (already signed in there, so it is a quick bounce).
    res.cookie(OAUTH_RETRY_COOKIE, "1", {
      signed: true, httpOnly: true, sameSite: "lax", secure: isHttps(req),
      maxAge: 10 * 60 * 1000, path: "/auth/google/callback",
    });
    return res.set("Cache-Control", "no-store").redirect("/auth/google/start");
  }
  res.clearCookie(OAUTH_RETRY_COOKIE, { path: "/auth/google/callback" });
  if (typeof req.query.error === "string") {
    audit("oauth_provider_error", { ip: req.ip, error: req.query.error });
    return loginErrorPage(res, 401, "provider");
  }
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code) return loginErrorPage(res, 400, "nocode");

  try {
    const body = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      audit("oauth_token_failed", { status: tokenRes.status, text: text.slice(0, 500) });
      return loginErrorPage(res, 401, "token");
    }
    const tok = await tokenRes.json();
    const idToken = tok.id_token;
    if (!idToken || typeof idToken !== "string") {
      audit("oauth_no_id_token", {});
      return loginErrorPage(res, 401, "no_id_token");
    }
    // Decode id_token payload. We trust the source: it came over TLS from
    // Google's token endpoint in response to our client-secret-authenticated
    // POST. No signature verification necessary in this context.
    const parts = idToken.split(".");
    if (parts.length !== 3) return loginErrorPage(res, 401, "bad_id_token");
    let payload;
    try {
      payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch (e) {
      audit("oauth_decode_failed", { err: String(e) });
      return loginErrorPage(res, 401, "decode");
    }
    if (payload.aud !== GOOGLE_CLIENT_ID) {
      audit("oauth_bad_aud", { aud: payload.aud });
      return loginErrorPage(res, 401, "aud");
    }
    const email = String(payload.email || "").toLowerCase();
    const emailVerified = payload.email_verified === true || payload.email_verified === "true";
    if (!email || !emailVerified) {
      audit("oauth_email_unverified", { email });
      return loginErrorPage(res, 401, "unverified");
    }
    // Allow if it matches the domain OR is on the email allowlist. If neither is
    // configured, any verified Google account passes (see the README warning).
    if (!isEmailAllowed(email)) {
      audit("oauth_denied", { email, domain: email.split("@")[1] || "" });
      return loginErrorPage(res, 403, "domain");
    }
    setAuthCookie(req, res, email);
    audit("login_success", { ip: req.ip, email });
    res.redirect("/");
  } catch (e) {
    audit("oauth_error", { err: String(e) });
    return loginErrorPage(res, 500, "internal");
  }
});

// Shared-password login (enabled when WEB_TERMINAL_PASSWORD is set). Kept simple
// on purpose: one constant-time comparison, a lightweight per-IP rate limit, and
// the same signed cookie the OAuth path issues.
if (PASSWORD_ENABLED) {
  const pwParser = express.urlencoded({ extended: false, limit: "1kb" });
  const pwAttempts = new Map();   // ip -> { count, resetAt }
  const PW_MAX = 10, PW_WINDOW_MS = 15 * 60 * 1000;

  app.post("/auth/password", pwParser, (req, res) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    let a = pwAttempts.get(ip);
    if (!a || a.resetAt < now) { a = { count: 0, resetAt: now + PW_WINDOW_MS }; pwAttempts.set(ip, a); }
    if (a.count >= PW_MAX) {
      audit("password_ratelimited", { ip });
      return loginErrorPage(res, 429, "ratelimited");
    }

    const given = Buffer.from(String((req.body && req.body.password) || ""));
    const expected = Buffer.from(PASSWORD);
    const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);
    if (!ok) {
      a.count++;
      audit("password_denied", { ip });
      return loginErrorPage(res, 401, "password");
    }
    pwAttempts.delete(ip);
    setAuthCookie(req, res, LOCAL_USER);
    audit("password_login", { ip, user: LOCAL_USER });
    res.redirect("/");
  });
}

app.post("/logout", requireAuth, (req, res) => {
  const email = currentUser(req);
  res.clearCookie(COOKIE_NAME, { path: "/" });
  audit("logout", { ip: req.ip, email });
  if (CF_ACCESS_ENABLED && cameThroughCloudflare(req)) return res.redirect("/cdn-cgi/access/logout");
  res.redirect("/login");
});

// Asset versioning.
//
// The origin sends `max-age=0`, but Cloudflare overrides that with its own
// browser-cache TTL (observed: 4 hours), so a rebuilt app.js kept reaching
// browsers hours late — a deploy would look live here while the user was still
// running the previous build. Stamping the URL with the file's fingerprint
// sidesteps it entirely: a new build is a new URL, which nothing has cached.
function assetStamp(file) {
  try {
    const st = fs.statSync(path.join(PUBLIC_DIR, file));
    return crypto
      .createHash("sha1")
      .update(`${st.size}-${st.mtimeMs}`)
      .digest("hex")
      .slice(0, 10);
  } catch (_) {
    return String(Date.now());
  }
}

function renderAppHtml(req) {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, "app.html"), "utf8");
  // Inlined before the stylesheet so the account's theme is applied on the very
  // first paint. `</` is escaped because this lands inside a <script> element,
  // where a literal "</script>" in the data would close the tag early.
  const inline = JSON.stringify(getPrefs(currentUser(req))).replace(/</g, "\\u003c");
  return html
    .replace("/*__WT_PREFS__*/null", inline)
    .replace('href="/style.css"', `href="/style.css?v=${assetStamp("style.css")}"`)
    .replace('src="/app.js"', `src="/app.js?v=${assetStamp("app.js")}"`);
}

app.get("/", requireAuth, (req, res) => {
  // The HTML itself must never be cached, or the stamped URLs never update.
  res
    .set("Cache-Control", "no-store, no-cache, must-revalidate")
    .type("html")
    .send(renderAppHtml(req));
});

app.get("/healthz", (_req, res) => res.send("ok"));

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ email: currentUser(req) });
});

// ---------------------------------------------------------------------------
// API: list active sessions (filtered to caller)
// ---------------------------------------------------------------------------
// Tab names live in the client's workspace layouts, not in the session, so
// map session id -> tab name from this user's saved workspaces (the most
// recently saved one wins when a session sits in several).
function tabNamesBySession(owner) {
  const out = new Map();
  const seen = new Map();
  const walk = (node, name, at) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.sessionId === "string") {
      if (!seen.has(node.sessionId) || seen.get(node.sessionId) < at) {
        out.set(node.sessionId, name);
        seen.set(node.sessionId, at);
      }
    }
    for (const v of Object.values(node)) if (v && typeof v === "object") walk(v, name, at);
  };
  for (const w of workspaces.values()) {
    if (w.owner !== owner || !Array.isArray(w.tabs)) continue;
    for (const t of w.tabs) {
      if (t && typeof t.name === "string") walk(t.layout, t.name.slice(0, 80), w.updatedAt || 0);
    }
  }
  return out;
}

app.get("/api/sessions", requireAuth, async (req, res) => {
  const me = currentUser(req);
  const names = tabNamesBySession(me);
  const mine = [...sessions.values()].filter((s) => s.owner === me);
  const list = await Promise.all(mine.map(async (s) => ({
    id: s.id,
    tabName: names.get(s.id) || null,
    process: s.exited ? null : (await s.foregroundProcess()) || null,
    cols: s.cols,
    rows: s.rows,
    exited: !!s.exited,
    attached: !!s.ws,
    createdAt: s.createdAt,
    lastDataAt: s.lastDataAt,
  })));
  list.sort((a, b) => b.lastDataAt - a.lastDataAt);
  res.json({ sessions: list });
});

// End one of your own sessions (the ✕ in "Open existing session"). Same
// cross-site guard as uploads: an allowed Origin plus a header a plain form
// cannot send.
app.delete("/api/sessions/:id", requireAuth, (req, res) => {
  if (req.get("x-wt-action") !== "1" || !isAllowedOrigin(req.headers.origin)) {
    audit("session_kill_rejected", { ip: req.ip, origin: req.headers.origin || "" });
    return res.status(403).json({ error: "forbidden" });
  }
  const s = sessions.get(String(req.params.id).slice(0, 64));
  if (!s || s.owner !== currentUser(req)) return res.status(404).json({ error: "not found" });
  s.destroy("api-kill");
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// API: appearance preferences (per-account)
// ---------------------------------------------------------------------------
const prefsBodyParser = express.json({ limit: "32kb" });

app.get("/api/prefs", requireAuth, (req, res) => {
  res.json(getPrefs(currentUser(req)));
});

app.post("/api/prefs", requireAuth, prefsBodyParser, (req, res) => {
  const patch = sanitisePrefs(req.body);
  if (!patch) return res.status(400).json({ error: "no valid fields" });
  const me = currentUser(req);
  const next = { ...getPrefs(me), ...patch, updatedAt: Date.now() };
  prefs.set(me, next);
  persistPrefs();
  res.json(next);
});

// ---------------------------------------------------------------------------
// API: image upload (drag & drop / paste into a pane)
// ---------------------------------------------------------------------------
// The browser cannot hand an image to a program in the shell, and Claude
// Code's own Ctrl+V reads the clipboard of THIS machine, not the viewer's. So
// the page uploads the image here, we save it under UPLOAD_DIR, and the page
// types the resulting path into the terminal, where Claude Code attaches it.
const UPLOAD_DIR = process.env.WEB_TERMINAL_UPLOAD_DIR || path.join(os.homedir(), ".web-terminal", "uploads");
const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const UPLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Content type -> extension. Only formats an image viewer or Claude reads;
// HEIC (iPhone) is converted to JPEG with macOS `sips` when available.
const UPLOAD_TYPES = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp",
  "image/heic": "heic", "image/heif": "heic",
};
const uploadParser = express.raw({ type: Object.keys(UPLOAD_TYPES), limit: UPLOAD_MAX_BYTES });

function pruneUploads() {
  let names = [];
  try { names = fs.readdirSync(UPLOAD_DIR); } catch (_) { return; }
  const cutoff = Date.now() - UPLOAD_TTL_MS;
  for (const n of names) {
    const f = path.join(UPLOAD_DIR, n);
    try { if (fs.statSync(f).mtimeMs < cutoff) fs.unlinkSync(f); } catch (_) {}
  }
}
pruneUploads();
setInterval(pruneUploads, 6 * 60 * 60 * 1000).unref();

function heicToJpeg(src) {
  return new Promise((resolve) => {
    if (process.platform !== "darwin") return resolve(null);
    const dst = src.replace(/\.heic$/, ".jpg");
    require("child_process").execFile("/usr/bin/sips", ["-s", "format", "jpeg", src, "--out", dst],
      { timeout: 20000 }, (err) => {
        if (err) return resolve(null);
        try { fs.chmodSync(dst, 0o600); fs.unlinkSync(src); } catch (_) {}
        resolve(dst);
      });
  });
}

app.post("/api/upload", requireAuth, (req, res, next) => {
  // A plain cross-site form cannot set this header, and a fetch() that does is
  // preflighted, so together with the Origin check this is not CSRF-able.
  if (req.get("x-wt-upload") !== "1" || !isAllowedOrigin(req.headers.origin)) {
    audit("upload_rejected", { ip: req.ip, origin: req.headers.origin || "" });
    return res.status(403).json({ error: "forbidden" });
  }
  next();
}, uploadParser, async (req, res) => {
  const type = String(req.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = UPLOAD_TYPES[type];
  if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(415).json({ error: "unsupported image type" });
  }
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    let file = path.join(UPLOAD_DIR, `img-${stamp}-${crypto.randomBytes(3).toString("hex")}.${ext}`);
    fs.writeFileSync(file, req.body, { mode: 0o600, flag: "wx" });
    if (ext === "heic") file = (await heicToJpeg(file)) || file;
    audit("upload", { ip: req.ip, me: currentUser(req), file, bytes: req.body.length, type });
    res.json({ path: file });
  } catch (e) {
    audit("upload_failed", { ip: req.ip, err: String(e).slice(0, 200) });
    res.status(500).json({ error: "could not save" });
  }
});
// express.raw answers an oversized body with 413 via the error handler.
app.use("/api/upload", (err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.type === "entity.too.large" ? "too large (max 25 MB)" : "upload failed" });
});

// ---------------------------------------------------------------------------
// API: workspace persistence (per-user)
// ---------------------------------------------------------------------------
const wsBodyParser = express.json({ limit: "256kb" });

app.get("/api/workspace/:id", requireAuth, (req, res) => {
  const id = req.params.id;
  if (!VALID_ID_RE.test(id)) return res.status(400).json({ error: "bad id" });
  const ws = workspaces.get(id);
  if (!ws) return res.status(404).json({ error: "not found" });
  if (ws.owner !== currentUser(req)) return res.status(404).json({ error: "not found" });
  res.json(ws);
});

app.post("/api/workspace/:id", requireAuth, wsBodyParser, (req, res) => {
  const id = req.params.id;
  if (!VALID_ID_RE.test(id)) return res.status(400).json({ error: "bad id" });
  const me = currentUser(req);
  const existing = workspaces.get(id);
  if (existing && existing.owner !== me) return res.status(403).json({ error: "not yours" });
  const data = req.body || {};
  if (!Array.isArray(data.tabs)) return res.status(400).json({ error: "missing tabs[]" });
  const stored = {
    owner: me,
    tabs: data.tabs,
    activeTabId: data.activeTabId ?? null,
    nextTabId: typeof data.nextTabId === "number" ? data.nextTabId : 1,
    updatedAt: Date.now(),
  };
  workspaces.set(id, stored);
  persistWorkspaces();
  res.json({ ok: true, updatedAt: stored.updatedAt });
});

app.delete("/api/workspace/:id", requireAuth, (req, res) => {
  const id = req.params.id;
  if (!VALID_ID_RE.test(id)) return res.status(400).end();
  const existing = workspaces.get(id);
  if (existing && existing.owner !== currentUser(req)) return res.status(403).end();
  workspaces.delete(id);
  persistWorkspaces();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Terminal WebSocket
// ---------------------------------------------------------------------------
app.ws("/ws/term", async (ws, req) => {
  const me = currentUser(req);
  if (!me) {
    try { ws.close(1008, "unauthenticated"); } catch (_) {}
    return;
  }

  // Reject cross-site WebSocket handshakes (CSWSH). The cookie is SameSite=Lax,
  // which already blocks the cross-site cookie in modern browsers, but Origin is
  // the explicit control and costs nothing. A same-origin ws:// carries an
  // Origin header; a non-browser client (no Origin) is allowed through, since it
  // cannot be a cross-site browser attack.
  if (!isAllowedOrigin(req.headers.origin)) {
    audit("ws_bad_origin", { ip: req.ip, me, origin: req.headers.origin || "", host: req.headers.host || "" });
    try { ws.close(4003, "bad origin"); } catch (_) {}
    return;
  }

  // Messages that arrive while the session is being set up are queued, then
  // handled strictly in order (filterInput may wait on the host).
  const early = [];
  let handler = (raw) => early.push(raw);
  ws.on("message", (raw) => handler(raw));
  let closed = false;
  ws.on("close", () => { closed = true; });

  try { await host.ready; } catch (_) {
    try { ws.close(1011, "pty host unavailable"); } catch (_) {}
    return;
  }

  // Per-user cap on live PTYs. Each connection spawns a shell; without a ceiling
  // one account (or the local bypass) could exhaust the box's processes.
  let liveForUser = 0;
  for (const sInfo of sessions.values()) if (sInfo.owner === me && !sInfo.exited) liveForUser++;

  const requestedId = typeof req.query.session === "string" ? req.query.session.slice(0, 64) : "";
  const cols = clamp(parseInt(req.query.cols, 10), 10, 1000, 80);
  const rows = clamp(parseInt(req.query.rows, 10), 5, 500, 24);
  const ip = req.ip;
  // New shells may start in the directory the client was in (OSC 7 of the
  // pane it was opened from). Only an existing absolute directory is used.
  let cwd = undefined;
  if (typeof req.query.cwd === "string" && req.query.cwd.length < 1024 && path.isAbsolute(req.query.cwd)) {
    try { if (fs.statSync(req.query.cwd).isDirectory()) cwd = req.query.cwd; } catch (_) {}
  }

  let session;
  let fresh = false;
  const existing = requestedId ? sessions.get(requestedId) : null;
  if (existing && existing.owner === me) {
    session = existing;
    audit("session_attach", { id: requestedId, ip, me });
  } else {
    if (existing) audit("session_attach_denied", { id: requestedId, ip, me, owner: existing.owner });
    if (liveForUser >= MAX_SESSIONS_PER_USER) {
      audit("ws_session_cap", { ip: req.ip, me, live: liveForUser });
      try { ws.close(1013, "too many sessions"); } catch (_) {}
      return;
    }
    const id = crypto.randomBytes(8).toString("hex");
    try {
      session = await Session.spawn(id, { cols, rows, cwd }, me);
    } catch (e) {
      audit("session_spawn_failed", { ip, me, err: String(e) });
      try { ws.close(1011, "pty spawn failed"); } catch (_) {}
      return;
    }
    sessions.set(id, session);
    fresh = true;
    audit("session_create", { id, ip, me, cols, rows, cwd: cwd || null, requestedId: requestedId || null,
      reason: existing ? "owner_mismatch" : undefined });
  }
  if (closed) { session.detach(ws); return; }

  try {
    ws.send(JSON.stringify({ t: "session", id: session.id, fresh, cols: session.cols, rows: session.rows }));
  } catch (_) {}
  await session.attach(ws);

  let chain = Promise.resolve();
  const process1 = async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.t === "i" && typeof msg.d === "string") {
      const d = await session.filterInput(msg.d);
      if (!d) return;
      for (const ch of d) {
        if (ch === "\r" || ch === "\n" || ch === "\u0003") session.flushInputLine(ip);
        else {
          session.inputLine += ch;
          if (session.inputLine.length > 4096) session.inputLine = session.inputLine.slice(-4096);
        }
      }
      session.write(d);
    } else if (msg.t === "r") {
      const c = clamp(parseInt(msg.cols, 10), 10, 1000, session.cols);
      const r = clamp(parseInt(msg.rows, 10), 5, 500, session.rows);
      session.resize(c, r);
    } else if (msg.t === "kill") {
      session.destroy("client-kill");
    } else if (msg.t === "ping") {
      try { ws.send(JSON.stringify({ t: "pong" })); } catch (_) {}
    }
  };
  handler = (raw) => { chain = chain.then(() => process1(raw)).catch(() => {}); };
  for (const raw of early) handler(raw);

  ws.on("close", () => {
    session.flushInputLine(ip);
    audit("ws_close", { id: session.id, ip, me });
    session.detach(ws);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
const server = app.listen(PORT, BIND, () => {
  console.log(`web-terminal listening on http://${BIND}:${PORT}`);
});

function shutdown(signal) {
  audit("shutdown", { signal, sessions: sessions.size });
  // Prefs writes are debounced by a second; a restart right after someone picks
  // a theme would otherwise throw the choice away.
  persistPrefs(true);
  // The shells live in pty-host and outlive this process; just let clients go.
  for (const s of sessions.values()) {
    try { s.ws && s.ws.close(1012, "server restart"); } catch (_) {}
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
