/* eslint-disable no-console */
const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const watch = process.argv.includes("--watch");

// Copy xterm.css from package to public/lib so the served HTML can <link> it
// (esbuild bundles JS + the CSS imported in JS, but our HTML also wants xterm.css separate).
fs.mkdirSync(path.join(__dirname, "..", "public", "lib"), { recursive: true });
const xtermCss = require.resolve("@xterm/xterm/css/xterm.css");
fs.copyFileSync(xtermCss, path.join(__dirname, "..", "public", "lib", "xterm.css"));

const ctx = {
  entryPoints: [path.join(__dirname, "..", "public", "app.src.js")],
  bundle: true,
  outfile: path.join(__dirname, "..", "public", "app.js"),
  format: "esm",
  platform: "browser",
  target: ["chrome120", "safari16", "firefox120"],
  sourcemap: true,
  minify: !watch,
  loader: {
    ".css": "css",
    ".wasm": "file",
    ".woff": "file",
    ".woff2": "file",
  },
  assetNames: "lib/[name]-[hash]",
  publicPath: "/",
  logLevel: "info",
};

if (watch) {
  esbuild.context(ctx).then((c) => c.watch());
} else {
  esbuild.build(ctx).catch((e) => { console.error(e); process.exit(1); });
}
