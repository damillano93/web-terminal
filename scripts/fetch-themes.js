#!/usr/bin/env node
/* eslint-disable no-console */
//
// Vendors a curated slice of the Gogh palette catalog into public/gogh-themes.json.
//
// Gogh (https://github.com/Gogh-Co/Gogh) ships ~1250 themes as one .yml each.
// Two outputs:
//   public/gogh-themes.json      the CURATED slice below, bundled into app.js so
//                                the picker opens instantly with the popular ones
//   public/gogh-themes-all.json  the whole catalog, compact, fetched by the page
//                                only when the picker opens (or when the saved
//                                theme is not in the curated slice)
//
//   npm run themes
//
// A Gogh theme is COLOURS ONLY — 16 ANSI slots plus background/foreground/cursor.
// It says nothing about fonts; that is a separate setting in the app.

const fs = require("fs");
const path = require("path");

const RAW = "https://raw.githubusercontent.com/Gogh-Co/Gogh/master/themes";
const OUT = path.join(__dirname, "..", "public", "gogh-themes.json");
const OUT_ALL = path.join(__dirname, "..", "public", "gogh-themes-all.json");
const TREE = "https://api.github.com/repos/Gogh-Co/Gogh/git/trees/master?recursive=1";

// Exact filenames (minus .yml) from the Gogh repo. Order here is the order in
// the picker, so keep the popular ones near the top.
// An entry may be [filename, id] when upstream renamed the file: the id is what
// accounts have saved, so it must not change with the filename.
const CURATED = [
  "Dracula",
  "Nord",
  ["TokyoNight", "tokyo-night"],
  ["TokyoNight Storm", "tokyo-night-storm"],
  "Catppuccin Mocha",
  "Catppuccin Macchiato",
  "Catppuccin Frappe",
  "Gruvbox Dark",
  "Gruvbox Material Dark",
  "One Dark",
  "Solarized Dark",
  "GitHub Dark",
  "Monokai Pro",
  "Monokai Soda",
  "Material",
  "Ayu Dark",
  "Ayu Mirage",
  "Everforest Dark Medium",
  "Kanagawa Wave",
  "Kanagawa Dragon",
  "Rose Pine",
  "Rose Pine Moon",
  "Night Owl",
  "Oceanic Next",
  "Snazzy",
  ["Cobalt2", "cobalt-2"],
  "Horizon Dark",
  "Iceberg",
  "Synthwave",
  "Laserwave",
  "Sonokai",
  "Zenburn",
  "Panda",
  "Apprentice",
  "Afterglow",
  // Light variants — worth having for daylight and for the e-paper crowd.
  "Solarized Light",
  "Github Light",
  "Catppuccin Latte",
  "Ayu Light",
  "Everforest Light Medium",
  "Gruvbox Material Light",
  "Tokyo Night Light",
  "Nord Light",
  "Papercolor Light",
  "Rose Pine Dawn",
  "Horizon Bright",
];

// Minimal reader for the subset of YAML Gogh actually uses: flat `key: 'value'`
// lines with optional trailing `# comment`. Pulling in a YAML dependency for
// this shape would be more code than the parser.
function parseGoghYaml(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = /^([a-z_0-9]+)\s*:\s*'([^']*)'/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// slug is the stable id we persist per account; renaming a theme upstream would
// otherwise silently reset everyone's choice.
function slugify(name) {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// Fetch and normalise one theme; returns [theme, null] or [null, reason].
async function fetchTheme(name) {
  const res = await fetch(`${RAW}/${encodeURIComponent(name)}.yml`);
  if (!res.ok) return [null, `HTTP ${res.status}`];
  const y = parseGoghYaml(await res.text());
  const ansi = [];
  for (let i = 1; i <= 16; i++) ansi.push(y[`color_${String(i).padStart(2, "0")}`]);
  // The page paints these straight into CSS, so only plain #rrggbb gets in.
  if (ansi.some((c) => !HEX.test(c || "")) || !HEX.test(y.background || "") || !HEX.test(y.foreground || "")) {
    return [null, "incomplete"];
  }
  return [{
    id: slugify(name),
    name: y.name || name,
    author: y.author || "",
    variant: y.variant === "light" ? "light" : "dark",
    bg: y.background,
    fg: y.foreground,
    cursor: HEX.test(y.cursor || "") ? y.cursor : y.foreground,
    ansi,
  }, null];
}

// Run `fn` over `items` with at most `n` in flight.
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

async function main() {
  const themes = [];
  const missing = [];

  for (const entry of CURATED) {
    const [name, legacyId] = Array.isArray(entry) ? entry : [entry, null];
    const [t, why] = await fetchTheme(name);
    if (!t) { missing.push(`${name} (${why})`); continue; }
    if (legacyId) t.id = legacyId;
    themes.push(t);
    console.log(`  ✓ ${name}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(themes, null, 2) + "\n");
  console.log(`\n${themes.length} themes → ${path.relative(process.cwd(), OUT)}`);

  // Whole catalog, sorted by name, ids unique.
  const tree = await (await fetch(TREE, { headers: { "User-Agent": "web-terminal" } })).json();
  const names = (tree.tree || [])
    .map((e) => e.path)
    .filter((p) => /^themes\/[^/]+\.yml$/.test(p))
    .map((p) => p.slice("themes/".length, -".yml".length));
  const results = await pool(names, 16, fetchTheme);
  const seen = new Set();
  const all = [];
  results.forEach(([t], i) => {
    if (!t) { missing.push(`${names[i]} (all)`); return; }
    if (seen.has(t.id)) return;
    seen.add(t.id);
    all.push(t);
  });
  all.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(OUT_ALL, JSON.stringify(all) + "\n");
  console.log(`${all.length} themes → ${path.relative(process.cwd(), OUT_ALL)}`);

  if (missing.length) {
    console.warn(`\n${missing.length} not fetched:\n  ` + missing.join("\n  "));
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
