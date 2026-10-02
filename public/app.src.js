// Bundled by scripts/build.js with esbuild → public/app.js
//
// Default renderer is xterm.js (battle-tested, splits-safe, works in Safari).
// Append ?renderer=ghostty to the URL to try ghostty-web instead.

import "@xterm/xterm/css/xterm.css";
// Curated slice of the Gogh catalog, vendored by scripts/fetch-themes.js.
// Refresh or extend the list with `npm run themes`.
import GOGH_THEMES from "./gogh-themes.json";

// ---------------------------------------------------------------------------
// UI icons — one stroke style everywhere instead of Unicode/emoji glyphs, which
// render differently on every OS (and as colour emoji on iOS). Paths follow
// Lucide (https://lucide.dev, ISC licence), 24×24, stroked with currentColor.
// ---------------------------------------------------------------------------
const ICON_PATHS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevronUp: '<path d="m18 15-6-6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronsDown: '<path d="m7 6 5 5 5-5M7 13l5 5 5-5"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  enter: '<path d="M20 4v7a4 4 0 0 1-4 4H4M9 10l-5 5 5 5"/>',
  keyboard: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  minimize: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  window: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8h20M6 4v4M10 4v4"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  palette: '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  page: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 13H8M16 17H8"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  pencil: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5zM15 5l4 4"/>',
  splitRight: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/>',
  splitDown: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};
function icon(name, size) {
  const px = size || 16;
  return '<svg class="ic" width="' + px + '" height="' + px + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON_PATHS[name] || "") + "</svg>";
}

let RENDERER = "xterm.js";
let TerminalCtor = null;
let FitAddonCtor = null;
// Optional xterm.js addons; all null under ghostty-web, which has its own.
let XtermAddons = null;
let CURRENT_USER = null;

async function fetchCurrentUser() {
  try {
    const r = await fetch("/api/me", { credentials: "include" });
    if (r.status === 200) {
      const j = await r.json();
      if (j && typeof j.email === "string") CURRENT_USER = j.email;
    } else if (r.status === 401 || r.status === 302 || r.status === 0) {
      location.href = "/login";
    }
  } catch (_) {}
}

async function loadXterm() {
  const xt = await import("@xterm/xterm");
  const fit = await import("@xterm/addon-fit");
  TerminalCtor = xt.Terminal;
  FitAddonCtor = fit.FitAddon;
  RENDERER = "xterm.js";
  const [search, links, unicode, clip, webgl, image, serialize] = await Promise.all([
    import("@xterm/addon-search"),
    import("@xterm/addon-web-links"),
    import("@xterm/addon-unicode11"),
    import("@xterm/addon-clipboard"),
    import("@xterm/addon-webgl"),
    import("@xterm/addon-image"),
    import("@xterm/addon-serialize"),
  ]);
  XtermAddons = {
    Search: search.SearchAddon,
    WebLinks: links.WebLinksAddon,
    Unicode11: unicode.Unicode11Addon,
    Clipboard: clip.ClipboardAddon,
    Webgl: webgl.WebglAddon,
    Image: image.ImageAddon,
    Serialize: serialize.SerializeAddon,
  };
}

async function setupRenderer() {
  const params = new URLSearchParams(location.search);
  const wantGhostty = params.get("renderer") === "ghostty";
  if (wantGhostty) {
    try {
      const gh = await import("ghostty-web");
      if (typeof gh.init === "function") await gh.init();
      if (!gh.Terminal) throw new Error("ghostty-web: Terminal export missing");
      TerminalCtor = gh.Terminal;
      FitAddonCtor = null;
      RENDERER = "ghostty-web";
    } catch (err) {
      console.warn("[web-terminal] ghostty-web load failed, falling back:", err);
      await loadXterm();
    }
  } else {
    await loadXterm();
  }
}

// ---------------------------------------------------------------------------
// Theme + background settings
// ---------------------------------------------------------------------------
const PANE_BG_RGB = [10, 13, 18];
const TERM_THEME_BASE = {
  foreground: "#e6edf3",
  cursor: "#e6edf3",
  cursorAccent: "#0a0d12",
  selectionBackground: "rgba(47,129,247,0.35)",
  black: "#484f58", red: "#ff7b72", green: "#3fb950", yellow: "#d29922",
  blue: "#58a6ff", magenta: "#bc8cff", cyan: "#39c5cf", white: "#b1bac4",
  brightBlack: "#6e7681", brightRed: "#ffa198", brightGreen: "#56d364",
  brightYellow: "#e3b341", brightBlue: "#79c0ff", brightMagenta: "#d2a8ff",
  brightCyan: "#56d4dd", brightWhite: "#f0f6fc",
};

// E-ink palette: black on white, and every ANSI colour chosen so it stays
// distinguishable once the panel renders it in greyscale. That means picking by
// LUMINOSITY rather than hue — two colours that look different on an LCD can be
// the identical shade of grey on e-paper. Nothing is lighter than #6a6a6a, or
// it disappears against white.
// Every entry was generated from a hue plus a target GREYSCALE level, then
// checked for WCAG contrast against white (all ≥4.8:1). Picking by hue alone is
// the trap: red #ff0000 and green #00a000 look obviously different on an LCD
// and land on nearly the same grey on e-paper, which makes `git status` or a
// test run unreadable. Here red and green sit 32 grey levels apart.
const TERM_THEME_EINK = {
  foreground: "#000000",
  cursor: "#000000",
  cursorAccent: "#ffffff",
  selectionBackground: "#000000",
  selectionForeground: "#ffffff",
  black: "#000000",   red: "#6e1512",     green: "#227213",   yellow: "#725a13",
  blue: "#0c1c4b",    magenta: "#4f0d4f", cyan: "#105a65",    white: "#3d3d3d",
  brightBlack: "#636363", brightRed: "#9a1d19", brightGreen: "#288415",
  brightYellow: "#886c16", brightBlue: "#142e7b", brightMagenta: "#721372",
  brightCyan: "#15717f", brightWhite: "#000000",
};

// ---------------------------------------------------------------------------
// Theme registry
// ---------------------------------------------------------------------------
// The two built-ins and every Gogh palette are normalised to one shape, so the
// picker, the UI chrome and the xterm mapping all read the same fields.
//
// A Gogh theme is COLOURS ONLY — 16 ANSI slots plus background/foreground/
// cursor. It says nothing about typography, which is why the font lives in its
// own preference further down rather than travelling with the theme.
const XTERM_ANSI_KEYS = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow",
  "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
];

function normaliseBuiltin(id, name, variant, bg, t, special) {
  return {
    id, name, variant, special: special || null, builtin: true, author: "web-terminal",
    bg, fg: t.foreground, cursor: t.cursor,
    ansi: XTERM_ANSI_KEYS.map((k) => t[k]),
    extra: {
      cursorAccent: t.cursorAccent,
      selectionBackground: t.selectionBackground,
      selectionForeground: t.selectionForeground,
    },
  };
}

const THEMES = [
  normaliseBuiltin("wt-dark", "Web Terminal Dark", "dark", rgbToHex(PANE_BG_RGB), TERM_THEME_BASE),
  normaliseBuiltin("eink", "E-ink · e-paper", "light", "#ffffff", TERM_THEME_EINK, "eink"),
  ...GOGH_THEMES.map((t) => ({ ...t, special: null, builtin: false, extra: {} })),
];
const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

// The full Gogh catalog (~1250) is a separate ~400 KB file, fetched only when
// the picker opens or when the saved theme is not in the curated slice above.
// Curated themes keep their place at the top; a catalog entry with the same
// name as one already listed is skipped (upstream renames would otherwise
// show Tokyo Night twice).
let _allThemesPromise = null;
function loadAllThemes() {
  if (!_allThemesPromise) {
    _allThemesPromise = fetch("/gogh-themes-all.json", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        const names = new Set(THEMES.map((t) => t.name.toLowerCase()));
        for (const t of Array.isArray(list) ? list : []) {
          if (!t || THEME_BY_ID.has(t.id) || names.has(String(t.name).toLowerCase())) continue;
          const th = { ...t, special: null, builtin: false, extra: {} };
          THEMES.push(th);
          THEME_BY_ID.set(th.id, th);
        }
        return THEMES.length;
      })
      .catch(() => { _allThemesPromise = null; return THEMES.length; });
  }
  return _allThemesPromise;
}
// A theme id the user saved that the curated slice cannot resolve; boot loads
// the full catalog before painting when this is set.
let pendingThemeId = null;

// ---------------------------------------------------------------------------
// Fonts — a separate axis from the theme, on purpose (see above).
// ---------------------------------------------------------------------------
// Each stack names one font and then falls straight through to the generic
// monospace family. Chaining several real fonts as fallbacks would mean picking
// "Menlo" silently renders as something else on a machine that has both.
const FONT_STACKS = [
  { id: "jetbrains-mono", name: "JetBrains Mono", stack: '"JetBrains Mono", ui-monospace, monospace', served: true },
  { id: "sf-mono", name: "SF Mono", stack: '"SF Mono", "SFMono-Regular", ui-monospace, monospace' },
  { id: "menlo", name: "Menlo", stack: 'Menlo, ui-monospace, monospace' },
  { id: "monaco", name: "Monaco", stack: 'Monaco, ui-monospace, monospace' },
  { id: "fira-code", name: "Fira Code", stack: '"Fira Code", ui-monospace, monospace', served: true },
  { id: "cascadia-code", name: "Cascadia Code", stack: '"Cascadia Code", "Cascadia Mono", ui-monospace, monospace' },
  { id: "ibm-plex-mono", name: "IBM Plex Mono", stack: '"IBM Plex Mono", ui-monospace, monospace', served: true },
  { id: "source-code-pro", name: "Source Code Pro", stack: '"Source Code Pro", ui-monospace, monospace' },
  { id: "hack", name: "Hack", stack: 'Hack, ui-monospace, monospace' },
  { id: "inconsolata", name: "Inconsolata", stack: 'Inconsolata, ui-monospace, monospace' },
  { id: "roboto-mono", name: "Roboto Mono", stack: '"Roboto Mono", ui-monospace, monospace' },
  { id: "ubuntu-mono", name: "Ubuntu Mono", stack: '"Ubuntu Mono", ui-monospace, monospace' },
  { id: "iosevka", name: "Iosevka", stack: 'Iosevka, ui-monospace, monospace', served: true },
  { id: "berkeley-mono", name: "Berkeley Mono", stack: '"Berkeley Mono", ui-monospace, monospace' },
  { id: "courier-new", name: "Courier New", stack: '"Courier New", monospace' },
  { id: "system-mono", name: "System default", stack: 'ui-monospace, monospace' },
];
const FONT_BY_ID = new Map(FONT_STACKS.map((f) => [f.id, f]));
const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 32;

// ---------------------------------------------------------------------------
// Preferences — stored per ACCOUNT on the server, cached per browser
// ---------------------------------------------------------------------------
// The server inlines the account's prefs into the HTML (window.__WT_PREFS__)
// and app.html applies them before the first paint, so switching machines
// carries the look across with no flash of the wrong theme. localStorage is
// only the fallback for when the page is served from cache.
const PREFS_KEY = "wt.prefs.v1";
const LEGACY_THEME_KEY = "wt.theme";
const DEFAULT_PREFS = { themeId: "wt-dark", fontFamily: "jetbrains-mono", fontSize: 13 };
const prefs = { ...DEFAULT_PREFS };

// Returns only the fields that are actually valid here — an unknown theme id
// (a Gogh theme dropped from the curated list, say) falls back to the default
// instead of rendering an undefined palette.
function validPrefs(raw) {
  const out = {};
  if (raw && typeof raw === "object") {
    if (THEME_BY_ID.has(raw.themeId)) out.themeId = raw.themeId;
    if (FONT_BY_ID.has(raw.fontFamily)) out.fontFamily = raw.fontFamily;
    const n = Math.round(Number(raw.fontSize));
    if (Number.isFinite(n) && n >= FONT_SIZE_MIN && n <= FONT_SIZE_MAX) out.fontSize = n;
  }
  return out;
}

function loadPrefs() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(PREFS_KEY) || "null"); } catch (_) {}
  if (!cached) {
    // Migrate the pre-Gogh single-key setting, so an existing e-ink choice
    // survives the upgrade instead of silently reverting to dark.
    try {
      const legacy = localStorage.getItem(LEGACY_THEME_KEY);
      if (legacy === "eink") cached = { themeId: "eink" };
      else if (legacy === "dark") cached = { themeId: "wt-dark" };
    } catch (_) {}
  }
  Object.assign(prefs, validPrefs(cached));
  // Server last: it is per-account and therefore authoritative over a cache
  // that belongs to whichever browser happens to be in front of you.
  Object.assign(prefs, validPrefs(window.__WT_PREFS__));
  const wanted = (window.__WT_PREFS__ && window.__WT_PREFS__.themeId) || (cached && cached.themeId);
  pendingThemeId = typeof wanted === "string" && !THEME_BY_ID.has(wanted) ? wanted : null;
}

let _prefsPostTimer = null;
function savePrefs(patch) {
  Object.assign(prefs, validPrefs({ ...prefs, ...patch }));
  // bg/fg/variant are denormalised paint hints for the pre-paint script in
  // app.html, which cannot resolve a theme id without loading the whole bundle.
  // They are cached data, never the source of truth — validPrefs ignores them
  // on the way back in.
  const th = currentTheme();
  const payload = { ...prefs, bg: th.bg, fg: th.fg, variant: th.variant };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(payload)); } catch (_) {}
  // Debounced: dragging the font-size slider would otherwise be one POST per pixel.
  if (_prefsPostTimer) clearTimeout(_prefsPostTimer);
  _prefsPostTimer = setTimeout(() => {
    _prefsPostTimer = null;
    fetch("/api/prefs", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, 400);
}

function currentTheme() {
  return THEME_BY_ID.get(prefs.themeId) || THEME_BY_ID.get("wt-dark");
}

function isEink() {
  return currentTheme().special === "eink";
}

function currentFont() {
  return FONT_BY_ID.get(prefs.fontFamily) || FONT_STACKS[0];
}

// iPadOS ships none of JetBrains Mono, Fira Code, Cascadia or Hack, so most of
// this list silently renders as the ui-monospace fallback there. Saying so in
// the picker is the difference between "this font does nothing" and "that font
// isn't installed on this device".
const _fontAvail = new Map();
function fontIsAvailable(f) {
  if (f.id === "system-mono") return true;   // by definition
  if (f.served) return true;                 // shipped in /fonts (scripts/build.js)
  if (_fontAvail.has(f.id)) return _fontAvail.get(f.id);
  const first = /^"?([^",]+)"?/.exec(f.stack);
  const ok = first ? measureFontPresent(first[1].trim()) : true;
  _fontAvail.set(f.id, ok);
  return ok;
}

// document.fonts.check() is NOT usable for this: it answers "could this be
// rendered", and the fallback always can, so it returns true even for a font
// name that is pure nonsense. Measure instead — set a probe in `name, generic`
// and compare it against the generic alone. Identical widths across three
// different generics means the browser fell back every time, i.e. the font is
// not installed. Long, mixed-width text makes the difference obvious.
function measureFontPresent(name) {
  const probe = document.createElement("span");
  probe.textContent = "mmmmmmmmmmlliWWWW@1234";
  probe.style.cssText =
    "position:absolute;left:-9999px;top:-9999px;white-space:pre;font-size:72px;";
  document.body.appendChild(probe);
  let present = false;
  for (const base of ["monospace", "serif", "sans-serif"]) {
    probe.style.fontFamily = base;
    const baseline = probe.getBoundingClientRect().width;
    probe.style.fontFamily = `"${name}", ${base}`;
    if (Math.abs(probe.getBoundingClientRect().width - baseline) > 0.5) { present = true; break; }
  }
  probe.remove();
  return present;
}

