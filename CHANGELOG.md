# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH).

## [Unreleased]

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

[Unreleased]: https://example.com/compare/v0.1.1...HEAD
[0.1.1]: https://example.com/releases/tag/v0.1.1
[0.1.0]: https://example.com/releases/tag/v0.1.0
