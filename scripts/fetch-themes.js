#!/usr/bin/env node
/* eslint-disable no-console */
//
// Vendors a curated slice of the Gogh palette catalog into public/gogh-themes.json.
//
// Gogh (https://github.com/Gogh-Co/Gogh) ships 366 themes as one .yml each. We
// take ~40 rather than all of them: the whole set is mostly near-duplicates, and
// a picker with 366 rows is worse to use than one with 40. Re-run this script to
// refresh the palettes or to add a name to CURATED below.
//
//   npm run themes
//
// A Gogh theme is COLOURS ONLY — 16 ANSI slots plus background/foreground/cursor.
// It says nothing about fonts; that is a separate setting in the app.

const fs = require("fs");
const path = require("path");

const RAW = "https://raw.githubusercontent.com/Gogh-Co/Gogh/master/themes";
const OUT = path.join(__dirname, "..", "public", "gogh-themes.json");

// Exact filenames (minus .yml) from the Gogh repo. Order here is the order in
// the picker, so keep the popular ones near the top.
const CURATED = [
  "Dracula",
  "Nord",
  "Tokyo Night",
  "Tokyo Night Storm",
  "Catppuccin Mocha",
  "Catppuccin Macchiato",
  "Catppuccin Frappé",
  "Gruvbox Dark",
  "Gruvbox Material Dark",
  "One Dark",
  "Solarized Dark",
  "Github Dark",
  "Monokai Pro",
  "Monokai Soda",
  "Material",
  "Ayu Dark",
  "Ayu Mirage",
  "Everforest Dark Medium",
  "Kanagawa Wave",
  "Kanagawa Dragon",
  "Rosé Pine",
  "Rosé Pine Moon",
  "Night Owl",
  "Oceanic Next",
  "Snazzy",
  "Cobalt 2",
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
  "Rosé Pine Dawn",
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

async function main() {
  const themes = [];
  const missing = [];

  for (const name of CURATED) {
    const url = `${RAW}/${encodeURIComponent(name)}.yml`;
    const res = await fetch(url);
    if (!res.ok) { missing.push(`${name} (HTTP ${res.status})`); continue; }
    const y = parseGoghYaml(await res.text());

    const ansi = [];
    for (let i = 1; i <= 16; i++) ansi.push(y[`color_${String(i).padStart(2, "0")}`]);
    if (ansi.some((c) => !c) || !y.background || !y.foreground) {
      missing.push(`${name} (incomplete)`);
      continue;
    }

    themes.push({
      id: slugify(name),
      name: y.name || name,
      author: y.author || "",
      variant: y.variant === "light" ? "light" : "dark",
      bg: y.background,
      fg: y.foreground,
      cursor: y.cursor || y.foreground,
      ansi,
    });
    console.log(`  ✓ ${name}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(themes, null, 2) + "\n");
  console.log(`\n${themes.length} themes → ${path.relative(process.cwd(), OUT)}`);
  if (missing.length) {
    console.warn(`\n${missing.length} not fetched:\n  ` + missing.join("\n  "));
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