// --- small colour helpers, used to derive the UI chrome from a palette ------
function rgbToHex(rgb) {
  return "#" + rgb.map((n) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, "0")).join("");
}
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixRgb(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}
function rgbCss(rgb) { return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`; }

// On a light palette the bright ANSI slots are washed out against the paper —
// bright yellow on white is close to invisible. Pick the dim slot there and the
// bright one on dark, which is the pairing each family was designed around.
function accentOf(th) {
  return th.variant === "light" ? (th.ansi[4] || th.ansi[12]) : (th.ansi[12] || th.ansi[4]);
}

const CHROME_VARS = [
  "--bg", "--bg-elev", "--bg-elev-2", "--pane-bg-rgb", "--fg", "--muted",
  "--border", "--border-strong", "--accent", "--accent-hover", "--error",
  "--success", "--warning", "--pane-active",
];

// The built-ins keep the hand-written values in style.css — the e-ink palette in
// particular was tuned by greyscale luminosity and must not be re-derived by a
// generic formula. Only Gogh themes get computed chrome.
function applyChromeVars(th) {
  const r = document.documentElement;
  if (th.builtin) {
    for (const v of CHROME_VARS) r.style.removeProperty(v);
    return;
  }
  const bg = hexToRgb(th.bg);
  const fg = hexToRgb(th.fg);
  const light = th.variant === "light";
  const accent = accentOf(th);
  const set = (k, v) => r.style.setProperty(k, v);
  set("--bg", th.bg);
  set("--bg-elev", rgbCss(mixRgb(bg, fg, 0.07)));
  set("--bg-elev-2", rgbCss(mixRgb(bg, fg, 0.12)));
  set("--pane-bg-rgb", bg.join(", "));
  set("--fg", th.fg);
  set("--muted", rgbCss(mixRgb(bg, fg, 0.58)));
  set("--border", rgbCss(mixRgb(bg, fg, 0.20)));
  set("--border-strong", rgbCss(mixRgb(bg, fg, 0.34)));
  set("--accent", accent);
  set("--accent-hover", light ? (th.ansi[12] || accent) : (th.ansi[4] || accent));
  set("--error", light ? th.ansi[1] : (th.ansi[9] || th.ansi[1]));
  set("--success", light ? th.ansi[2] : (th.ansi[10] || th.ansi[2]));
  set("--warning", light ? th.ansi[3] : (th.ansi[11] || th.ansi[3]));
  set("--pane-active", accent);
}

function applyUiTheme() {
  const th = currentTheme();
  document.documentElement.setAttribute("data-theme", th.special === "eink" ? "eink" : th.variant);
  applyChromeVars(th);
  applyThemeColor();
  // Repaint any terminal that already exists. Runs before `tabs` is built on
  // the very first call, hence the guard.
  if (typeof tabs === "undefined" || !tabs) return;
  const t = termTheme();
  for (const tab of tabs) {
    forEachPane(tab.layoutRoot, (p) => {
      if (p.term && p.term.options) {
        try { p.term.options.theme = t; } catch (_) {}
      }
    });
  }
}

// Remembered so the e-ink toggle can put back the palette you were using rather
// than dumping you on the default. Deliberately not persisted: it is a
// this-session convenience, not a preference.
let preEinkThemeId = null;

function setUiTheme(id) {
  if (!THEME_BY_ID.has(id)) return;
  if (id === "eink" && prefs.themeId !== "eink") preEinkThemeId = prefs.themeId;
  savePrefs({ themeId: id });
  applyUiTheme();
}

// Applies the font to every live pane. xterm needs a refit afterwards: the
// character cell changed size, so the cols/rows it reported to the PTY are now
// wrong and full-screen apps would draw to the old geometry.
function applyFontSettings() {
  const f = currentFont();
  const r = document.documentElement;
  r.style.setProperty("--term-font", f.stack);
  r.style.setProperty("--term-font-size", prefs.fontSize + "px");
  if (typeof tabs === "undefined" || !tabs) return;
  const each = (fn) => { for (const tab of tabs) forEachPane(tab.layoutRoot, fn); };
  each((p) => p.refreshFont());
  fontReady(f).then(() => { if (currentFont() === f) each((p) => p.refreshFont()); });
}

// Served fonts download on first use, and xterm measures its cell size from
// whatever is loaded at that moment: render with the fallback, then the real
// face arrives and every glyph sits on the wrong grid. So load regular + bold
// explicitly, then make each pane re-measure.
const _fontLoads = new Map();
function fontReady(f) {
  if (!f.served || !document.fonts || !document.fonts.load) return Promise.resolve();
  if (!_fontLoads.has(f.id)) {
    const fam = /^"?([^",]+)"?/.exec(f.stack)[1];
    _fontLoads.set(f.id, Promise.all([
      document.fonts.load(`400 16px "${fam}"`),
      document.fonts.load(`700 16px "${fam}"`),
    ]).catch(() => {}));
  }
  return _fontLoads.get(f.id);
}

function setFont(patch) {
  savePrefs(patch);
  applyFontSettings();
}

// Drops mouse reports whose coordinates came out as NaN.
//
// xterm derives mouse-report coordinates from event.clientX/clientY. A touch
// event carries neither, so on a phone the numbers come out NaN — and xterm's
// own clamp cannot rescue them, because Math.min(Math.max(NaN, 1), cols) is
// still NaN. It then encodes ESC[<b;NaN;NaNM and sends that to the PTY, where
// any application with mouse tracking on (Claude Code, vim, htop, less) hands
// it to the shell, which echoes it. That is the "aN;NaNMaN;NaNM…" garbage
// spraying across the screen.
//
// Dropping is the whole fix, not a workaround: iOS also synthesises a normal
// mouse event for the same tap, and THAT one has real coordinates and produces
// a correct report. Only the broken duplicate goes in the bin.
//
// Matched narrowly on the SGR mouse prefix so that typing or pasting the literal
// text "NaN" — perfectly ordinary input — is never touched.
function isBrokenMouseReport(d) {
  return d.indexOf("NaN") !== -1 && d.indexOf("\x1b[<") !== -1;
}

// ---------------------------------------------------------------------------
// Phone key bar (Termux-style extra keys)
// ---------------------------------------------------------------------------
// A phone's on-screen keyboard has no Esc, no Tab, no Ctrl and no arrows, so a
// terminal on one is stuck: no vim, no Ctrl-C, no shell history. This is the
// same two-row layout Termux ships by default.
//
// Only rendered on phone-sized viewports — see the media queries in style.css.
// An iPad has room for a real keyboard and does not need the screen taken away.
// Termux's default seven, plus two: enter (asked for) and the pipe, which the
// iOS keyboard buries two layers deep and a shell needs constantly. Both rows
// are eight wide on purpose — with flex:1 keys, a 7 and an 8 row would render at
// visibly different widths.
const KEYBAR_ROWS = [
  // The four arrows form an inverted-T: ↑ sits directly above ↓, with ← and →
  // flanking it, so the cluster reads as a real d-pad instead of scattered
  // glyphs. Everything else fills the remaining columns; both rows are eight
  // wide so flex:1 keys line up.
  [
    { label: "esc", key: "esc" },
    { label: "/", text: "/" },
    { label: "-", text: "-" },
    { label: "|", text: "|" },
    { label: "↑", key: "up" },        // column 5 — directly over ↓ below
    { label: "home", key: "home" },
    { label: "end", key: "end" },
    { label: "pgup", key: "pgup" },
  ],
  [
    { label: "tab", key: "tab" },
    { label: "ctrl", mod: "ctrl" },
    { label: "alt", mod: "alt" },
    { label: "←", key: "left" },
    { label: "↓", key: "down" },      // column 5 — under ↑
    { label: "→", key: "right" },
    { label: "pgdn", key: "pgdn" },
    // Bottom right, where it sits on a real keyboard. `big` because the glyph
    // is intrinsically small in a mono face and this is the most-pressed key.
    { label: "⏎", key: "enter", big: true },
  ],
];

// null = off, "armed" = applies to the next key then clears, "locked" = stays on
// until tapped again. Termux's double-tap-to-lock, which is what makes Ctrl-C
// followed by Ctrl-C bearable.
const stickyMods = { ctrl: null, alt: null };

// Cursor and edit keys change shape depending on DECCKM: an app that turned on
// application cursor keys (vim, less) expects ESC O A where the shell expects
// ESC [ A. Sending the wrong one prints stray letters instead of moving.
function seqFor(name, term) {
  const app = !!(term && term.modes && term.modes.applicationCursorKeysMode);
  const csi = app ? "\x1bO" : "\x1b[";
  switch (name) {
    case "esc": return "\x1b";
    case "tab": return "\t";
    // CR, not LF: a PTY in canonical mode ends a line on carriage return.
    case "enter": return "\r";
    case "up": return csi + "A";
    case "down": return csi + "B";
    case "right": return csi + "C";
    case "left": return csi + "D";
    case "home": return csi + "H";
    case "end": return csi + "F";
    case "pgup": return "\x1b[5~";
    case "pgdn": return "\x1b[6~";
    default: return "";
  }
}

// Ctrl+<letter> is the letter with the top three bits cleared: Ctrl-C is 0x03.
// Alt+<key> is the key prefixed with ESC, which is how terminals have always
// encoded Meta.
function applyMods(base) {
  let out = base;
  if (stickyMods.ctrl && out.length === 1) {
    const c = out.toUpperCase().charCodeAt(0);
    if (c >= 63 && c <= 95) out = String.fromCharCode(c & 0x1f);
    else if (c >= 97 && c <= 122) out = String.fromCharCode(c & 0x1f);
  }
  if (stickyMods.alt) out = "\x1b" + out;
  return out;
}

function clearArmedMods() {
  let changed = false;
  for (const m of ["ctrl", "alt"]) {
    if (stickyMods[m] === "armed") { stickyMods[m] = null; changed = true; }
  }
  if (changed) renderKeyBarState();
}

// Called from the panes' custom key handler. Returns the bytes to send when a
// sticky modifier is pending, or null to let xterm handle the key normally.
function consumeStickyMods(e) {
  if (!stickyMods.ctrl && !stickyMods.alt) return null;
  // Modifier keys themselves must not consume the arming.
  if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return null;
  let base;
  if (e.key === "Enter") base = "\r";
  else if (e.key === "Tab") base = "\t";
  else if (e.key === "Backspace") base = "\x7f";
  else if (e.key && e.key.length === 1) base = e.key;
  else return null;   // arrows and F-keys: leave them to xterm
  const out = applyMods(base);
  clearArmedMods();
  e.preventDefault();
  return out;
}

function renderKeyBarState() {
  const bar = document.getElementById("keybar");
  if (!bar) return;
  bar.querySelectorAll("button[data-mod]").forEach((b) => {
    const state = stickyMods[b.getAttribute("data-mod")];
    b.classList.toggle("armed", state === "armed");
    b.classList.toggle("locked", state === "locked");
  });
}

function pressKeyBarButton(spec) {
  const pane = activePane;
  if (!pane) return;

  if (spec.mod) {
    // off → armed → locked → off. Two taps to lock is Termux's behaviour and
    // it is what makes repeated Ctrl-C tolerable.
    const cur = stickyMods[spec.mod];
    stickyMods[spec.mod] = cur === null ? "armed" : cur === "armed" ? "locked" : null;
    renderKeyBarState();
    return;
  }

  const base = spec.text != null ? spec.text : seqFor(spec.key, pane.term);
  // A modifier only combines with a literal character. Ctrl+↑ has its own CSI
  // encoding that nothing here needs, so arrows ignore the sticky state.
  const send = spec.text != null ? applyMods(base) : base;
  pane.sendInput(send);
  clearArmedMods();
}

// Collapsed state is per device, like zen: the bar is worth its space on a
// phone you are actually typing on, and in the way when you are only reading.
const KEYBAR_KEY = "wt.keybar.collapsed.v1";
let keybarCollapsed = false;
try { keybarCollapsed = localStorage.getItem(KEYBAR_KEY) === "1"; } catch (_) {}

function applyKeybarCollapsed() {
  const bar = document.getElementById("keybar");
  if (!bar) return;
  bar.classList.toggle("collapsed", keybarCollapsed);
  const h = document.getElementById("keybar-toggle");
  if (h) {
    h.innerHTML = keybarCollapsed ? icon("keyboard") : icon("chevronDown");
    h.setAttribute("aria-label", keybarCollapsed ? "Show keys" : "Hide keys");
  }
  // The terminal just gained or lost ~76px.
  requestAnimationFrame(() =>
    forEachPane(getLayoutRoot(), (p) => { try { p.fitNow(); } catch (_) {} }));
}

function setKeybarCollapsed(on) {
  keybarCollapsed = !!on;
  try { localStorage.setItem(KEYBAR_KEY, keybarCollapsed ? "1" : "0"); } catch (_) {}
  applyKeybarCollapsed();
}

function installKeyBar() {
  const bar = document.getElementById("keybar");
  if (!bar) return;

  // Handle row: collapse on the left, dismiss-keyboard on the right. Kept out of
  // the 7-wide grid so the Termux layout stays exactly as people know it.
  const handle = document.createElement("div");
  handle.className = "keybar-handle";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.id = "keybar-toggle";
  toggle.className = "keybar-handle-btn";
  const hideKb = document.createElement("button");
  hideKb.type = "button";
  hideKb.className = "keybar-handle-btn";
  hideKb.innerHTML = icon("chevronsDown") + icon("keyboard");
  hideKb.title = "Hide the on-screen keyboard";
  hideKb.setAttribute("aria-label", "Hide the on-screen keyboard");
  // Copy: opens an overlay with the terminal text where iOS's own selection
  // works (see openCopyOverlay). A canvas cannot be selected on touch, so this
  // button is the reliable way in; a long-press on the terminal opens it too.
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "keybar-handle-btn";
  copyBtn.innerHTML = icon("copy", 14) + "<span>copiar</span>";
  copyBtn.title = "Copiar texto de la terminal";
  copyBtn.setAttribute("aria-label", "Copiar texto de la terminal");
  handle.appendChild(toggle);
  handle.appendChild(document.createElement("span")).className = "spacer";
  // Attach: a phone has no drag & drop and iOS will not paste an image into a
  // web page reliably, so pick from Photos/Files instead.
  const attachBtn = document.createElement("button");
  attachBtn.type = "button";
  attachBtn.className = "keybar-handle-btn";
  attachBtn.innerHTML = icon("paperclip", 14) + "<span>imagen</span>";
  attachBtn.title = "Subir una imagen y escribir su ruta";
  attachBtn.setAttribute("aria-label", "Subir una imagen");
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*";
  picker.multiple = true;
  picker.hidden = true;
  handle.appendChild(toggle);
  handle.appendChild(document.createElement("span")).className = "spacer";
  handle.appendChild(copyBtn);
  handle.appendChild(attachBtn);
  handle.appendChild(picker);
  handle.appendChild(document.createElement("span")).className = "spacer";
  handle.appendChild(hideKb);
  bar.appendChild(handle);

  // click, not pointerdown: iOS only opens a file picker from a real click.
  attachBtn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    picker.value = "";
    picker.click();
  });
  picker.addEventListener("change", () => {
    if (activePane && picker.files && picker.files.length) activePane.uploadImages(picker.files);
  });

  copyBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (activePane) openCopyOverlay(activePane);
  });

  toggle.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation();
    setKeybarCollapsed(!keybarCollapsed);
  });
  // Blurring the hidden textarea is what actually lowers the iOS keyboard —
  // and with it the AutoFill strip, which is the only way to get that space
  // back short of turning AutoFill off in iOS Settings.
  hideKb.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation();
    const ta = document.querySelector(".xterm-helper-textarea");
    if (ta) { try { ta.blur(); } catch (_) {} }
  });

  const keys = document.createElement("div");
  keys.className = "keybar-keys";
  bar.appendChild(keys);

  for (const row of KEYBAR_ROWS) {
    const el = document.createElement("div");
    el.className = "keybar-row";
    for (const spec of row) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "keybar-key" + (spec.mod ? " keybar-mod" : "") + (spec.big ? " keybar-big" : "");
      const KEY_ICONS = { up: "arrowUp", down: "arrowDown", left: "arrowLeft", right: "arrowRight", enter: "enter" };
      if (KEY_ICONS[spec.key]) {
        b.innerHTML = icon(KEY_ICONS[spec.key], spec.big ? 18 : 15);
        b.setAttribute("aria-label", spec.key);
      } else {
        b.textContent = spec.label;
      }
      if (spec.mod) b.setAttribute("data-mod", spec.mod);
      // pointerdown with preventDefault, not click: it stops the button from
      // taking focus, which would otherwise dismiss the keyboard mid-typing.
      // And no focus() afterwards, deliberately — keys go straight to the PTY
      // via sendInput, so focus buys nothing, while focusing is precisely what
      // pops the iOS keyboard and its AutoFill strip open. Pressing PgUp to
      // scroll should not cost you half the screen.
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        pressKeyBarButton(spec);
      });
      el.appendChild(b);
    }
    keys.appendChild(el);
  }
  renderKeyBarState();
  applyKeybarCollapsed();

  // The bar appears and disappears with orientation on a phone, and it costs
  // real rows either way, so the PTY has to be told the new geometry.
  const mq = window.matchMedia("(max-width: 500px), (max-height: 500px)");
  const onChange = () => requestAnimationFrame(() =>
    forEachPane(getLayoutRoot(), (p) => { try { p.fitNow(); } catch (_) {} }));
  if (mq.addEventListener) mq.addEventListener("change", onChange);
}

// ---------------------------------------------------------------------------
// Zen mode — hide every bar and give the terminal the whole viewport
// ---------------------------------------------------------------------------
// Stored per DEVICE, not per account, and that is deliberate: zen is worth it on
// an iPad where 90px of chrome is several rows of output, and usually not worth
// it on a large monitor. Syncing it through /api/prefs like the theme would mean
// turning it on once and losing your tab bar everywhere.
const ZEN_KEY = "wt.zen.v1";
let zenMode = false;
try { zenMode = localStorage.getItem(ZEN_KEY) === "1"; } catch (_) {}

function applyZen() {
  // On documentElement, not body: app.html sets it before the first paint, and
  // <body> does not exist yet at that point.
  document.documentElement.classList.toggle("zen", zenMode);
  // Every pane just gained or lost the height of two bars, so the cols/rows the
  // PTY thinks it has are stale. Wait a frame for layout to settle first.
  requestAnimationFrame(() => {
    forEachPane(getLayoutRoot(), (p) => { try { p.fitNow(); } catch (_) {} });
  });
}

function setZen(on) {
  zenMode = !!on;
  try { localStorage.setItem(ZEN_KEY, zenMode ? "1" : "0"); } catch (_) {}
  applyZen();
  // Leaving the keyboard up matters on iPad: toggling zen should not cost you
  // the shell you were typing into.
  if (activePane && activePane.term) { try { activePane.term.focus(); } catch (_) {} }
}

function installZen() {
  const btn = document.getElementById("zen-exit");
  if (btn) btn.addEventListener("click", (e) => { e.stopPropagation(); setZen(false); });
  applyZen();
}

// ---------------------------------------------------------------------------
// iOS viewport / soft keyboard
// ---------------------------------------------------------------------------
// On iOS Safari the layout viewport does NOT shrink when the on-screen keyboard
// appears. Only the *visual* viewport does, and the page is scrolled up behind
// the keyboard. A terminal sized to 100% (or even 100dvh) therefore keeps
// drawing its bottom rows under the keyboard, where the prompt lives.
//
// The fix is to size the app to visualViewport.height and undo the scroll the
// browser applied. Desktop browsers never enter the branch that matters: their
// visual and layout viewports agree, so --app-height simply tracks the window.
function installViewportFit() {
  const vv = window.visualViewport;
  if (!vv) return;   // older Safari — the CSS fallback of 100% still applies

  let raf = 0;
  const sync = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = 0;
      // A pinch-zoom shrinks the visual viewport exactly the way a keyboard
      // does, and the two are indistinguishable by size alone — but only zoom
      // changes `scale`. Resizing the app while someone is zoomed in would
      // reflow the terminal out from under them, so leave it alone.
      if ((vv.scale || 1) > 1.01) return;
      document.documentElement.style.setProperty("--app-height", vv.height + "px");
      // iOS keeps reporting safe-area-inset-bottom as ~34px while the keyboard
      // is up, even though the home indicator is not on screen then — the
      // keyboard is. Paying that inset under the key bar wastes a whole row of
      // terminal for nothing, so flag the state and let CSS drop it.
      const keyboardUp = window.innerHeight - vv.height > 100;
      document.documentElement.classList.toggle("kb-open", keyboardUp);
      // Safari leaves the page scrolled after the keyboard animates in, which
      // slides the tab bar off the top of the screen for good.
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
      // The pane is a different number of rows now; the PTY has to be told.
      forEachPane(getLayoutRoot(), (p) => p.fitDebounced());
    });
  };

  vv.addEventListener("resize", sync);
  vv.addEventListener("scroll", sync);
  // Rotation reports the old size for a frame or two on iOS, so re-sync after
  // the animation instead of trusting the first event.
  window.addEventListener("orientationchange", () => {
    sync();
    setTimeout(sync, 250);
    setTimeout(sync, 600);
  });
  sync();
}

// Shrinks the iOS keyboard accessory bar from "‹ › ✓" down to just "✓".
//
// Safari puts a toolbar above the keyboard whenever a field is focused. The ‹ ›
// arrows are only added when the DOCUMENT has more than one focusable element —
// and this page has about twenty buttons (sixteen keys, the collapse toggle, the
// tabs, the menu, the zen exit). Take them out of the tab order and the arrows
// go with them.
//
// The ✓ stays. Safari offers no way to remove it from a web page or a PWA; that
// is only possible inside a native wrapper such as Capacitor. See the notes in
// the commit message for sources.
//
// Touch only. On a desktop or an iPad with a keyboard, tabbing between controls
// is a real navigation method and must not be broken to save 40px on a phone.
// tabindex="-1" does not affect VoiceOver, which walks the accessibility tree
// rather than the tab order, so the controls stay reachable either way.
function installSingleFocusable() {
  if (!window.matchMedia("(hover: none)").matches) return;

  const SEL = 'button, [href], [tabindex]:not([tabindex="-1"]), select, input';

  const drop = (el) => {
    if (!el || el.nodeType !== 1) return;
    if (el.classList && el.classList.contains("xterm-helper-textarea")) return;
    if (el.getAttribute("tabindex") !== "-1") el.setAttribute("tabindex", "-1");
  };
  // The subtree AND the node itself: a freshly inserted <div class="pane"> that
  // carries its own tabindex is never returned by its own querySelectorAll.
  const strip = (root) => {
    if (root.matches && root.matches(SEL)) drop(root);
    if (root.querySelectorAll) for (const el of root.querySelectorAll(SEL)) drop(el);
  };
  strip(document.body);

  // Panes, tabs and modals are all created after boot, so a one-shot pass would
  // only hold until the first new tab.
  new MutationObserver((records) => {
    for (const r of records) {
      for (const node of r.addedNodes) strip(node);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

// Keeps the iOS status bar and the Android task-switcher card tinted to match
// the palette. app.html sets it for the first paint; this follows every change.
function applyThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const th = currentTheme();
  meta.setAttribute("content", th.special === "eink" ? "#ffffff" : th.bg);
}

// Registering fails outright on an insecure origin, which is exactly what the
// Tailscale/LAN path is. Checking isSecureContext keeps that path quiet instead
// of throwing on every load.
function installServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  const register = () => navigator.serviceWorker.register("/sw.js").catch((e) => {
    console.warn("[web-terminal] service worker registration failed:", e);
  });
  // main() is an async module script that awaits the workspace fetch, so `load`
  // has almost always fired by the time we get here. Waiting for an event that
  // already happened means never registering at all.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

const BG_KEY = "wt.bg.v1";
const bgSettings = { opacity: 1, image: "", blur: 0, brightness: 1 };

function loadBgSettings() {
  try {
    const v = localStorage.getItem(BG_KEY);
    if (v) Object.assign(bgSettings, JSON.parse(v));
  } catch (_) {}
}
function saveBgSettings() {
  try { localStorage.setItem(BG_KEY, JSON.stringify(bgSettings)); } catch (_) {}
}
function termTheme() {
  const th = currentTheme();
  if (th.special === "eink") {
    // Opaque white on purpose: translucency and background images turn into
    // grey mud on e-paper and wreck the contrast the mode exists for.
    return { ...TERM_THEME_EINK, background: "#ffffff" };
  }
  const t = { foreground: th.fg, cursor: th.cursor };
  XTERM_ANSI_KEYS.forEach((k, i) => { t[k] = th.ansi[i]; });
  // Gogh files carry no cursorAccent or selection colours. The cursor is drawn
  // by filling its cell with `cursor` and painting the glyph in cursorAccent, so
  // defaulting that to the background is what keeps the character legible.
  t.cursorAccent = th.extra.cursorAccent || th.bg;
  t.selectionBackground = th.extra.selectionBackground || hexAlpha(accentOf(th), 0.35);
  if (th.extra.selectionForeground) t.selectionForeground = th.extra.selectionForeground;
  const a = clamp01(bgSettings.opacity);
  t.background = `rgba(${hexToRgb(th.bg).join(",")},${a})`;
  return t;
}
function hexAlpha(hex, a) {
  return `rgba(${hexToRgb(hex).join(",")},${a})`;
}
function clamp01(n) { n = Number(n); if (!Number.isFinite(n)) return 1; return Math.max(0, Math.min(1, n)); }

function applyBgSettings() {
  const r = document.documentElement;
  r.style.setProperty("--pane-bg-alpha", String(clamp01(bgSettings.opacity)));
  if (bgSettings.image) {
    document.body.classList.add("has-bg-image");
    r.style.setProperty("--bg-image", `url("${cssEscape(bgSettings.image)}")`);
    r.style.setProperty("--bg-blur", `${Math.max(0, bgSettings.blur || 0)}px`);
    r.style.setProperty("--bg-brightness", String(Math.max(0.1, bgSettings.brightness || 1)));
  } else {
    document.body.classList.remove("has-bg-image");
    r.style.removeProperty("--bg-image");
    r.style.removeProperty("--bg-blur");
    r.style.removeProperty("--bg-brightness");
  }
  // Update theme on every live terminal so the canvas alpha matches.
  const newTheme = termTheme();
  for (const tab of tabs) {
    forEachPane(tab.layoutRoot, (p) => {
      if (p.term && p.term.options) {
        try { p.term.options.theme = newTheme; } catch (_) {}
        p.syncWebgl();
        try { p.fitNow(); } catch (_) {}
      }
    });
  }
}
// ONE way to copy, on purpose.
//
// The terminal paints into a canvas, so its selection is not a DOM selection
// and the browser cannot copy anything by itself — we must hand it the text.
// There used to be several routes stacked on top of each other, and they fought:
//
//   * navigator.clipboard.writeText() is refused outright by Chrome and Brave
//     here (`NotAllowedError: Write permission denied`), and it fails
//     asynchronously, so any fallback chained to its .catch() runs outside the
//     user gesture, where it is refused too. Result: nothing copied at all.
//   * a document-level `copy` listener looks tempting, but execCommand("copy")
//     itself fires a `copy` event, which re-entered that listener. It then read
//     the xterm selection *again* — after the hidden textarea had already stolen
//     focus and disturbed it — and overwrote the clipboard with a partial copy.
//     That is why pasting produced half the text.
//
// So: the plain, boring, universally supported route — put the text in a real
// textarea, select it, let the browser copy it. Nothing else.
//
// In particular there is NO `copy` listener calling preventDefault(). Doing that
// cancels the browser's own write and makes it our job to fill clipboardData;
// it reported success while the macOS pasteboard stayed empty. Cancelling a copy
// you asked for is how you end up with "dice Copiado y no pega nada".
//
// Beware when testing this: a headless browser has its own in-process
// clipboard, so it will happily confirm a copy that never reached the OS.
// Verify with a real window and `pbpaste`.
// Copy on touch, done the way the xterm.js community settled on (issue #3727):
// a phone cannot select a <canvas>, and forcing selection over it fights iOS and
// loses. So instead we lift the terminal's text into a readonly <textarea> in an
// overlay, where iOS's OWN selection works — handles, magnifier, and the native
// "Copy" menu the user already knows. Nothing to fight.
function terminalPlainText(term) {
  try {
    const buf = term.buffer.active;
    const out = [];
    for (let i = 0; i < buf.length; i++) {
      const line = buf.getLine(i);
      out.push(line ? line.translateToString(true) : "");
    }
    while (out.length && out[out.length - 1] === "") out.pop();
    return out.join("\n");
  } catch (_) {
    return "";
  }
}

let _copyOverlayOpen = false;
function openCopyOverlay(pane) {
  if (_copyOverlayOpen || !pane || !pane.term) return;
  _copyOverlayOpen = true;

  const text = terminalPlainText(pane.term);

  const root = document.getElementById("modal-root") || (() => {
    const d = document.createElement("div"); d.id = "modal-root"; document.body.appendChild(d); return d;
  })();
  root.innerHTML = "";

  const overlay = document.createElement("div");
  overlay.className = "modal-bg copy-overlay";

  const card = document.createElement("div");
  card.className = "modal-card copy-card";

  const head = document.createElement("div");
  head.className = "copy-head";
  head.innerHTML = '<span>Mantén el dedo sobre el texto para seleccionar, luego toca Copiar</span>';

  const ta = document.createElement("textarea");
  ta.className = "copy-ta";
  ta.readOnly = true;
  // These win over anything inherited: the textarea MUST stay selectable.
  ta.setAttribute("autocomplete", "off");
  ta.setAttribute("autocorrect", "off");
  ta.setAttribute("autocapitalize", "off");
  ta.setAttribute("spellcheck", "false");
  ta.value = text;

  const actions = document.createElement("div");
  actions.className = "modal-actions";
  actions.innerHTML =
    '<button class="modal-btn ghost" data-act="all">Copiar todo</button>' +
    '<button class="modal-btn" data-act="close">Cerrar</button>';

  card.appendChild(head);
  card.appendChild(ta);
  card.appendChild(actions);
  overlay.appendChild(card);
  root.appendChild(overlay);

  // Show the most recent output first.
  ta.scrollTop = ta.scrollHeight;

  const close = () => {
    root.innerHTML = "";
    document.removeEventListener("keydown", onEsc, true);
    _copyOverlayOpen = false;
    // Hand focus back to the terminal so typing continues.
    try { pane.term && pane.term.focus(); } catch (_) {}
  };
  function onEsc(ev) { if (ev.key === "Escape") close(); }

  actions.querySelector('[data-act="close"]').addEventListener("click", close);
  actions.querySelector('[data-act="all"]').addEventListener("click", () => {
    const ok = copyToClipboard(ta.value);
    if (ok) { close(); }
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", onEsc, true);
}

function copyToClipboard(text) {
  if (!text) return false;

  const ta = document.createElement("textarea");
  ta.value = text;
  // Must be on-screen and non-transparent for the engine to treat it as real
  // content, so park it under the viewport rather than hiding it.
  ta.style.cssText =
    "position:fixed;left:0;bottom:0;width:1px;height:1px;padding:0;" +
    "border:none;outline:none;box-shadow:none;background:transparent;" +
    "color:transparent;z-index:-1;";
  ta.setAttribute("aria-hidden", "true");
  ta.setAttribute("tabindex", "-1");
  document.body.appendChild(ta);

  const prev = document.activeElement;
  let ok = false;
  try {
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    ok = document.execCommand("copy");
  } catch (_) {
    ok = false;
  } finally {
    document.body.removeChild(ta);
    // Hand the keyboard back to the terminal or the next keystroke is lost.
    try {
      if (prev && prev.focus) prev.focus({ preventScroll: true });
    } catch (_) {}
  }
  return ok;
}

// xterm pads every selected row out to the full terminal width and keeps the
// blank rows inside the drag rectangle. Copying that verbatim gives trailing
// spaces on each line and a tail of empty lines.
function tidySelection(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

function cssEscape(s) {
  return String(s).replace(/[\\"]/g, "\\$&").replace(/\n/g, "\\A ");
}

// xterm's own override key for "select even though the app grabbed the mouse"
// differs by platform: Option on macOS (needs macOptionClickForcesSelection),
// Shift elsewhere.
const IS_MAC = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || "");

// ---------------------------------------------------------------------------
// Workspace = multiple tabs, each with its own layout tree of Splits + Panes.
// ---------------------------------------------------------------------------
let nextPaneId = 1;
let nextTabId = 1;
let activePane = null;

const tabs = [];          // [Tab]
let activeTabId = null;

function currentTab() { return tabs.find((t) => t.id === activeTabId) || null; }
function getLayoutRoot() { const t = currentTab(); return t ? t.layoutRoot : null; }
function setLayoutRoot(node) { const t = currentTab(); if (t) t.layoutRoot = node; }

class Tab {
  constructor(id, name, layoutRoot) {
    this.id = id;
    this.name = name;
    this.layoutRoot = layoutRoot;
    this.lastActivePaneId = null;
  }
}

class Pane {
  constructor(initialSessionId) {
    this.id = nextPaneId++;
    this.sessionId = initialSessionId || null;   // restored from layout, or null for fresh
    this.parent = null;
    this.term = null;
    this.fit = null;
    this.ws = null;
    this.ro = null;
    this.lastCols = 80;
    this.lastRows = 24;
    this.disposed = false;

    this.el = document.createElement("div");
    this.el.className = "pane";
    this.el.tabIndex = 0;

    const bar = document.createElement("div");
    bar.className = "pane-bar";

    this.titleEl = document.createElement("div");
    this.titleEl.className = "pane-title";
    this.titleEl.textContent = `term ${this.id}`;
    bar.appendChild(this.titleEl);

    const spacer = document.createElement("div");
    spacer.className = "spacer";
    bar.appendChild(spacer);

    bar.appendChild(btn("icon:splitRight", "Split right (Cmd/Ctrl+D)", () => splitPane(this, "row")));
    bar.appendChild(btn("icon:splitDown", "Split down (Cmd/Ctrl+Shift+D)", () => splitPane(this, "col")));
    const closeBtn = btn("icon:x", "Close pane (tap twice)", () => {
      if (confirmCloseTap(closeBtn)) closePane(this);
    }, "danger");
    bar.appendChild(closeBtn);

    this.el.appendChild(bar);

    const body = document.createElement("div");
    body.className = "pane-body";
    this.host = document.createElement("div");
    this.host.className = "term-host";
    body.appendChild(this.host);
    this.el.appendChild(body);

    this.statusEl = document.createElement("div");
    this.statusEl.className = "pane-status";
    this.el.appendChild(this.statusEl);

    this.el.addEventListener("mousedown", () => setActive(this), true);
    this.el.addEventListener("focusin", () => setActive(this));
    this.installImageDrop();

    // Touch: a tap has to both select the pane and focus the terminal, because
    // focusing xterm's hidden textarea is the only thing that raises the
    // on-screen keyboard. Without this the app opens on an iPad and there is no
    // way to type into it.
    //
    // Passive, and deliberately not preventDefault(): xterm needs the touch
    // events for its own scrolling and selection, and swallowing them here
    // would trade a keyboard for a terminal you cannot scroll.
    // A TAP focuses; a DRAG must not. Focusing a textarea on iOS opens the
    // keyboard and makes Safari scroll the field back into view — so focusing at
    // the end of every touch meant that scrolling up through output snapped you
    // straight back to the bottom. Which reads, correctly, as "scrolling is
    // broken". Track the movement and only focus if the finger stayed put.
    this.el.addEventListener("touchstart", (e) => {
      setActive(this);
      this.el.classList.add("touch-active");
      const t = e.touches && e.touches[0];
      this._tapFrom = t ? { x: t.clientX, y: t.clientY } : null;
    }, { passive: true });
    this.el.addEventListener("touchmove", (e) => {
      const from = this._tapFrom;
      const t = e.touches && e.touches[0];
      if (!from || !t) return;
      // 10px of slop: a finger never holds perfectly still on a tap.
      if (Math.abs(t.clientX - from.x) + Math.abs(t.clientY - from.y) > 10) this._tapFrom = null;
    }, { passive: true });
    this.el.addEventListener("touchend", () => {
      this.el.classList.remove("touch-active");
      const from = this._tapFrom;
      this._tapFrom = null;
      if (!from) return;   // it was a scroll gesture — leave the keyboard alone
      try { this.term && this.term.focus(); } catch (_) {}
    }, { passive: true });

    this.installTouchScroll();
    this.installCopyLongPress();
  }

  // A long-press (finger held ~500ms without moving) opens the copy overlay too,
  // for people who reach for the iOS gesture. It is only a shortcut — the keybar
  // "copiar" button is the guaranteed path, since iOS can cancel a touch
  // sequence at will. Just detects the hold; no dragging over the canvas.
  installCopyLongPress() {
    let timer = null;
    let from = null;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    this.host.addEventListener("touchstart", (e) => {
      const t = e.touches && e.touches[0];
      from = t ? { x: t.clientX, y: t.clientY } : null;
      cancel();
      if (!from) return;
      timer = setTimeout(() => {
        timer = null;
        openCopyOverlay(this);
      }, 500);
    }, { passive: true });
    this.host.addEventListener("touchmove", (e) => {
      const t = e.touches && e.touches[0];
      if (from && t && Math.abs(t.clientX - from.x) + Math.abs(t.clientY - from.y) > 12) cancel();
    }, { passive: true });
    this.host.addEventListener("touchend", cancel, { passive: true });
    this.host.addEventListener("touchcancel", cancel, { passive: true });
  }

  setStatus(text, isError) {
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle("error", !!isError);
    this._baseStatus = text;
  }

  // Full-screen apps can grab the mouse (DECSET 1000/1002/1003/1006). While
  // that is on, a drag is delivered to the application and selects nothing —
  // Claude Code does exactly this, which is why copying "worked outside Claude
  // and not inside". Watch the stream so we can tell the user what to do.
  trackMouseGrab(chunk) {
    if (chunk.indexOf("\x1b[?") === -1) return;
    const re = /\x1b\[\?([0-9;]+)([hl])/g;
    let m;
    while ((m = re.exec(chunk)) !== null) {
      const on = m[2] === "h";
      for (const mode of m[1].split(";")) {
        if (mode === "1000" || mode === "1002" || mode === "1003") {
          this.mouseGrab = on;
        }
      }
    }
  }

  // Called when a drag ends. If the app has the mouse and the user did not hold
  // the override key, nothing got selected — say why instead of leaving them
  // dragging in vain.
  hintIfMouseGrabbed(dragged, hadOverride) {
    if (!this.mouseGrab || !dragged || hadOverride) return;
    if (this.term && this.term.hasSelection && this.term.hasSelection()) return;
    const key = IS_MAC ? "⌥ Option" : "Mayús";
    this.flashStatus(`Esta app usa el ratón · mantén ${key} y arrastra para seleccionar`, false, 4000);
  }

  // Put xterm.js back into "plain shell" mode without touching the scrollback:
  // leave the alternate screen, stop mouse / focus / bracketed-paste reporting,
  // show the cursor and clear any lingering text attributes. Written locally,
  // never sent to the PTY.
  resetTerminalModes() {
    if (!this.term) return;
    try {
      this.term.write("\x1b[?1049l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1004l\x1b[?2004l\x1b[?25h\x1b[0m");
    } catch (_) {}
    this.mouseGrab = false;
  }

  // Show a message for a moment, then put the usual status line back.
  flashStatus(text, isError, ms) {
    const base = this._baseStatus != null ? this._baseStatus : this.statusEl.textContent;
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle("error", !!isError);
    if (this._flashTimer) clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this._flashTimer = null;
      this.statusEl.textContent = base;
      this.statusEl.classList.remove("error");
    }, ms || 1800);
  }

  loadAddons() {
    if (!XtermAddons) return;
    const A = XtermAddons;
    // Emoji and CJK take two cells; the default (Unicode 6) tables get many of
    // them wrong, which shifts everything after them on the line.
    try {
      this.term.loadAddon(new A.Unicode11());
      this.term.unicode.activeVersion = "11";
    } catch (_) {}
    try {
      this.term.loadAddon(new A.WebLinks((e, uri) => {
        // Plain click would fight selection and TUIs with mouse tracking;
        // require the platform modifier, like native terminals do.
        if (!(IS_MAC ? e.metaKey : e.ctrlKey)) return;
        const w = window.open(uri, "_blank", "noopener,noreferrer");
        if (w) w.opener = null;
      }));
    } catch (_) {}
    try {
      this.search = new A.Search();
      this.term.loadAddon(this.search);
    } catch (_) { this.search = null; }
    // OSC 52: lets vim/tmux/Claude Code put text on the clipboard. Write-only:
    // a process in the shell must never be able to READ the browser clipboard.
    // The constructor is (base64, provider) despite what the 0.1.0 typings
    // say; passing the provider first silently falls back to the default one,
    // which DOES read the clipboard.
    try {
      const pane = this;
      this.term.loadAddon(new A.Clipboard(undefined, {
        readText: () => "",
        writeText: async (_sel, text) => {
          if (!text) return;
          let ok = false;
          try {
            if (navigator.clipboard && window.isSecureContext) {
              await navigator.clipboard.writeText(text);
              ok = true;
            }
          } catch (_) {}
          // Insecure origin (LAN by IP) or permission refused: the keystroke
          // that made the app copy usually still counts as user activation.
          if (!ok) ok = copyToClipboard(text);
          pane.flashStatus(
            ok ? `Copiado por la app · ${text.length} caracteres` : "La app quiso copiar, pero el navegador no lo permitió",
            !ok,
          );
        },
      }));
    } catch (_) {}
    try {
      this.serializer = new A.Serialize();
      this.term.loadAddon(this.serializer);
    } catch (_) { this.serializer = null; }
    this.installProgress();
    this.syncWebgl();
  }

  // Inline images: Sixel and the iTerm2 protocol (imgcat, chafa, yazi…).
  // The addon hooks the renderer that is active when it loads, so it must be
  // (re)loaded after every renderer switch — syncWebgl() calls this. Capped so
  // a runaway stream cannot eat the tab's memory.
  reloadImageAddon() {
    if (!XtermAddons || !this.term) return;
    try { this.imageAddon && this.imageAddon.dispose(); } catch (_) {}
    try {
      this.imageAddon = new XtermAddons.Image({ storageLimit: 64, pixelLimit: 16777216 });
      this.term.loadAddon(this.imageAddon);
    } catch (_) { this.imageAddon = null; }
  }

  // OSC 9;4 progress (ConEmu / Windows Terminal convention, used by winget,
  // some build tools, and Claude Code-style CLIs): ESC ] 9 ; 4 ; state ; pct BEL.
  // state 0 = clear, 1 = normal, 2 = error, 3 = indeterminate, 4 = paused.
  // Shown as a thin bar on top of the pane and a percentage on its tab. Other
  // OSC 9 payloads (plain notifications) are left alone.
  installProgress() {
    try {
      this.term.parser.registerOscHandler(9, (data) => {
        const m = /^4;(\d)(?:;(\d{1,3}))?/.exec(data);
        if (!m) return false;
        const state = Number(m[1]);
        const pct = Math.max(0, Math.min(100, Number(m[2] || 0)));
        this.setProgress(state === 0 ? null : { state, pct });
        return true;
      });
    } catch (_) {}
  }

  setProgress(p) {
    const prev = this.progress;
    this.progress = p;
    if (!this.progressEl) {
      this.progressEl = document.createElement("div");
      this.progressEl.className = "pane-progress";
      this.host.parentElement.appendChild(this.progressEl);
    }
    const el = this.progressEl;
    el.hidden = !p;
    if (p) {
      el.dataset.state = String(p.state);
      el.style.setProperty("--pct", (p.state === 3 ? 100 : p.pct) + "%");
    }
    const changed = !prev !== !p || (p && prev && (p.pct !== prev.pct || p.state !== prev.state));
    if (changed) renderTabBar();
  }

  // Whole buffer (scrollback included) as a standalone HTML page, colours kept.
  exportHtml() {
    if (!this.serializer) { this.flashStatus("Exportar no está disponible con este renderer", true); return; }
    let html;
    try { html = this.serializer.serializeAsHTML({ includeGlobalBackground: true }); } catch (_) { return; }
    const doc = "<!doctype html><meta charset=\"utf-8\"><title>web-terminal export</title>" +
      "<style>body{margin:0;background:#000}pre{margin:0;padding:12px;font:13px ui-monospace,monospace}</style>" + html;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    const name = (currentTab() && currentTab().name) || "terminal";
    a.download = name.replace(/[^\w.-]+/g, "_") + "-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "") + ".html";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    this.flashStatus("Terminal exportada como HTML", false, 2500);
  }

  // GPU rendering is far smoother for TUIs (Claude Code, htop), but the WebGL
  // canvas cannot show the translucent background or image, so it is only used
  // while the background is fully opaque. Browsers also cap live WebGL
  // contexts (~16): on context loss the pane drops back to the DOM renderer.
  syncWebgl() {
    if (!XtermAddons || !this.term) return;
    const want = clamp01(bgSettings.opacity) >= 1 && !bgSettings.image;
    const had = !!this.webgl;
    this._syncWebglRenderer(want);
    if (!this.imageAddon || had !== !!this.webgl) this.reloadImageAddon();
  }

  _syncWebglRenderer(want) {
    if (want && !this.webgl) {
      try {
        const gl = new XtermAddons.Webgl();
        gl.onContextLoss(() => {
          try { gl.dispose(); } catch (_) {}
          if (this.webgl === gl) { this.webgl = null; this.reloadImageAddon(); }
        });
        this.term.loadAddon(gl);
        this.webgl = gl;
      } catch (_) { this.webgl = null; }
    } else if (!want && this.webgl) {
      try { this.webgl.dispose(); } catch (_) {}
      this.webgl = null;
    }
  }

  // Upload images (drop, paste, or the phone's 📎) and type their paths into
  // the terminal. term.paste() wraps them in bracketed paste when the app asked
  // for it, which is how Claude Code recognises a dropped image.
  async uploadImages(files) {
    const imgs = [...files].filter((f) => f && /^image\//.test(f.type));
    if (!imgs.length) {
      this.flashStatus("Solo se pueden soltar imágenes (png, jpg, gif, webp, heic)", true, 3000);
      return;
    }
    const paths = [];
    for (let i = 0; i < imgs.length; i++) {
      const f = imgs[i];
      this.flashStatus(`Subiendo imagen ${i + 1}/${imgs.length}…`, false, 60000);
      try {
        const r = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": f.type, "X-WT-Upload": "1" },
          body: f,
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.path) throw new Error(j.error || `HTTP ${r.status}`);
        paths.push(j.path);
      } catch (err) {
        this.flashStatus(`No se pudo subir la imagen: ${err.message}`, true, 4000);
        return;
      }
    }
    try { this.term.paste(paths.join(" ") + " "); } catch (_) {}
    try { this.term.focus(); } catch (_) {}
    this.flashStatus(paths.length === 1 ? `Imagen lista · ${paths[0]}` : `${paths.length} imágenes listas`, false, 3000);
  }

  installImageDrop() {
    // Paste: capture phase on the pane, so an image never reaches xterm's own
    // (text-only) paste handler. Text pastes fall through untouched.
    this.el.addEventListener("paste", (e) => {
      const files = e.clipboardData ? [...e.clipboardData.files] : [];
      if (!files.some((f) => /^image\//.test(f.type))) return;
      e.preventDefault(); e.stopPropagation();
      this.uploadImages(files);
    }, true);

    const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    let depth = 0;
    this.el.addEventListener("dragenter", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (depth++ === 0) this.el.classList.add("drop-target");
    });
    this.el.addEventListener("dragover", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    this.el.addEventListener("dragleave", (e) => {
      if (!hasFiles(e)) return;
      if (--depth <= 0) { depth = 0; this.el.classList.remove("drop-target"); }
    });
    this.el.addEventListener("drop", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); e.stopPropagation();
      depth = 0;
      this.el.classList.remove("drop-target");
      setActive(this);
      this.uploadImages(e.dataTransfer.files);
    });
  }

  // Re-apply the current font and make xterm re-measure the cell (it only does
  // so when the option changes, hence the detour) and redraw its glyph cache.
  refreshFont() {
    if (!this.term || !this.term.options) return;
    const f = currentFont();
    try {
      this.term.options.fontFamily = "monospace";
      this.term.options.fontFamily = f.stack;
      this.term.options.fontSize = prefs.fontSize;
    } catch (_) {}
    try { this.term.clearTextureAtlas && this.term.clearTextureAtlas(); } catch (_) {}
    try { this.fitNow(); } catch (_) {}
  }

  // Find bar over the terminal (Cmd+F on macOS, Ctrl+Shift+F elsewhere, since
  // Ctrl+F belongs to the shell). Enter = next, Shift+Enter = previous.
  openSearch() {
    if (!this.search) {
      this.flashStatus("Búsqueda no disponible con este renderer", true);
      return;
    }
    if (this.searchEl) {
      this.searchInput.focus();
      this.searchInput.select();
      return;
    }
    const box = document.createElement("div");
    box.className = "pane-search";
    const input = document.createElement("input");
    input.type = "search";
    input.placeholder = "Buscar…";
    input.setAttribute("aria-label", "Buscar en el terminal");
    input.autocapitalize = "off";
    input.spellcheck = false;
    const count = document.createElement("span");
    count.className = "pane-search-count";
    const prev = btn("icon:chevronUp", "Anterior (Shift+Enter)", () => run(false));
    const next = btn("icon:chevronDown", "Siguiente (Enter)", () => run(true));
    const close = btn("icon:x", "Cerrar (Esc)", () => this.closeSearch());
    box.append(input, count, prev, next, close);
    this.host.parentElement.appendChild(box);
    this.searchEl = box;
    this.searchInput = input;

    const decorations = {
      matchBackground: "#d2992266", activeMatchBackground: "#f0b429",
      matchOverviewRuler: "#d29922", activeMatchColorOverviewRuler: "#f0b429",
    };
    const run = (forward, incremental) => {
      const q = input.value;
      if (!q) { this.search.clearDecorations(); count.textContent = ""; return; }
      const opts = { caseSensitive: false, incremental: !!incremental, decorations };
      const found = forward ? this.search.findNext(q, opts) : this.search.findPrevious(q, opts);
      if (!found) count.textContent = "0";
    };
    this._searchResults = this.search.onDidChangeResults(({ resultIndex, resultCount }) => {
      count.textContent = resultCount ? `${resultIndex + 1}/${resultCount}` : "0";
    });
    input.addEventListener("input", () => run(true, true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); run(!e.shiftKey); }
      else if (e.key === "Escape") { e.preventDefault(); this.closeSearch(); }
    });
    input.focus();
  }

  closeSearch() {
    if (!this.searchEl) return;
    try { this.search.clearDecorations(); } catch (_) {}
    try { this._searchResults && this._searchResults.dispose(); } catch (_) {}
    this.searchEl.remove();
    this.searchEl = null;
    this.searchInput = null;
    try { this.term.focus(); } catch (_) {}
  }

  start() {
    this.term = new TerminalCtor({
      fontSize: prefs.fontSize,
      fontFamily: currentFont().stack,
      theme: termTheme(),
      cursorBlink: true,
      allowProposedApi: true,
      allowTransparency: true,    // required for rgba theme.background to render see-through
      scrollback: 5000,
      convertEol: false,
      windowsMode: false,
      // Full-screen TUIs (vim, htop, less) turn on mouse tracking, and then the
      // terminal hands drags to the app instead of selecting text. On macOS
      // xterm only lets Option+drag override that, and only with this enabled —
      // without it there is no way to select anything in those apps.
      macOptionClickForcesSelection: true,
    });
    if (FitAddonCtor) {
      this.fit = new FitAddonCtor();
      this.term.loadAddon(this.fit);
    }
    this.term.open(this.host);
    this.loadAddons();
    fontReady(currentFont()).then(() => this.refreshFont());
    this.hardenInputElement();
    try { this.term.focus(); } catch (_) {}

    // Watch drags so we can explain a selection that never happens.
    this.host.addEventListener("mousedown", (e) => {
      this._dragFrom = { x: e.clientX, y: e.clientY, alt: e.altKey, shift: e.shiftKey };
    });
    this.host.addEventListener("mouseup", (e) => {
      const from = this._dragFrom;
      this._dragFrom = null;
      if (!from) return;
      const moved = Math.abs(e.clientX - from.x) + Math.abs(e.clientY - from.y);
      const override = IS_MAC ? from.alt || e.altKey : from.shift || e.shiftKey;
      this.hintIfMouseGrabbed(moved > 20, override);
    });

    // --- copying -----------------------------------------------------------
    //
    // Cmd+C (macOS) or Ctrl+Shift+C elsewhere. This keydown is the ONLY place
    // that ever writes to the clipboard — see copyToClipboard() for why there
    // is deliberately no `copy` listener and no navigator.clipboard call.
    try {
      this.term.attachCustomKeyEventHandler((e) => {
        if (e.type !== "keydown") return true;

        // The phone key bar's CTRL/ALT are sticky: they arm here and apply to
        // the NEXT key, which usually comes from the on-screen keyboard rather
        // than from the bar. xterm allows exactly one custom handler, so this
        // has to live inside the copy handler rather than beside it.
        const modified = consumeStickyMods(e);
        if (modified !== null) {
          this.sendInput(modified);
          return false;
        }

        if (e.key !== "c" && e.key !== "C") return true;

        const macCopy = e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
        const otherCopy = e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey;
        if (!macCopy && !otherCopy) return true;

        // With nothing selected, let the key through: Cmd+C is a no-op in the
        // shell and Ctrl+Shift+C likewise, but Ctrl+C must still interrupt.
        const sel = this.term && this.term.getSelection ? this.term.getSelection() : "";
        if (!sel) return true;

        // Read the selection ONCE, here, before anything can disturb it, and
        // copy synchronously so the keydown's user activation still applies.
        const text = tidySelection(sel);
        const ok = copyToClipboard(text);
        // Say what happened. A copy that silently does nothing is the worst
        // outcome: you only find out when you paste somewhere else.
        this.flashStatus(
          ok ? `Copiado · ${text.length} caracteres` : "No se pudo copiar",
          !ok,
        );
        e.preventDefault();
        return false;
      });
    } catch (_) {}

    // Wait one frame so layout settles, then fit and connect.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.fitNow();
      this.connect();
    }));

    // Re-fit whenever the host resizes.
    this.ro = new ResizeObserver(() => this.fitDebounced());
    this.ro.observe(this.host);
  }

  fitDebounced() {
    if (this._fitTimer) cancelAnimationFrame(this._fitTimer);
    this._fitTimer = requestAnimationFrame(() => {
      this._fitTimer = 0;
      this.fitNow();
    });
  }

  measureCharSize() {
    // Build a probe element that mimics the terminal's font. It must track the
    // configured font, not a fixed one — measuring 13px JetBrains Mono while the
    // terminal renders 18px Menlo yields a cols/rows count that is simply wrong.
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;visibility:hidden;white-space:pre;line-height:1.2;" +
      `font-family:${currentFont().stack};font-size:${prefs.fontSize}px;`;
    probe.textContent = "M".repeat(80);
    this.host.appendChild(probe);
    const r = probe.getBoundingClientRect();
    const cw = r.width / 80 || 7.6;
    const lh = r.height || 16;
    probe.remove();
    return { cw, lh };
  }

  fitNow() {
    if (this.disposed || !this.term) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (w < 20 || h < 20) return;

    let cols = this.term.cols || 80;
    let rows = this.term.rows || 24;

    if (this.fit) {
      try { this.fit.fit(); } catch (_) {}
      cols = this.term.cols;
      rows = this.term.rows;
    } else {
      const { cw, lh } = this.measureCharSize();
      cols = Math.max(10, Math.floor(w / cw));
      rows = Math.max(5, Math.floor(h / lh));
      try { this.term.resize(cols, rows); } catch (_) {}
    }

    if (cols !== this.lastCols || rows !== this.lastRows) {
      this.lastCols = cols;
      this.lastRows = rows;
      this.titleEl.textContent = `term ${this.id} · ${cols}×${rows}`;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try { this.ws.send(JSON.stringify({ t: "r", cols, rows })); } catch (_) {}
      }
    }
  }

  connect() {
    if (this.disposed || this._ondataAttached) {
      // Avoid attaching term.onData twice across reconnects.
    }
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    let url = `${proto}//${location.host}/ws/term?cols=${this.lastCols}&rows=${this.lastRows}`;
    if (this.sessionId) url += `&session=${encodeURIComponent(this.sessionId)}`;
    this.setStatus(this.sessionId ? "reattaching…" : "connecting…");

    const ws = new WebSocket(url);
    this.ws = ws;
    this._reconnectScheduled = false;

    ws.onopen = () => {
      this.setStatus("connected");
      this._reconnectAttempts = 0;
      try { ws.send(JSON.stringify({ t: "r", cols: this.lastCols, rows: this.lastRows })); } catch (_) {}
      // Keepalive: send ping every 25s so Cloudflare's idle timeout (~100s) doesn't kill us.
      if (this._keepaliveTimer) clearInterval(this._keepaliveTimer);
      this._keepaliveTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ t: "ping" })); } catch (_) {}
        }
      }, 25000);
    };
    ws.onerror = () => this.setStatus("connection error", true);
    ws.onclose = (e) => {
      if (this._keepaliveTimer) { clearInterval(this._keepaliveTimer); this._keepaliveTimer = null; }
      if (this.disposed) return;
      // Codes that mean "don't reconnect": 1000 (normal), 4002 (session destroyed by us),
      // 1008 (auth) — auth means session expired, send to login.
      if (e.code === 1008) {
        this.setStatus("session expired — reload to log in", true);
        return;
      }
      if (e.code === 4003) {
        this.setStatus(`blocked: the server does not recognise ${location.host} as its own address — open it by IP or by its public hostname`, true);
        try { this.term && this.term.write(`\r\n\x1b[31m[origin ${location.origin} rejected by the server]\x1b[0m\r\n`); } catch (_) {}
        return;
      }
      if (e.code === 4002) {
        this.setStatus("session terminated", true);
        return;
      }
      if (e.code === 4001) {
        this.setStatus("opened on another device — refresh to take over", true);
        try { this.term && this.term.write("\r\n\x1b[33m[opened on another device]\x1b[0m\r\n"); } catch (_) {}
        return;
      }
      this.setStatus(`disconnected (${e.code}) — reconnecting…`, true);
      this.scheduleReconnect();
    };
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === "session") {
        const wasRestoring = !!this.sessionId;
        this.sessionId = m.id;
        this.titleEl.textContent = `term ${this.id} · ${this.lastCols}×${this.lastRows} · ${m.id.slice(0, 6)}`;
        if (wasRestoring && m.fresh) {
          // The PTY behind this pane is gone (server restart, session expiry)
          // but xterm.js still carries whatever modes the last app switched
          // on. Claude Code enables any-motion mouse tracking (DECSET 1003), so
          // without this the fresh zsh gets an ESC[<35;x;yM report for every
          // hover and echoes it as "<35;12;40M" garbage. Nothing in the new
          // shell will ever turn those modes off — it never turned them on.
          this.resetTerminalModes();
          try { this.term.write(`\r\n\x1b[33m[previous session expired — fresh shell]\x1b[0m\r\n`); } catch (_) {}
        }
        saveWorkspace();
      } else if (m.t === "d" && this.term) {
        this.trackMouseGrab(m.d);
        this.term.write(m.d);
      } else if (m.t === "exit" && this.term) {
        try { this.term.write(`\r\n\x1b[33m[exited code=${m.exitCode ?? "?"}]\x1b[0m\r\n`); } catch (_) {}
        this.setStatus(`exited (code=${m.exitCode ?? "?"})`);
        closeExitedPane(this);
      } else if (m.t === "pong") {
        // ignore
      }
    };

    if (!this._ondataAttached) {
      this.term.onData((d) => this.sendInput(d));
      this._ondataAttached = true;
    }
  }

  // Finger scrolling inside a full-screen app (Claude Code, vim, htop, less).
  //
  // Those apps turn on mouse tracking, and xterm then DISABLES its own touch
  // handling on purpose:
  //
  //     addDisposableDomListener(el, "touchmove", e => {
  //       if (!this.coreMouseService.areMouseEventsActive) ...
  //     })
  //
  // It assumes the browser will synthesise mouse events for the app to read.
  // iOS synthesises a click after a tap, but nothing at all during a drag — so
  // the gesture goes nowhere and the app never scrolls, while outside such apps
  // (plain shell, mouse tracking off) the native viewport scroll works fine.
  // That asymmetry is exactly what you see on the phone.
  //
  // So: translate the drag into wheel reports ourselves, with coordinates WE
  // compute. That fixes scrolling and sidesteps xterm's coordinate path, which
  // is the one that yields NaN when handed a touch event.
  //
  // SGR encoding (button 64 = wheel up, 65 = wheel down). Anything enabling
  // mouse tracking today also enables SGR (1006) — X10 cannot express a column
  // past 223, so it is effectively extinct for this purpose.
  installTouchScroll() {
    let lastY = null;
    let carry = 0;

    this.host.addEventListener("touchstart", (e) => {
      const t = e.touches && e.touches[0];
      lastY = t ? t.clientY : null;
      carry = 0;
    }, { passive: true });

    this.host.addEventListener("touchmove", (e) => {
      if (!this.term || !this.term.modes) return;
      // Mouse tracking off: xterm's own touch scrolling works (native momentum).
      if (this.term.modes.mouseTrackingMode === "none") return;
      const t = e.touches && e.touches[0];
      if (!t || lastY == null) return;

      const rect = this.host.getBoundingClientRect();
      const cellH = rect.height / (this.term.rows || 24);
      const cellW = rect.width / (this.term.cols || 80);
      if (!(cellH > 0) || !(cellW > 0)) return;

      e.preventDefault();   // the page must not pan while we scroll the app

      carry += lastY - t.clientY;
      lastY = t.clientY;
      const notches = Math.trunc(carry / cellH);
      if (!notches) return;
      carry -= notches * cellH;

      const col = Math.max(1, Math.min(this.term.cols, Math.ceil((t.clientX - rect.left) / cellW)));
      const row = Math.max(1, Math.min(this.term.rows, Math.ceil((t.clientY - rect.top) / cellH)));
      // Never encode a report unless every number is finite (touch events lack
      // the clientX/Y xterm expects, which is where the NaN reports came from).
      if (!Number.isFinite(col) || !Number.isFinite(row)) return;

      const button = notches > 0 ? 65 : 64;   // 65 = wheel down, 64 = wheel up
      let seq = "";
      for (let i = 0; i < Math.min(Math.abs(notches), 10); i++) {
        seq += `\x1b[<${button};${col};${row}M`;
      }
      this.sendInput(seq);
    }, { passive: false });
  }

  // Everything a phone keyboard does to be helpful is wrong for a shell.
  //
  // xterm sets autocorrect, autocapitalize and spellcheck on its hidden
  // textarea, but NOT autocomplete — so iOS still treats it as an ordinary text
  // field and offers the AutoFill accessory bar (the "password-ish" strip with
  // the key and the checkmark). The data-*ignore attributes are the opt-outs
  // 1Password, LastPass and Bitwarden look for, which otherwise inject their own
  // badge into the field.
  //
  // Re-applied here rather than patched into xterm so an upgrade cannot quietly
  // drop them.
  hardenInputElement() {
    const ta = this.host.querySelector(".xterm-helper-textarea");
    if (!ta) return;
    ta.setAttribute("autocomplete", "off");
    ta.setAttribute("autocorrect", "off");
    ta.setAttribute("autocapitalize", "none");
    ta.setAttribute("spellcheck", "false");
    ta.setAttribute("data-1p-ignore", "true");
    ta.setAttribute("data-lpignore", "true");
    ta.setAttribute("data-bwignore", "true");
    ta.setAttribute("data-form-type", "other");
    // Otherwise iOS labels the return key "Go", which suggests submitting a form
    // that does not exist.
    ta.setAttribute("enterkeyhint", "enter");
  }

  // Straight to the PTY, bypassing xterm's keyboard layer. The key bar needs
  // this: it already knows the exact bytes to send, and routing them back
  // through a synthetic KeyboardEvent would just be a slower way to guess.
  sendInput(d) {
    if (!d) return;
    if (isBrokenMouseReport(d)) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify({ t: "i", d })); } catch (_) {}
    }
  }

  scheduleReconnect() {
    if (this._reconnectScheduled || this.disposed) return;
    this._reconnectScheduled = true;
    const attempt = (this._reconnectAttempts || 0) + 1;
    this._reconnectAttempts = attempt;
    // Exponential backoff capped at 8s.
    const delay = Math.min(8000, 500 * Math.pow(1.6, attempt - 1));
    setTimeout(() => {
      if (this.disposed) return;
      this.connect();
    }, delay);
  }

  refreshAfterDomMove() {
    // Called after this pane's DOM has been moved during a split/close.
    // Force a reflow + re-fit + re-render.
    if (this.disposed || !this.term) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.fitNow();
      // WebGL panes share one glyph atlas. While this pane was out of the DOM
      // (another tab active) the others kept drawing into it, and on return
      // this pane read stale slots: top's "%CPU" came back as "dlVLb". Rebuild
      // the atlas before the redraw.
      try { this.term.clearTextureAtlas && this.term.clearTextureAtlas(); } catch (_) {}
      try { this.term.refresh && this.term.refresh(0, this.term.rows - 1); } catch (_) {}
      try { this.term.focus && this.term.focus(); } catch (_) {}
    }));
  }

  dispose() {
    this.disposed = true;
    if (this._keepaliveTimer) { clearInterval(this._keepaliveTimer); this._keepaliveTimer = null; }
    // Tell the server to permanently kill this PTY (vs. just detaching the WS).
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ t: "kill" }));
      }
    } catch (_) {}
    try { this.ro && this.ro.disconnect(); } catch (_) {}
    try { this.ws && this.ws.close(); } catch (_) {}
    try { this.term && this.term.dispose && this.term.dispose(); } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// Split (binary tree node)
