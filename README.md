# web-terminal

A browser-based terminal: a real shell (`bash`/`zsh`) running on the host,
streamed to any device over a WebSocket, with split panes, tabs, tabs that
survive reconnects, a searchable theme picker (Gogh palettes), and a phone/iPad
layout with an on-screen key bar and touch copy.

Frontend is [xterm.js](https://xtermjs.org); backend is Node + Express +
[node-pty](https://github.com/microsoft/node-pty). One process, no database.

> ### ⚠️ Security — read this first
>
> **This gives whoever logs in a real shell on the machine, running as the user
> that started the server.** Treat it like SSH:
>
> - **Never** expose it to the internet without authentication and HTTPS.
> - Put it behind a reverse proxy with TLS (Caddy/nginx/Cloudflare), or only
>   reach it over a private network / VPN (e.g. Tailscale).
> - Set a strong `WEB_TERMINAL_SECRET` and a strong password (or OAuth).
> - If you enable Google OAuth, **restrict it** with `WEB_TERMINAL_ALLOWED_DOMAIN`
>   or `WEB_TERMINAL_ALLOWED_EMAILS`. With neither set, *any* Google account can
>   log in.
> - The shell does **not** run in a sandbox. It has the full access of the user
>   that runs the server.

---

## Quick start (guided installer)

The easiest way — it asks local vs Docker, the auth method, and the settings it
needs, writes a `chmod 600 .env`, and builds/runs for you:

```bash
git clone <your-repo-url> web-terminal && cd web-terminal
bash install.sh
```

## Quick start (manual)

Requires **Node ≥ 20**. Pick an auth method (a password is simplest):

```bash
git clone <your-repo-url> web-terminal && cd web-terminal
npm install
npm run build                       # bundles the frontend into public/

export WEB_TERMINAL_SECRET=$(openssl rand -hex 32)
export WEB_TERMINAL_PASSWORD='a-long-password'
npm start                           # http://127.0.0.1:7681
```

Open http://127.0.0.1:7681 and sign in with the password.

### Docker

```bash
cp .env.example .env                # then edit: set PASSWORD and SECRET
docker compose up -d --build        # http://localhost:7681
```

The image is Debian-slim (glibc) so node-pty's prebuilt binary loads without a
compiler. Per-instance data (prefs, workspaces, logs) persists in the `wt-data`
volume.

---

## Configuration

All config is via environment variables. See **[`.env.example`](.env.example)**
for the annotated full list; the essentials:

| Variable | Purpose |
|---|---|
| `PORT` / `BIND` | Listen port (default `7681`) and address (`127.0.0.1` local, `0.0.0.0` all). |
| `WEB_TERMINAL_SECRET` | **Set this.** Random string that signs the auth cookie. Unset = regenerated each boot = everyone logged out on restart. |
| `WEB_TERMINAL_ORIGIN` | Public origin(s) for the WebSocket Origin check when behind a proxy, e.g. `https://terminal.example.com`. |
| `WEB_TERMINAL_SHELL` | Shell to spawn (default `$SHELL`, else `/bin/bash`). |
| `WEB_TERMINAL_MAX_SESSIONS` | Max concurrent terminals per user (default `24`). |

You must configure **at least one** auth method or the server refuses to start.

### Auth A — shared password

```bash
export WEB_TERMINAL_PASSWORD='something long and unguessable'
export WEB_TERMINAL_USER='me'        # optional: the session owner name
```

Simple and good behind a VPN/LAN. Rate-limited to 10 attempts / 15 min per IP.

### Auth B — Google OAuth

1. Create an OAuth client at
   [Google Cloud → Credentials](https://console.cloud.google.com/apis/credentials)
   → *Create credentials* → *OAuth client ID* → *Web application*.
2. Add an **Authorized redirect URI**: `https://<your-host>/auth/google/callback`.
3. Set:

```bash
export WEB_TERMINAL_GOOGLE_CLIENT_ID='...'
export WEB_TERMINAL_GOOGLE_CLIENT_SECRET='...'
export WEB_TERMINAL_GOOGLE_REDIRECT='https://<your-host>/auth/google/callback'
# Restrict who gets in (do NOT leave both empty on a public instance):
export WEB_TERMINAL_ALLOWED_DOMAIN='example.com'
# or:
export WEB_TERMINAL_ALLOWED_EMAILS='you@example.com,mate@example.com'
```

### Auth D — Cloudflare Access (recommended for internet access)

Put the app behind a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
and let **Cloudflare Access** do the login at the edge, so unauthenticated
traffic never reaches the box:

1. Zero Trust → *Access* → *Applications* → *Add an application* → *Self-hosted*.
   Application domain: your public hostname. Session duration: e.g. 24h.
2. Add a policy: **Allow**, *Include* → *Emails* → your address only.
   Login method: One-time PIN (default) and/or Google.
3. Copy the **Application Audience (AUD) Tag** from the application's overview
   and your team name (`<team>.cloudflareaccess.com`), then:

```bash
export WEB_TERMINAL_CF_ACCESS_TEAM='<team>'
export WEB_TERMINAL_CF_ACCESS_AUD='<aud tag>'
export WEB_TERMINAL_ALLOWED_EMAILS='you@example.com'   # still enforced app-side
```

The server verifies the `Cf-Access-Jwt-Assertion` JWT on every request
(signature against the team's keys, expiry, issuer, audience). Any request that
arrives through Cloudflare *without* a valid assertion is refused with 403, so
enable the Access application before setting these variables. Google OAuth
(Auth B) becomes unnecessary and can be removed.

### Auth C — local-network bypass

```bash
export WEB_TERMINAL_LOCAL_BYPASS=1
```

Skips login for requests arriving **directly** (not through a proxy) from
loopback or RFC1918 ranges — handy for LAN access without the OAuth round-trip. It rejects anything carrying proxy headers, so
internet traffic through a reverse proxy still has to log in. Note it trusts the
**whole** private range, not just your own devices. VPN/overlay ranges such as
Tailscale's 100.64/10 are deliberately not trusted.

---

## Running as a service

### Linux (systemd)

Create `/etc/systemd/system/web-terminal.service`:

```ini
[Unit]
Description=web-terminal
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/opt/web-terminal
EnvironmentFile=/opt/web-terminal/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now web-terminal
```

### macOS (launchd)

Run under your login session with a LaunchAgent at
`~/Library/LaunchAgents/com.you.web-terminal.plist` pointing `node server.js`
with the env vars in `EnvironmentVariables`. Use the system Node
(`/opt/homebrew/bin/node`) — do **not** vendor a copy of the Node binary; it
links Homebrew libraries by absolute path and breaks on the next `brew upgrade`.

### Behind a reverse proxy (recommended for any public access)

Terminate TLS at the proxy and forward to `127.0.0.1:7681`, passing WebSocket
upgrade headers. Example (Caddy):

```
terminal.example.com {
    reverse_proxy 127.0.0.1:7681
}
```

Then set `WEB_TERMINAL_ORIGIN=https://terminal.example.com`.

---

## Keyboard shortcuts

| Keys | Action |
|---|---|
| Cmd/Ctrl+D · Cmd/Ctrl+Shift+D | Split right · split down |
| Cmd+F (macOS) · Ctrl+Shift+F | Find in scrollback (Enter / Shift+Enter: next / previous, Esc: close) |
| Cmd/Ctrl+click on a URL | Open it in a new tab |
| Cmd+C (macOS) · Ctrl+Shift+C | Copy the selection |
| Cmd/Ctrl+Shift+Z | Zen mode |

Apps inside the shell can also copy to your clipboard with OSC 52 (vim's
`"+y` with OSC 52 enabled, tmux `set -g set-clipboard on`, Claude Code).

---

## Development

```bash
npm run watch      # rebuild the frontend on change
npm start          # run the server
npm run themes     # re-fetch the curated Gogh palettes
```

- `server.js` — the whole backend (auth, sessions, PTY, WebSocket, static).
- `public/app.src.js` — frontend source, bundled to `public/app.js` by esbuild.
- `scripts/` — build and theme-fetch helpers.

## License

[MIT](LICENSE) © 2026 David Millán
