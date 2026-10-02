# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH).

## [Unreleased]

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