// ---------------------------------------------------------------------------
class Split {
  constructor(direction, a, b) {
    this.direction = direction;
    this.a = a;
    this.b = b;
    a.parent = this;
    b.parent = this;
    this.parent = null;
    this.aFraction = 0.5;

    this.el = document.createElement("div");
    this.el.className = `split ${direction}`;

    this.aWrap = document.createElement("div");
    this.aWrap.className = "child";
    this.bWrap = document.createElement("div");
    this.bWrap.className = "child";

    this.gutter = document.createElement("div");
    this.gutter.className = "gutter";

    this.el.appendChild(this.aWrap);
    this.el.appendChild(this.gutter);
    this.el.appendChild(this.bWrap);

    this.applyFraction();
    this.installGutter();
  }

  applyFraction() {
    this.aWrap.style.flex = `${this.aFraction} 1 0`;
    this.bWrap.style.flex = `${1 - this.aFraction} 1 0`;
  }

  installGutter() {
    const g = this.gutter;
    g.addEventListener("mousedown", (e) => {
      e.preventDefault();
      g.classList.add("active");
      const isRow = this.direction === "row";
      const rect = this.el.getBoundingClientRect();
      const total = isRow ? rect.width : rect.height;
      const start = isRow ? rect.left : rect.top;
      const onMove = (ev) => {
        const pos = (isRow ? ev.clientX : ev.clientY) - start;
        let f = pos / total;
        f = Math.max(0.1, Math.min(0.9, f));
        this.aFraction = f;
        this.applyFraction();
      };
      const onUp = () => {
        g.classList.remove("active");
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        forEachPane(getLayoutRoot(), (p) => p.fitDebounced());
        saveWorkspace();
      };
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
    });
  }

