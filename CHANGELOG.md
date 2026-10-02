# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH).

## [Unreleased]

### Added
- The whole Gogh catalog (~1250 themes) in the theme picker. The curated 46
  stay bundled; the rest (`public/gogh-themes-all.json`, ~400 KB) loads when
  the picker opens, or at boot when the saved theme is not curated.
  `npm run themes` refreshes both and keeps saved ids stable across upstream
  renames.
- Inline images in the terminal (Sixel and the iTerm2 protocol: `imgcat`,
  `chafa`, `yazi` previews) via `@xterm/addon-image`.
- OSC 9;4 progress: a thin bar on top of the pane and a percentage on its tab.
- ☰ → "Export pane as HTML" downloads the pane's scrollback with colours
  (`@xterm/addon-serialize`).
- JetBrains Mono, Fira Code, IBM Plex Mono and Iosevka are served by the app
  (`public/fonts`, built from `@fontsource`, SIL OFL), so they look the same on
  every device without installing anything. Only the chosen face downloads;
  panes re-measure once it has loaded.
- One SVG icon set (Lucide paths, ISC) replaces the Unicode/emoji glyphs in
  the menu, tab bar, key bar, search bar and zen exit.
- Images into the terminal: drag & drop onto a pane, paste with Cmd/Ctrl+V,
  or the 📎 button on the phone key bar. The image is uploaded to
  `~/.web-terminal/uploads` (`WEB_TERMINAL_UPLOAD_DIR`) and its path is typed
  into the pane, so Claude Code attaches it. PNG, JPEG, GIF, WebP and HEIC
  (converted to JPEG on macOS), up to 25 MB; files older than 7 days are
  deleted. The endpoint needs auth, an allowed Origin and a custom header.

### Changed
- xterm.js addons pinned to the releases built for xterm 5.5 (search 0.15,
  webgl 0.18, web-links 0.11, unicode11 0.8, clipboard 0.1); 0.2.0 shipped
  the xterm 6 builds by mistake.
- Closing a tab or a pane with its ✕ takes two taps: the first turns it into
  a red "¿Cerrar?" for 3 s, the second closes. Stray taps no longer kill a
  shell. The menu's close actions are unchanged.
- `exit` (or Ctrl+D) closes the pane, and its tab when it was the only pane.
  In the last tab a fresh shell replaces it instead.
- "Open existing session" lists each session under its tab name, with the
  program running in it (zsh, claude, vim…), and reopens it with that name.
- The per-pane title bar (title, ⇋ ⇵ ✕) is hidden to give the terminal more
  room. Split and close are in the ☰ menu and on Cmd/Ctrl+D, Cmd/Ctrl+Shift+D.

## [0.2.0] — 2026-10-02

### Added
- Cloudflare Access auth (`WEB_TERMINAL_CF_ACCESS_TEAM` + `_AUD`): every
  request through the tunnel must carry a valid Access JWT, or it gets a 403.
- Find in scrollback: Cmd+F (macOS) / Ctrl+Shift+F, with match count, and
  Enter / Shift+Enter to step through.
- Clickable URLs (Cmd/Ctrl+click), Unicode 11 widths (emoji, CJK), and GPU
  (WebGL) rendering while the background is opaque.
- OSC 52: apps in the shell (vim, tmux, Claude Code) can copy to the browser
  clipboard. Write-only — a process can never read the clipboard.

### Fixed
- Stray mouse reports (`<35;12;40M`) after a TUI dies with mouse tracking on.
  The server drops them when the bare shell is in the foreground, and a pane
  that reattaches to a fresh shell resets its terminal modes.
- A rejected WebSocket origin (4003) now explains itself in the pane.

### Security
- The audit log no longer stores typed text, only the length of each line
  (typed lines can be passwords or tokens). `WEB_TERMINAL_AUDIT_INPUT=1`
  restores the full text.
- The local bypass and WebSocket origin check no longer trust the Tailscale
  range (100.64/10).
- `qs` bumped to 6.16 via express 4.22.3 (two moderate advisories). `npm audit`: 0.

## [0.1.1] — 2026-08-18

### Security
- Update `ws` to 8.21.3 (fixes a high-severity uninitialized-memory disclosure
  and two DoS advisories in the WebSocket layer) and `express` to 4.22.2
  (vulnerable `qs`). Dev-only `esbuild` bumped to 0.28.2. `npm audit`: 0.

## [0.1.0] — 2026-08-18

First packaged, self-hostable release.

### Added
- Browser terminal: real PTY streamed over WebSocket, split panes, tabs, and
  sessions that survive reconnects.
- Theme picker with curated [Gogh](https://github.com/Gogh-Co/Gogh) palettes,
  plus per-account theme/font, persisted server-side.
- Phone/iPad support: installable PWA, safe-area handling, on-screen key bar
  (Termux-style, with an arrow d-pad and enter), zen mode, and touch copy via a
  native-selection overlay.
- Two auth methods — shared password (`WEB_TERMINAL_PASSWORD`) and Google OAuth
  (restricted by domain or an email allowlist) — plus an optional local-network
  bypass. At least one is required at startup.
- Guided installer (`install.sh`): local vs Docker, auth choice, prompts for the
  env it needs, writes a `chmod 600 .env`, then builds/runs.
- Docker support: `Dockerfile` (Debian-slim so node-pty prebuilds load) and
  `docker-compose.yml`.
- `README.md`, `.env.example`, MIT `LICENSE`.

### Security
- Shell environment is sanitized: `WEB_TERMINAL_*` and Google secrets are
  stripped from what the PTY inherits.
- WebSocket handshakes are checked against an allowed-origin list (CSWSH).
- Per-user cap on concurrent terminals.
- Security headers set at the origin (`nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, COOP, and HSTS over HTTPS).

[Unreleased]: https://example.com/compare/v0.2.0...HEAD
[0.2.0]: https://example.com/releases/tag/v0.2.0
[0.1.1]: https://example.com/releases/tag/v0.1.1
[0.1.0]: https://example.com/releases/tag/v0.1.0