  // Replaces a wrap's CONTENT (not the wrap itself) with a node's element.
  putA(node) { this.aWrap.replaceChildren(node.el); node.parent = this; }
  putB(node) { this.bWrap.replaceChildren(node.el); node.parent = this; }

  replaceChild(oldChild, newChild) {
    if (oldChild === this.a) { this.a = newChild; this.putA(newChild); }
    else if (oldChild === this.b) { this.b = newChild; this.putB(newChild); }
  }

  otherChild(child) { return child === this.a ? this.b : this.a; }
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
function setActive(pane) {
  if (activePane === pane) return;
  if (activePane && activePane.el) activePane.el.classList.remove("active");
  activePane = pane;
  if (pane && pane.el) pane.el.classList.add("active");
  const t = currentTab();
  if (t && pane) t.lastActivePaneId = pane.id;
}

function rootEl() { return document.getElementById("root"); }

function splitPane(pane, direction) {
  // CRITICAL: capture the original parent BEFORE constructing the new Split
  // (the constructor reparents `pane` to the new split, so reading
  // pane.parent afterwards would point at the wrong node).
  const originalParent = pane.parent;
  const wasRoot = pane === getLayoutRoot();

  const newPane = new Pane();
  const split = new Split(direction, pane, newPane);

  split.putA(pane);
  split.putB(newPane);

  if (wasRoot || originalParent === null) {
    setLayoutRoot(split);
    split.parent = null;
    rootEl().replaceChildren(split.el);
  } else {
    originalParent.replaceChild(pane, split);
    split.parent = originalParent;
  }

  newPane.start();
  pane.refreshAfterDomMove();
  setActive(newPane);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    forEachPane(getLayoutRoot(), (p) => p.fitNow());
  }));
  saveWorkspace();
}

// Two-step close for the ✕ buttons: they sit right next to things you tap all
// the time (tabs, the pane bar), and closing kills the shell for good. The
// first tap arms the button ("¿Cerrar?") for a few seconds; only a second tap
// on the same button closes. Returns true when the caller should close now.
const CLOSE_ARM_MS = 3000;
function confirmCloseTap(button) {
  if (button._armed) {
    clearTimeout(button._armTimer);
    button._armed = false;
    return true;
  }
  button._armed = true;
  button._origHtml = button.innerHTML;
  button.textContent = "¿Cerrar?";
  button.classList.add("armed");
  button._armTimer = setTimeout(() => {
    button._armed = false;
    button.innerHTML = button._origHtml;
    button.classList.remove("armed");
  }, CLOSE_ARM_MS);
  return false;
}

function closePane(pane) {
  const parent = pane.parent;
  const grand = parent && parent.parent;
  pane.dispose();

  if (parent === null || pane === getLayoutRoot()) {
    const fresh = new Pane();
    setLayoutRoot(fresh);
    rootEl().replaceChildren(fresh.el);
    fresh.start();
    setActive(fresh);
    saveWorkspace();
    return;
  }

  const sibling = parent.otherChild(pane);

  if (grand === null) {
    setLayoutRoot(sibling);
    sibling.parent = null;
    rootEl().replaceChildren(sibling.el);
  } else {
    grand.replaceChild(parent, sibling);
    sibling.parent = grand;
  }

  forEachPane(sibling, (p) => p.refreshAfterDomMove());
  setActive(firstLeaf(sibling));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    forEachPane(getLayoutRoot(), (p) => p.fitNow());
  }));
  saveWorkspace();
}

// The shell behind a pane exited (`exit`, Ctrl+D): close it like a native
// terminal does. Its tab goes too when it was the tab's only pane — except the
// last tab, where closePane() swaps in a fresh shell instead.
function closeExitedPane(pane) {
  if (pane.disposed || pane._exitClosing) return;
  pane._exitClosing = true;
  const tab = tabs.find((t) => { let hit = false; forEachPane(t.layoutRoot, (p) => { if (p === pane) hit = true; }); return hit; });
  if (!tab) return;
  if (tab.layoutRoot === pane && tabs.length > 1) {
    closeTab(tab.id);
  } else if (tab.id === activeTabId) {
    closePane(pane);
  } else {
    // A split in a background tab: closePane() rearranges the visible layout,
    // so leave the "[exited]" note and let it be closed by hand.
    pane._exitClosing = false;
  }
}

function firstLeaf(node) {
  let cur = node;
  while (cur instanceof Split) cur = cur.a;
  return cur;
}
function forEachPane(node, fn) {
  if (!node) return;
  if (node instanceof Pane) fn(node);
  else if (node instanceof Split) { forEachPane(node.a, fn); forEachPane(node.b, fn); }
}

// ---------------------------------------------------------------------------
// Workspace persistence — workspace id lives in the URL (?w=<id>) and the
// state is mirrored to the server so any device with the same URL can
// reattach. localStorage is used as a fast cache + fallback if the server
// hasn't responded yet.
// ---------------------------------------------------------------------------
const WORKSPACE_KEY = "wt.workspace.v1";
let WORKSPACE_ID = null;

function generateId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function ensureWorkspaceId() {
  const url = new URL(location.href);
  let id = url.searchParams.get("w");
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id = generateId();
    url.searchParams.set("w", id);
    history.replaceState(null, "", url.pathname + "?" + url.searchParams.toString() + url.hash);
  }
  WORKSPACE_ID = id;
  return id;
}

function serializeLayout(node) {
  if (!node) return null;
  if (node instanceof Pane) return { type: "pane", sessionId: node.sessionId || null };
  if (node instanceof Split) {
    return {
      type: "split",
      direction: node.direction,
      fraction: node.aFraction,
      a: serializeLayout(node.a),
      b: serializeLayout(node.b),
    };
  }
  return null;
}

function workspaceData() {
  return {
    nextTabId, activeTabId,
    tabs: tabs.map((t) => ({
      id: t.id, name: t.name,
      layout: serializeLayout(t.layoutRoot),
    })),
  };
}

let _saveTimer = 0;
function saveWorkspace() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = 0;
    const data = workspaceData();
    try {
      localStorage.setItem(WORKSPACE_KEY + ":" + WORKSPACE_ID, JSON.stringify(data));
    } catch (_) {}
    if (!WORKSPACE_ID) return;
    fetch("/api/workspace/" + encodeURIComponent(WORKSPACE_ID), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
      keepalive: true,
    }).catch(() => {});
  }, 250);
}

async function fetchWorkspaceFromServer() {
  if (!WORKSPACE_ID) return null;
  try {
    const r = await fetch("/api/workspace/" + encodeURIComponent(WORKSPACE_ID), {
      credentials: "include",
    });
    if (r.status === 200) return await r.json();
  } catch (_) {}
  return null;
}

function loadWorkspaceFromCache() {
  try {
    const v = localStorage.getItem(WORKSPACE_KEY + ":" + WORKSPACE_ID);
    if (v) return JSON.parse(v);
    // legacy single-workspace cache
    const legacy = localStorage.getItem(WORKSPACE_KEY);
    if (legacy) return JSON.parse(legacy);
  } catch (_) {}
  return null;
}

function deserializeLayout(json) {
  if (!json || typeof json !== "object") return null;
  if (json.type === "pane") return new Pane(json.sessionId || null);
  if (json.type === "split") {
    const a = deserializeLayout(json.a);
    const b = deserializeLayout(json.b);
    if (!a || !b) return a || b || null;
    const s = new Split(json.direction === "col" ? "col" : "row", a, b);
    if (typeof json.fraction === "number") {
      s.aFraction = Math.max(0.1, Math.min(0.9, json.fraction));
      s.applyFraction();
    }
    s.putA(a);
    s.putB(b);
    return s;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function createTab(opts) {
  opts = opts || {};
  const id = opts.id || nextTabId++;
  if (id >= nextTabId) nextTabId = id + 1;
  const name = opts.name || `Terminal ${id}`;
  const layoutRoot = opts.layoutRoot || new Pane();
  const tab = new Tab(id, name, layoutRoot);
  tabs.push(tab);
  return tab;
}

function activateTab(tabId) {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;
  if (activeTabId === tabId && rootEl().firstChild) return; // already active

  // Detach current tab DOM (but keep panes alive in memory).
  const cur = currentTab();
  if (cur && cur.layoutRoot && cur.layoutRoot.el && cur.layoutRoot.el.parentNode === rootEl()) {
    rootEl().removeChild(cur.layoutRoot.el);
  }

  activeTabId = tab.id;
  rootEl().appendChild(tab.layoutRoot.el);

  // Start any panes that haven't been started yet (fresh / restored tabs).
  forEachPane(tab.layoutRoot, (p) => { if (!p.term) p.start(); });

  // Restore previous active pane in this tab (or fall back to first leaf).
  let next = null;
  if (tab.lastActivePaneId != null) {
    forEachPane(tab.layoutRoot, (p) => { if (p.id === tab.lastActivePaneId) next = p; });
  }
  if (!next) next = firstLeaf(tab.layoutRoot);
  setActive(next);

  // After re-attaching, fit + redraw.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    forEachPane(tab.layoutRoot, (p) => p.refreshAfterDomMove());
  }));

  renderTabBar();
  saveWorkspace();
}

function closeTab(tabId) {
  const idx = tabs.findIndex((t) => t.id === tabId);
  if (idx === -1) return;                     // unknown / already gone
  if (tabs.length <= 1) return;               // never kill the last tab
  const tab = tabs[idx];
  if (tab._closing) return;                   // guard against double-fire
  tab._closing = true;

  // Kill server-side PTYs and free xterm instances.
  forEachPane(tab.layoutRoot, (p) => p.dispose());
  // If this tab's DOM is currently mounted, detach it explicitly. Otherwise
  // a stale layoutRoot.el can linger and look like a new tab appeared.
  const el = tab.layoutRoot && tab.layoutRoot.el;
  if (el && el.parentNode) el.parentNode.removeChild(el);

  // Remove from the array.
  tabs.splice(idx, 1);
  const wasActive = activeTabId === tabId;

  if (wasActive) {
    // Prefer the tab that was to the RIGHT of the closed one. If we closed
    // the rightmost, fall back to the new rightmost.
    const nextIdx = Math.min(idx, tabs.length - 1);
    activeTabId = null;                        // bypass activateTab's "already active" guard
    activateTab(tabs[nextIdx].id);             // internally calls renderTabBar + saveWorkspace
  } else {
    renderTabBar();
    saveWorkspace();
  }
}

function renameTab(tabId, name) {
  const t = tabs.find((x) => x.id === tabId);
  if (!t) return;
  t.name = name;
  renderTabBar();
  saveWorkspace();
}

function renderTabBar() {
  const list = document.getElementById("tabs-list");
  if (!list) return;
  const showClose = tabs.length > 1;
  const frag = document.createDocumentFragment();
  for (const t of tabs) {
    const el = document.createElement("div");
    el.className = "tab" + (t.id === activeTabId ? " active" : "");
    el.dataset.tabId = String(t.id);
    el.draggable = true;

    const name = document.createElement("span");
    name.className = "tab-name";
    name.textContent = t.name;
    el.appendChild(name);

    let prog = null;
    forEachPane(t.layoutRoot, (p) => { if (p.progress && !prog) prog = p.progress; });
    if (prog) {
      const pr = document.createElement("span");
      pr.className = "tab-progress" + (prog.state === 2 ? " error" : "");
      pr.textContent = prog.state === 2 ? "✕" : prog.state === 3 ? "…" : prog.pct + "%";
      el.appendChild(pr);
    }

    if (showClose) {
      const close = document.createElement("button");
      close.className = "tab-close";
      close.title = "Close tab (tap twice)";
      close.innerHTML = icon("x", 12);
      close.dataset.action = "close";
      // Don't let the close button start a tab-drag.
      close.draggable = false;
      el.appendChild(close);
    }
    frag.appendChild(el);
  }
  // Atomic swap — no partial state ever visible, and no stale listeners can
  // survive because we don't attach any per-tab listeners here anymore.
  list.replaceChildren(frag);
}

// Move tab `tabId` to sit at `targetIdx` in the tabs array (index in the
// pre-move array; the tab may itself be currently there). No-op if it's
// already at that slot. Renders + saves.
function moveTab(tabId, targetIdx) {
  const fromIdx = tabs.findIndex((t) => t.id === tabId);
  if (fromIdx === -1) return;
  let to = Math.max(0, Math.min(targetIdx, tabs.length));
  // When dragging forward, splicing out first shifts indices down by 1.
  if (to > fromIdx) to--;
  if (to === fromIdx) return;
  const [t] = tabs.splice(fromIdx, 1);
  tabs.splice(to, 0, t);
  renderTabBar();
  saveWorkspace();
}

// Single delegated listener installed once at boot. Any click on a `.tab`
// or `.tab-close` inside `#tabs-list` is routed from here. This eliminates
// the possibility of duplicate handlers piling up across re-renders.
function installTabBarDelegates() {
  const list = document.getElementById("tabs-list");
  if (!list || list._delegateInstalled) return;
  list._delegateInstalled = true;

  // Drag state, scoped to the delegate closure.
  let dragId = null;             // id of the tab currently being dragged
  let suppressNextClick = false; // set on drop so the post-drop click doesn't activate

  const clearDropMarkers = () => {
    for (const el of list.querySelectorAll(".tab.drop-before,.tab.drop-after")) {
      el.classList.remove("drop-before", "drop-after");
    }
  };

  list.addEventListener("click", (e) => {
    if (suppressNextClick) { suppressNextClick = false; e.stopPropagation(); return; }
    const tabEl = e.target.closest(".tab");
    if (!tabEl || !list.contains(tabEl)) return;
    const id = parseInt(tabEl.dataset.tabId, 10);
    if (!Number.isFinite(id)) return;
    const closeBtn = e.target.closest(".tab-close");
    if (closeBtn) {
      e.stopPropagation();
      if (confirmCloseTap(closeBtn)) closeTab(id);
    } else {
      activateTab(id);
    }
  });

  list.addEventListener("dblclick", (e) => {
    if (e.target.closest(".tab-close")) return;
    const tabEl = e.target.closest(".tab");
    if (!tabEl || !list.contains(tabEl)) return;
    const id = parseInt(tabEl.dataset.tabId, 10);
    if (!Number.isFinite(id)) return;
    const t = tabs.find((x) => x.id === id);
    if (!t) return;
    e.preventDefault();
    const newName = prompt("Rename tab:", t.name);
    if (newName != null && newName.trim()) renameTab(id, newName.trim());
  });

  // ---- Drag & drop reorder ------------------------------------------------
  list.addEventListener("dragstart", (e) => {
    const tabEl = e.target.closest(".tab");
    if (!tabEl || !list.contains(tabEl)) return;
    // Don't initiate a drag from the close button.
    if (e.target.closest(".tab-close")) { e.preventDefault(); return; }
    const id = parseInt(tabEl.dataset.tabId, 10);
    if (!Number.isFinite(id)) return;
    dragId = id;
    tabEl.classList.add("dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      // Safari refuses to start a drag without setData().
      try { e.dataTransfer.setData("text/plain", String(id)); } catch (_) {}
    }
  });

  list.addEventListener("dragover", (e) => {
    if (dragId == null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const overTab = e.target.closest(".tab");
    clearDropMarkers();
    if (!overTab || !list.contains(overTab)) return;
    // Don't mark the dragged tab itself.
    if (parseInt(overTab.dataset.tabId, 10) === dragId) return;
    const rect = overTab.getBoundingClientRect();
    const before = (e.clientX - rect.left) < rect.width / 2;
    overTab.classList.add(before ? "drop-before" : "drop-after");
  });

  list.addEventListener("dragleave", (e) => {
    // Only clear when leaving the list altogether.
    if (e.target === list) clearDropMarkers();
  });

  list.addEventListener("drop", (e) => {
    if (dragId == null) return;
    e.preventDefault();
    const overTab = e.target.closest(".tab");
    let targetIdx;
    if (overTab && list.contains(overTab)) {
      const overId = parseInt(overTab.dataset.tabId, 10);
      const overIdx = tabs.findIndex((t) => t.id === overId);
      const rect = overTab.getBoundingClientRect();
      const before = (e.clientX - rect.left) < rect.width / 2;
      targetIdx = before ? overIdx : overIdx + 1;
    } else {
      // Dropped on empty part of the list → append.
      targetIdx = tabs.length;
    }
    const movedId = dragId;
    dragId = null;
    clearDropMarkers();
    suppressNextClick = true;
    moveTab(movedId, targetIdx);
  });

  list.addEventListener("dragend", () => {
    dragId = null;
    clearDropMarkers();
    for (const el of list.querySelectorAll(".tab.dragging")) el.classList.remove("dragging");
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
function btn(label, title, onclick, klass) {
  const b = document.createElement("button");
  if (label.startsWith("icon:")) {
    b.innerHTML = icon(label.slice(5));
    b.setAttribute("aria-label", title);
  } else {
    b.textContent = label;
  }
  b.title = title;
  if (klass) b.className = klass;
  b.addEventListener("click", (e) => { e.stopPropagation(); onclick(); });
  return b;
}

function installShortcuts() {
  window.addEventListener("keydown", (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (!meta) return;
    // Zen is checked before the activePane guard so it still works when nothing
    // is focused. Escape is deliberately NOT a way out: vim, less and every TUI
    // need it, and stealing it would break the terminal to save a keystroke.
    if (e.key.toLowerCase() === "z" && e.shiftKey && !e.altKey) {
      e.preventDefault(); e.stopPropagation();
      setZen(!zenMode);
      return;
    }
    if (!activePane) return;
    const k = e.key.toLowerCase();
    const findCombo = IS_MAC ? e.metaKey && !e.shiftKey : e.ctrlKey && e.shiftKey;
    if (k === "f" && findCombo && !e.altKey) {
      e.preventDefault(); e.stopPropagation();
      activePane.openSearch();
      return;
    }
    if (k === "d" && !e.shiftKey && !e.altKey) {
      e.preventDefault(); e.stopPropagation();
      splitPane(activePane, "row");
    } else if (k === "d" && e.shiftKey && !e.altKey) {
      e.preventDefault(); e.stopPropagation();
      splitPane(activePane, "col");
    }
  }, true);
}

// A file dropped outside a pane would make the browser navigate to it and
// leave the terminal. Swallow it.
for (const ev of ["dragover", "drop"]) {
  window.addEventListener(ev, (e) => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault();
  });
}

window.addEventListener("resize", () =>
  requestAnimationFrame(() => forEachPane(getLayoutRoot(), (p) => p.fitDebounced())),
);

function bootFresh() {
  const tab = createTab();
  activateTab(tab.id);
}

(async function main() {
  ensureWorkspaceId();
  // Before any terminal exists, so the first pane is constructed with the right
  // palette and font instead of being built wrong and repainted.
  loadPrefs();
  if (pendingThemeId) { await loadAllThemes(); loadPrefs(); }
  applyUiTheme();
  applyFontSettings();
  loadBgSettings();
  applyBgSettings();
  fetchCurrentUser();
  await setupRenderer();

  // Server is authoritative for cross-device continuity. Cache is a fast
  // fallback if the network is slow or the server is restarting.
  let stored = await fetchWorkspaceFromServer();
  if (!stored) stored = loadWorkspaceFromCache();

  if (stored && Array.isArray(stored.tabs) && stored.tabs.length > 0) {
    try {
      if (typeof stored.nextTabId === "number") nextTabId = stored.nextTabId;
      for (const t of stored.tabs) {
        const layoutRoot = deserializeLayout(t.layout);
        if (!layoutRoot) continue;
        layoutRoot.parent = null;
        createTab({ id: t.id, name: t.name, layoutRoot });
      }
      if (tabs.length === 0) bootFresh();
      else activateTab(stored.activeTabId && tabs.find(t => t.id === stored.activeTabId) ? stored.activeTabId : tabs[0].id);
    } catch (e) {
      console.warn("[web-terminal] workspace restore failed:", e);
      bootFresh();
    }
  } else {
    bootFresh();
  }

  document.getElementById("tab-add").addEventListener("click", () => {
    const tab = createTab();
    activateTab(tab.id);
  });

  installTabBarDelegates();
  installShortcuts();
  installMenu();
  installViewportFit();
  installServiceWorker();
  installZen();
  installKeyBar();
  installSingleFocusable();
})();

// ---------------------------------------------------------------------------
// Floating hamburger menu
// ---------------------------------------------------------------------------
function installMenu() {
  const fab = document.getElementById("menu-fab");
  if (!fab) return;
  fab.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });
}

function toggleMenu() {
  const root = document.getElementById("menu-root");
  const fab = document.getElementById("menu-fab");
  if (root.firstChild) {
    closeMenu();
    return;
  }
  fab.classList.add("open");
  // iPad and iPhone keyboards use ⌘ too. iPadOS Safari reports "MacIntel" so it
  // already matched, but a device reporting "iPad" would have been told Ctrl.
  const isMac = /Mac|iPad|iPhone|iPod/i.test(navigator.platform || "");
  const mod = isMac ? "⌘" : "Ctrl";
  const pop = document.createElement("div");
  pop.className = "menu-popover";
  pop.innerHTML =
    '<button data-act="new-tab">' + icon("plus") + 'New tab</button>' +
    '<button data-act="new-window">' + icon("window") + 'New window (fresh workspace)</button>' +
    '<button data-act="open-existing">' + icon("history") + 'Open existing session…</button>' +
    '<button data-act="appearance">' + icon("palette") + 'Appearance…' +
      '<span class="kbd">' + escapeHtml(currentTheme().name) + '</span></button>' +
    // One-tap toggle kept alongside the picker: switching to e-ink is the thing
    // people do outdoors, and hunting for it in a 46-row grid every time is a
    // worse answer than a button.
    '<button data-act="eink-toggle">' + (isEink() ? icon("moon") + "Back to dark" : icon("page") + "E-ink mode") + '</button>' +
    '<button data-act="zen">' + icon(zenMode ? "minimize" : "maximize") + (zenMode ? "Show bars" : "Zen mode (hide bars)") +
      '<span class="kbd">' + mod + '+Shift+Z</span></button>' +
    '<button data-act="background">' + icon("image") + 'Background…</button>' +
    '<button data-act="rename-tab">' + icon("pencil") + 'Rename current tab</button>' +
    '<button data-act="close-tab" class="danger">' + icon("x") + 'Close current tab</button>' +
    '<div class="sep"></div>' +
    '<button data-act="split-h">' + icon("splitRight") + 'Split right<span class="kbd">'+mod+'+D</span></button>' +
    '<button data-act="split-v">' + icon("splitDown") + 'Split down<span class="kbd">'+mod+'+Shift+D</span></button>' +
    '<button data-act="export-html">' + icon("download") + 'Export pane as HTML</button>' +
    '<button data-act="close-pane" class="danger">' + icon("x") + 'Close active pane</button>' +
    '<div class="sep"></div>' +
    '<button data-act="copy-url">' + icon("link") + 'Copy workspace URL</button>' +
    '<div class="meta"><span>Workspace</span><span class="v" title="' + WORKSPACE_ID + '">' + WORKSPACE_ID.slice(0, 8) + '…</span></div>' +
    '<div class="meta"><span>Renderer</span><span class="v">' + RENDERER + '</span></div>' +
    (CURRENT_USER ? '<div class="meta"><span>Signed in</span><span class="v" title="' + CURRENT_USER + '">' + CURRENT_USER + '</span></div>' : "") +
    '<div class="sep"></div>' +
    '<button data-act="logout" class="danger">' + icon("logout") + 'Sign out</button>';
  root.appendChild(pop);

  pop.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const act = btn.getAttribute("data-act");
      closeMenu();
      if (act === "appearance") openAppearanceModal();
      else if (act === "zen") setZen(!zenMode);
      // Leaving e-ink returns you to whatever you had before it, not to a
      // hardcoded default — otherwise a quick trip outdoors wipes your theme.
      else if (act === "eink-toggle") setUiTheme(isEink() ? (preEinkThemeId || "wt-dark") : "eink");
      else if (act === "split-h" && activePane) splitPane(activePane, "row");
      else if (act === "split-v" && activePane) splitPane(activePane, "col");
      else if (act === "close-pane" && activePane) closePane(activePane);
      else if (act === "export-html" && activePane) activePane.exportHtml();
      else if (act === "new-tab") {
        const tab = createTab();
        activateTab(tab.id);
      } else if (act === "new-window") {
        // Open a fresh workspace in a new browser window/tab.
        window.open(location.pathname, "_blank");
      } else if (act === "open-existing") {
        openExistingSessionModal();
      } else if (act === "background") {
        openBackgroundModal();
      } else if (act === "close-tab") {
        if (activeTabId != null) closeTab(activeTabId);
      } else if (act === "rename-tab") {
        const t = currentTab();
        if (t) {
          const name = prompt("Rename tab:", t.name);
          if (name != null && name.trim()) renameTab(t.id, name.trim());
        }
      } else if (act === "copy-url") {
        // Same single mechanism as the terminal selection: writeText() is
        // denied in Chrome/Brave here, so this button used to do nothing.
        copyToClipboard(location.href);
      } else if (act === "logout") {
        const f = document.createElement("form");
        f.method = "post"; f.action = "/logout"; f.style.display = "none";
        document.body.appendChild(f); f.submit();
      }
    });
  });

  // Close on outside click / Escape.
  setTimeout(() => {
    document.addEventListener("click", outsideClose, true);
    document.addEventListener("keydown", escClose, true);
  }, 0);
}

function outsideClose(ev) {
  const root = document.getElementById("menu-root");
  const fab = document.getElementById("menu-fab");
  if (!root || !root.firstChild) return;
  if (root.contains(ev.target) || (fab && fab.contains(ev.target))) return;
  closeMenu();
}
function escClose(ev) { if (ev.key === "Escape") closeMenu(); }

// ---------------------------------------------------------------------------
// "Open existing session…" modal
// ---------------------------------------------------------------------------
async function openExistingSessionModal() {
  let payload;
  try {
    const r = await fetch("/api/sessions", { credentials: "include" });
    payload = await r.json();
  } catch (e) {
    alert("Failed to fetch sessions: " + e.message);
    return;
  }
  const list = (payload && payload.sessions) || [];
  // Sessions already attached elsewhere (e.g. another tab/device) are still
  // attachable — joining them will boot the previous attachment with code 4001.
  const ownIds = new Set();
  forEachPane(getLayoutRoot(), (p) => p.sessionId && ownIds.add(p.sessionId));
  // Also consider the other tabs' panes
  for (const t of tabs) forEachPane(t.layoutRoot, (p) => p.sessionId && ownIds.add(p.sessionId));

  const root = document.getElementById("modal-root") || (() => {
    const d = document.createElement("div"); d.id = "modal-root"; document.body.appendChild(d); return d;
  })();
  root.innerHTML = "";

  const overlay = document.createElement("div");
  overlay.className = "modal-bg";

  const card = document.createElement("div");
  card.className = "modal-card";
  card.innerHTML =
    '<h2>Open existing session</h2>' +
    '<div class="modal-sub">PTYs alive on the server right now (' + list.length + ' total)</div>' +
    '<div class="sess-list" id="sess-list"></div>' +
    '<div class="modal-actions"><button class="modal-btn ghost" data-act="cancel">Cancel</button></div>';
  overlay.appendChild(card);
  root.appendChild(overlay);

  const sessList = card.querySelector("#sess-list");
  if (list.length === 0) {
    sessList.innerHTML = '<div class="empty">No sessions on the server.</div>';
  } else {
    for (const s of list) {
      const row = document.createElement("button");
      row.className = "sess-row";
      const ageS = Math.max(0, Math.round((Date.now() - s.lastDataAt) / 1000));
      const tag = ownIds.has(s.id) ? '<span class="sess-tag own">in this workspace</span>'
        : s.attached ? '<span class="sess-tag attached">attached elsewhere</span>'
        : '<span class="sess-tag idle">idle</span>';
      const label = s.tabName || ("session " + s.id.slice(0, 6));
      row.innerHTML =
        '<span class="sess-id">' + escapeHtml(label) + '</span>' +
        '<span class="sess-info">' + (s.process ? escapeHtml(s.process) + ' · ' : '') +
          s.id.slice(0, 6) + ' · ' + s.cols + '×' + s.rows +
          ' · ' + (s.bufferBytes > 1024 ? Math.round(s.bufferBytes/1024)+'KB' : s.bufferBytes+'B') +
          ' · ' + fmtAge(ageS) + ' ago</span>' +
        tag;
      row.addEventListener("click", () => {
        closeModal();
        // Add a new tab in this workspace pointing at the chosen session id.
        const pane = new Pane(s.id);
        const tab = createTab({ name: s.tabName || ("session " + s.id.slice(0, 6)), layoutRoot: pane });
        activateTab(tab.id);
      });
      sessList.appendChild(row);
    }
  }

  const closeModal = () => { root.innerHTML = ""; document.removeEventListener("keydown", onEsc, true); };
  function onEsc(ev) { if (ev.key === "Escape") closeModal(); }
  card.querySelector('button[data-act="cancel"]').addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", onEsc, true);
}

function fmtAge(s) {
  if (s < 60) return s + "s";
  if (s < 3600) return Math.round(s/60) + "m";
  if (s < 86400) return Math.round(s/3600) + "h";
  return Math.round(s/86400) + "d";
}

// ---------------------------------------------------------------------------
// "Appearance…" modal — Gogh theme picker + font
// ---------------------------------------------------------------------------
// Colours and typography sit in one dialog because that is how people think
// about "how my terminal looks", but they are two independent settings: a Gogh
// theme cannot change the font, and changing the font leaves the palette alone.
function openAppearanceModal() {
  const root = document.getElementById("modal-root") || (() => {
    const d = document.createElement("div"); d.id = "modal-root"; document.body.appendChild(d); return d;
  })();
  root.innerHTML = "";

  const overlay = document.createElement("div");
  overlay.className = "modal-bg";

  const card = document.createElement("div");
  card.className = "modal-card modal-card-wide";

  const fontOpts = FONT_STACKS.map((f) =>
    '<option value="' + f.id + '"' + (f.id === prefs.fontFamily ? " selected" : "") + '>' +
    escapeHtml(f.name) + (fontIsAvailable(f) ? "" : " — not installed") + "</option>").join("");

  card.innerHTML =
    '<h2>Appearance</h2>' +
    '<div class="modal-sub">Palettes from the Gogh catalog — colours only. The font is a separate setting; a theme never changes it.</div>' +
    '<div class="bg-grid">' +
      '<label class="bg-row"><span>Font</span>' +
        '<select class="ap-select" id="ap-font">' + fontOpts + '</select>' +
        '<span class="bg-val"></span></label>' +
      '<label class="bg-row"><span>Size</span>' +
        '<input type="range" id="ap-size" min="' + FONT_SIZE_MIN + '" max="' + FONT_SIZE_MAX +
          '" step="1" value="' + prefs.fontSize + '" />' +
        '<span class="bg-val" id="ap-size-v">' + prefs.fontSize + 'px</span></label>' +
    '</div>' +
    '<div class="ap-bar">' +
      '<input type="search" class="ap-search" id="ap-q" placeholder="Search ' + THEMES.length + ' themes…" autocomplete="off" />' +
      '<div class="ap-chips" id="ap-chips">' +
        '<button class="ap-chip on" data-variant="all">All</button>' +
        '<button class="ap-chip" data-variant="dark">Dark</button>' +
        '<button class="ap-chip" data-variant="light">Light</button>' +
      '</div>' +
    '</div>' +
    '<div class="ap-grid" id="ap-grid"></div>' +
    '<div class="modal-actions">' +
      '<button class="modal-btn ghost" data-act="reset">Reset</button>' +
      '<button class="modal-btn" data-act="done">Done</button>' +
    '</div>';

  overlay.appendChild(card);
  root.appendChild(overlay);

  const grid = card.querySelector("#ap-grid");
  const search = card.querySelector("#ap-q");
  const chips = card.querySelector("#ap-chips");
  let variantFilter = "all";

  function renderGrid() {
    const q = search.value.trim().toLowerCase();
    const list = THEMES.filter((t) => {
      if (variantFilter !== "all" && t.variant !== variantFilter) return false;
      if (!q) return true;
      return (t.name + " " + (t.author || "")).toLowerCase().includes(q);
    });
    if (!list.length) {
      grid.innerHTML = '<div class="empty">No theme matches “' + escapeHtml(search.value) + '”.</div>';
      return;
    }
    grid.innerHTML = list.map((t) => {
      // Slots 1-6 plus their bright twins: enough to tell two palettes apart at
      // a glance without turning the card into a stripe of 16 near-identical dots.
      const dots = [1, 2, 3, 4, 5, 6, 9, 11, 12, 13]
        .map((i) => '<i style="background:' + safeHex(t.ansi[i]) + '"></i>').join("");
      return '<button class="ap-theme' + (t.id === prefs.themeId ? " on" : "") +
        (t.builtin ? " badged" : "") + '" data-id="' + t.id + '" ' +
        'style="background:' + safeHex(t.bg) + ';color:' + safeHex(t.fg) + '" ' +
        'title="' + escapeHtml(t.author || t.name) + '">' +
        '<span class="ap-theme-top"><span class="ap-aa">Aa</span><span class="ap-dots">' + dots + '</span></span>' +
        '<span class="ap-theme-name">' + escapeHtml(t.name) + '</span>' +
        (t.builtin ? '<span class="ap-badge">built-in</span>' : "") +
        '</button>';
    }).join("");
  }
  renderGrid();
  loadAllThemes().then((n) => {
    if (!card.isConnected) return;
    search.placeholder = "Search " + n + " themes…";
    renderGrid();
  });

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("button.ap-theme");
    if (!btn) return;
    setUiTheme(btn.getAttribute("data-id"));
    grid.querySelectorAll(".ap-theme.on").forEach((el) => el.classList.remove("on"));
    btn.classList.add("on");
  });

  search.addEventListener("input", renderGrid);
  chips.addEventListener("click", (e) => {
    const chip = e.target.closest("button.ap-chip");
    if (!chip) return;
    variantFilter = chip.getAttribute("data-variant");
    chips.querySelectorAll(".ap-chip").forEach((c) => c.classList.toggle("on", c === chip));
    renderGrid();
  });

  card.querySelector("#ap-font").addEventListener("change", (e) => setFont({ fontFamily: e.target.value }));
  const size = card.querySelector("#ap-size");
  const sizeVal = card.querySelector("#ap-size-v");
  size.addEventListener("input", () => {
    sizeVal.textContent = size.value + "px";
    setFont({ fontSize: Number(size.value) });
  });

  const closeModal = () => { root.innerHTML = ""; document.removeEventListener("keydown", onEsc, true); };
  function onEsc(ev) { if (ev.key === "Escape") closeModal(); }
  card.querySelector('button[data-act="done"]').addEventListener("click", closeModal);
  card.querySelector('button[data-act="reset"]').addEventListener("click", () => {
    setUiTheme(DEFAULT_PREFS.themeId);
    setFont({ fontFamily: DEFAULT_PREFS.fontFamily, fontSize: DEFAULT_PREFS.fontSize });
    closeModal();
    openAppearanceModal();
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", onEsc, true);
}

// Palettes are vendored at build time and validated there, but they arrive over
// the network — so anything interpolated into a style attribute is re-checked
// here rather than trusted twice.
function safeHex(c) {
  return /^#[0-9a-fA-F]{6}$/.test(String(c || "")) ? c : "transparent";
}
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// "Background…" modal — opacity slider + drag-drop image
// ---------------------------------------------------------------------------
function openBackgroundModal() {
  const root = document.getElementById("modal-root") || (() => {
    const d = document.createElement("div"); d.id = "modal-root"; document.body.appendChild(d); return d;
  })();
  root.innerHTML = "";

  const overlay = document.createElement("div");
  overlay.className = "modal-bg";

  const card = document.createElement("div");
  card.className = "modal-card";
  card.innerHTML =
    '<h2>Background</h2>' +
    '<div class="modal-sub">Live preview as you drag the sliders.</div>' +
    '<div class="bg-grid">' +
      '<label class="bg-row"><span>Opacity</span>' +
        '<input type="range" id="bg-opacity" min="0.2" max="1" step="0.02" value="' + bgSettings.opacity + '" />' +
        '<span class="bg-val" id="bg-opacity-v">' + Math.round(bgSettings.opacity*100) + '%</span></label>' +
      '<label class="bg-row"><span>Image blur</span>' +
        '<input type="range" id="bg-blur" min="0" max="40" step="1" value="' + (bgSettings.blur||0) + '" />' +
        '<span class="bg-val" id="bg-blur-v">' + (bgSettings.blur||0) + 'px</span></label>' +
      '<label class="bg-row"><span>Image brightness</span>' +
        '<input type="range" id="bg-brightness" min="0.2" max="1.4" step="0.02" value="' + (bgSettings.brightness||1) + '" />' +
        '<span class="bg-val" id="bg-brightness-v">' + Math.round((bgSettings.brightness||1)*100) + '%</span></label>' +
    '</div>' +
    '<div class="bg-drop" id="bg-drop">' +
      '<div class="bg-thumb" id="bg-thumb"' + (bgSettings.image ? ' style="background-image:url(' + JSON.stringify(bgSettings.image) + ')"' : '') + '></div>' +
      '<div class="bg-drop-hint">' +
        '<strong>Drop an image here</strong>' +
        '<span>or click to choose. PNG / JPG / WEBP. Stored locally in this browser.</span>' +
        '<input type="file" id="bg-file" accept="image/*" hidden />' +
      '</div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="modal-btn ghost" data-act="clear">Remove image</button>' +
      '<button class="modal-btn ghost" data-act="reset">Reset</button>' +
      '<button class="modal-btn" data-act="done">Done</button>' +
    '</div>';
  overlay.appendChild(card);
  root.appendChild(overlay);

  const $ = (id) => document.getElementById(id);
  const opacity = $("bg-opacity");
  const blur = $("bg-blur");
  const brightness = $("bg-brightness");
  const thumb = $("bg-thumb");

  opacity.addEventListener("input", () => {
    bgSettings.opacity = Number(opacity.value);
    $("bg-opacity-v").textContent = Math.round(bgSettings.opacity*100) + "%";
    saveBgSettings(); applyBgSettings();
  });
  blur.addEventListener("input", () => {
    bgSettings.blur = Number(blur.value);
    $("bg-blur-v").textContent = bgSettings.blur + "px";
    saveBgSettings(); applyBgSettings();
  });
  brightness.addEventListener("input", () => {
    bgSettings.brightness = Number(brightness.value);
    $("bg-brightness-v").textContent = Math.round(bgSettings.brightness*100) + "%";
    saveBgSettings(); applyBgSettings();
  });

  const drop = $("bg-drop");
  const fileInput = $("bg-file");
  drop.addEventListener("click", (e) => { if (e.target.tagName !== "BUTTON") fileInput.click(); });
  fileInput.addEventListener("change", () => readImage(fileInput.files && fileInput.files[0]));
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("dragover"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault(); drop.classList.remove("dragover");
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readImage(f);
  });

  function readImage(file) {
    if (!file || !/^image\//.test(file.type)) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image too large (>5MB). Pick something smaller — it lives in localStorage.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      bgSettings.image = String(reader.result);
      thumb.style.backgroundImage = "url(" + JSON.stringify(bgSettings.image) + ")";
      saveBgSettings(); applyBgSettings();
    };
    reader.readAsDataURL(file);
  }

  card.querySelector('button[data-act="clear"]').addEventListener("click", () => {
    bgSettings.image = "";
    thumb.style.backgroundImage = "";
    saveBgSettings(); applyBgSettings();
  });
  card.querySelector('button[data-act="reset"]').addEventListener("click", () => {
    bgSettings.opacity = 1; bgSettings.image = ""; bgSettings.blur = 0; bgSettings.brightness = 1;
    opacity.value = 1; $("bg-opacity-v").textContent = "100%";
    blur.value = 0; $("bg-blur-v").textContent = "0px";
    brightness.value = 1; $("bg-brightness-v").textContent = "100%";
    thumb.style.backgroundImage = "";
    saveBgSettings(); applyBgSettings();
  });

  const close = () => { root.innerHTML = ""; document.removeEventListener("keydown", onEsc, true); };
  function onEsc(ev) { if (ev.key === "Escape") close(); }
  card.querySelector('button[data-act="done"]').addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", onEsc, true);
}
function closeMenu() {
  const root = document.getElementById("menu-root");
  const fab = document.getElementById("menu-fab");
  if (root) root.innerHTML = "";
  if (fab) fab.classList.remove("open");
  document.removeEventListener("click", outsideClose, true);
  document.removeEventListener("keydown", escClose, true);
}
