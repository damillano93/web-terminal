# web-terminal

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Node ≥ 20](https://img.shields.io/badge/node-%E2%89%A5%2020-brightgreen.svg)
![Platforms](https://img.shields.io/badge/runs%20on-macOS%20%7C%20Linux%20%7C%20Docker-blue.svg)

**Your own machine's shell, in any browser.** A self-hosted web terminal: a real
`zsh`/`bash` on the host, streamed over a WebSocket to your laptop, phone or
iPad, with tabs, split panes and shells that keep running when you close the
tab, lose the connection or restart the server.

Built for working remotely on one machine from several devices, and for
long-running terminal apps such as Claude Code, vim or htop.

Frontend is [xterm.js](https://xtermjs.org); backend is Node + Express +
[node-pty](https://github.com/microsoft/node-pty). No database, no account
system of its own, nothing to host besides one Node process.

> [!WARNING]
> **This gives whoever logs in a real shell on the machine, running as the user
> that started the server.** Treat it like SSH. Read [Security](#security)
> before exposing it beyond `localhost`.

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Security](#security)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [Running as a service](#running-as-a-service)
- [How it works](#how-it-works)
- [Using it](#using-it)
- [iOS and Mac apps (optional)](#ios-and-mac-apps-optional)
- [Development](#development)
- [License](#license)

## Features

**Terminal**

- Tabs and split panes (right / down), restored per workspace when you come back.
- Shells survive reconnects, closed tabs and server restarts. Reattaching gives
  you the exact screen back: scrollback, colours, alternate screen.
- Search in scrollback, clickable URLs, export a pane as HTML with colours.
- Inline images (Sixel and the iTerm2 protocol: `imgcat`, `chafa`, `yazi`).
- Drop or paste an image onto a pane: it is uploaded and its path is typed for
  you, so tools like Claude Code attach it.
- Clipboard from inside the shell with OSC 52 (vim, tmux, Claude Code).
- Around 1250 colour themes ([Gogh](https://gogh-co.github.io/Gogh/)) in a
  searchable picker, and four bundled fonts (JetBrains Mono, Fira Code, IBM
  Plex Mono, Iosevka). Theme and font are saved per account.

**Shell integration (zsh)**

- New tabs and splits open in the current directory.
- Tabs name themselves after what runs in them, with a dot for running, failed
  or new output.
- Jump between prompts, and get a notification when a long command finishes in
  a tab you are not looking at.

**Remote and mobile**

- Installable PWA with a phone/iPad layout and an on-screen key bar (Esc, Ctrl,
  arrows…).
- Tuned for slow links: WebSocket compression, coalesced output and a
  mosh-style predictive echo at the prompt.
- Optional native wrappers for iOS/iPadOS and macOS.

**Access**

- Four ways to authenticate: shared password, Google OAuth, Cloudflare Access,
  and an optional local-network bypass.
- Command palette with saved commands, per account.
- Audit log of sessions (typed text is not recorded unless you ask for it).

> The interface labels are currently in Spanish ("Nueva tab", "Guardar
> comando"…). This README and the code are in English.

## Quick start

Requires **Node ≥ 20** on macOS or Linux, or Docker. Windows is untested.

### Guided installer

It asks local vs Docker and which auth method you want, writes a `chmod 600`
`.env`, then builds and runs:

```bash
git clone https://github.com/damillano93/web-terminal.git
cd web-terminal
bash install.sh
```

### Manual

```bash
git clone https://github.com/damillano93/web-terminal.git
cd web-terminal
npm install
npm run build                       # bundles the frontend into public/

export WEB_TERMINAL_SECRET=$(openssl rand -hex 32)
export WEB_TERMINAL_PASSWORD='a-long-password'
npm start                           # http://127.0.0.1:7681
```

Open <http://127.0.0.1:7681> and sign in with the password.

### Docker

```bash
git clone https://github.com/damillano93/web-terminal.git
cd web-terminal
cp .env.example .env                # set WEB_TERMINAL_PASSWORD and WEB_TERMINAL_SECRET
docker compose up -d --build        # http://localhost:7681
```

The image is Debian-slim (glibc) so node-pty's prebuilt binary loads without a
compiler. Per-instance data (prefs, workspaces, logs) persists in the `wt-data`
volume. Note that in Docker the shell runs **inside the container**, not on the
host.

## Security

- **Never** expose it to the internet without authentication and HTTPS.
- Put it behind a reverse proxy with TLS (Caddy, nginx, Cloudflare Tunnel), or
  only reach it over a private network.
- Set a strong `WEB_TERMINAL_SECRET` and a password of 12+ characters, or use
  Cloudflare Access / Google OAuth.
- The shell is **not sandboxed**. It has the full access of the user that runs
  the server, including that user's files, so it can read the server's own
  configuration (`.env`, the launchd plist) and with it the signing secret.
- **Everyone you let in is the same OS user.** Sessions and workspaces are
  listed per account, but that is tidiness, not isolation: any allowed user
  can read and change everything the others can. Only give access to people
  you would give your own login to.

What the server does on its side:

- Refuses to start without an auth method, with Google OAuth and no allowlist,
  or with the local-network bypass inside a container.
- Issues a login cookie that is signed with its own key, carries how and when
  you logged in, expires after 7 days, and is re-checked against the current
  configuration on every request.
- Checks every WebSocket handshake against an allowed-origin list (blocks
  cross-site WebSocket hijacking).
- Sends a Content-Security-Policy that only runs the app's own scripts, plus
  `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, COOP, and HSTS over
  HTTPS.
- Keeps `WEB_TERMINAL_*` and the Google credentials out of the environment the
  shell inherits, so they do not show up in `env` or leak into child processes.
- Rate-limits password logins (10 attempts / 15 min per IPv4 address or IPv6 /64).
- Caps concurrent terminals per user, and keeps its logs and data files
  readable by the owner only.

Found a vulnerability? Please open a
[private security advisory](https://github.com/damillano93/web-terminal/security/advisories/new)
rather than a public issue.

## Configuration

All configuration is through environment variables. **[`.env.example`](.env.example)**
is the annotated full list; the essentials:

| Variable | Purpose |
|---|---|
| `PORT` / `BIND` | Listen port (default `7681`) and address (`127.0.0.1` local only, `0.0.0.0` all interfaces). |
| `WEB_TERMINAL_SECRET` | **Set this.** Random string that signs the auth cookie. Unset means a new one each boot, which logs everyone out on restart. |
| `WEB_TERMINAL_ORIGIN` | Public origin(s) for the WebSocket Origin check behind a proxy, e.g. `https://terminal.example.com`. |
| `WEB_TERMINAL_SHELL` | Shell to spawn (default `$SHELL`, else `/bin/bash`). |
| `WEB_TERMINAL_MAX_SESSIONS` | Max concurrent terminals per user (default `24`). |
| `WEB_TERMINAL_LOG_DIR` | Where the audit log (`web-terminal.log`) goes. Default `~/Library/Logs`; on Linux set it, e.g. `/var/log/web-terminal`. |
| `WEB_TERMINAL_AUDIT_INPUT` | `1` logs the text of typed lines. Off by default: typed lines can be passwords. |
| `WEB_TERMINAL_CSP` | `0` turns the Content-Security-Policy header off. Leave it on. |
| `WEB_TERMINAL_UPLOAD_DIR` | Where dropped/pasted images are saved (default `~/.web-terminal/uploads`, deleted after 7 days). |

## Authentication

Configure **at least one** method or the server refuses to start.

| Method | Good for |
|---|---|
| [A. Shared password](#a-shared-password) | A single user on a LAN or VPN. |
| [B. Google OAuth](#b-google-oauth) | Sign-in with Google accounts you allow. |
| [C. Local-network bypass](#c-local-network-bypass) | No login from your own LAN, on top of another method. |
| [D. Cloudflare Access](#d-cloudflare-access) | Internet access. Recommended: unauthenticated traffic never reaches the machine. |

### A. Shared password

```bash
export WEB_TERMINAL_PASSWORD='something long and unguessable'   # 12+ characters
export WEB_TERMINAL_USER='me'        # optional: the session owner name
```

The password is the only thing between a visitor and a shell, so make it long.
Behind a reverse proxy, make sure the proxy sends `X-Forwarded-For`; otherwise
every visitor shares one rate-limit bucket.

### B. Google OAuth

1. Create an OAuth client at
   [Google Cloud → Credentials](https://console.cloud.google.com/apis/credentials)
   → *Create credentials* → *OAuth client ID* → *Web application*.
2. Add an **Authorized redirect URI**: `https://<your-host>/auth/google/callback`.
3. Set:

```bash
export WEB_TERMINAL_GOOGLE_CLIENT_ID='...'
export WEB_TERMINAL_GOOGLE_CLIENT_SECRET='...'
export WEB_TERMINAL_GOOGLE_REDIRECT='https://<your-host>/auth/google/callback'
# Who gets in. One of these is required:
export WEB_TERMINAL_ALLOWED_EMAILS='you@example.com,mate@example.com'
# or a whole Google Workspace domain:
export WEB_TERMINAL_ALLOWED_DOMAIN='example.com'
```

With neither set the server refuses to start, because any Google account would
get a shell. (`WEB_TERMINAL_ALLOW_ANY_GOOGLE=1` overrides that; do not.)

### C. Local-network bypass

```bash
export WEB_TERMINAL_LOCAL_BYPASS=1
```

Skips login for requests arriving **directly** from RFC1918 addresses
(10.x, 172.16–31.x, 192.168.x) that address the machine by its own IP or
hostname. Use it together with another method, for a home network only:

- It trusts **every** device on that network, not just yours.
- A request that carries proxy headers is never trusted, but a proxy that adds
  none cannot be told apart from a direct connection. For that reason
  connections from the machine itself (`127.0.0.1`) are **not** trusted unless
  you also set `WEB_TERMINAL_LOCAL_BYPASS_LOOPBACK=1`. Only do that if nothing
  on the machine forwards outside traffic to this port (a bare nginx
  `proxy_pass`, `socat`, `ssh -R`).
- It is refused inside a container: there every client arrives from the
  bridge's private address, so everyone would be trusted.
- VPN/overlay ranges such as Tailscale's 100.64/10 are deliberately not trusted.

### D. Cloudflare Access

Put the app behind a
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
and let **Cloudflare Access** do the login at the edge:

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
export WEB_TERMINAL_ORIGIN='https://terminal.example.com'
```

The server verifies the `Cf-Access-Jwt-Assertion` JWT on every request
(signature against the team's keys, expiry, issuer, audience). Any request that
arrives through Cloudflare *without* a valid assertion is refused with 403, so
create the Access application **before** setting these variables.

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

Create `~/Library/LaunchAgents/com.you.web-terminal.plist` (adjust the paths
and put your variables under `EnvironmentVariables`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.you.web-terminal</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>/Users/you/web-terminal/server.js</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/you/web-terminal</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>WEB_TERMINAL_SECRET</key><string>…</string>
    <key>WEB_TERMINAL_PASSWORD</key><string>…</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
```

```bash
chmod 600 ~/Library/LaunchAgents/com.you.web-terminal.plist
launchctl load ~/Library/LaunchAgents/com.you.web-terminal.plist
```

Use the system Node (`/opt/homebrew/bin/node`). Do **not** vendor a copy of the
Node binary: it links Homebrew libraries by absolute path and breaks on the next
`brew upgrade`.

If macOS keeps asking for permission when a shell touches `~/Documents` or
`~/Desktop`, `bash scripts/grant-fda.sh` walks you through giving that Node
binary Full Disk Access.

### Behind a reverse proxy

Terminate TLS at the proxy and forward to `127.0.0.1:7681`, passing the
WebSocket upgrade headers. Example (Caddy):

```
terminal.example.com {
    reverse_proxy 127.0.0.1:7681
}
```

Then set `WEB_TERMINAL_ORIGIN=https://terminal.example.com`.

## How it works

```
 browser / app ──HTTPS + WebSocket──▶ server.js ──Unix socket──▶ pty-host.js ──▶ zsh / bash
                                      auth, static,              owns the PTYs and a
                                      sessions, uploads          headless xterm.js mirror
```

The shells do not live in the web server. `server.js` starts **pty-host**
(`pty-host.js`) once, detached in its own session, and talks to it over a Unix
socket (`~/.web-terminal/pty-host.sock`). Restarting or updating the server
(launchd, systemd, Docker) leaves every shell running; the new server adopts
them, and reattaching clients get the exact screen back from the host's
headless xterm.js mirror.

Only restarting pty-host ends the shells. That is needed only when
`pty-host.js` itself changes: `bash scripts/restart-pty-host.sh`. A reboot ends
them too.

`GET /healthz` answers `ok` without authentication, for monitors.

## Using it

### Shell integration (zsh)

For zsh, new shells start with `ZDOTDIR` pointed at `shell-integration/zsh/`,
which loads your own `.zshenv`/`.zprofile`/`.zshrc`/`.zlogin` unchanged and then
adds two hooks that print invisible escape sequences (OSC 7 and OSC 133). With
them the terminal knows the current directory and when each command starts and
ends, which gives:

- new tabs and splits open in the current directory;
- tabs named after what runs in them (`claude · my-project`) until you rename one;
- a dot on the tab: running, last command failed, or new output;
- **Cmd+↑ / Cmd+↓** (Ctrl+Shift+↑/↓ elsewhere) to jump between prompts;
- a notification when a command that took over 15 s finishes in a tab you are
  not looking at, or when a program sends one (OSC 9 / OSC 777, e.g. Claude Code
  with its notifications set to iTerm2 in `/config`).

Browser notifications need permission: ☰ → "Activar notificaciones".

Other shells work as plain terminals, without these extras.

### Command palette

**Cmd+P** (Ctrl+Shift+P elsewhere; "comandos" on the phone key bar): switch tabs
by name, run actions, and keep your frequent commands. Type a command and pick
"Guardar comando" to save it; Enter runs a saved command, Shift+Enter only
types it. Saved commands are stored per account.

### Keyboard shortcuts

| Keys | Action |
|---|---|
| Ctrl+Shift+←/→ | Previous / next tab |
| Ctrl+Shift+1…9 | Tab by position (9: the last) |
| Cmd/Ctrl+D · Cmd/Ctrl+Shift+D | Split right · split down |
| Cmd+F (macOS) · Ctrl+Shift+F | Find in scrollback (Enter / Shift+Enter: next / previous, Esc: close) |
| Cmd/Ctrl+click on a URL | Open it in a new tab |
| Cmd+C (macOS) · Ctrl+Shift+C | Copy the selection |
| Cmd/Ctrl+Shift+Z | Zen mode |
| Cmd+P · Ctrl+Shift+P | Command palette |
| Cmd+↑/↓ · Ctrl+Shift+↑/↓ | Jump to previous / next prompt |
| Drop / paste an image | Upload it and type its path. On a phone: 📎 on the key bar |

Apps inside the shell can also copy to your clipboard with OSC 52 (vim's
`"+y` with OSC 52 enabled, tmux `set -g set-clipboard on`, Claude Code).

## iOS and Mac apps (optional)

The browser is all you need. `ios/` adds a small native wrapper for when you
want more: a full-screen WKWebView on your server with no browser chrome, no
keyboard accessory bar, a native clipboard for OSC 52, Face ID lock, and
keyboard shortcuts that reach the terminal instead of the browser.

Both builds need Xcode and [XcodeGen](https://github.com/yonaskolb/XcodeGen)
(`brew install xcodegen`). The first time you run either build script it asks
for your server's URL, an optional home-network URL and a bundle identifier of
your own, and saves them in `ios/local.env`. That file is git-ignored: nothing
about your server lives in the repository. To change them later, edit it (see
[`ios/local.env.example`](ios/local.env.example)).

### iPhone / iPad

One-time: sign an Apple ID into Xcode (Settings → Accounts) and connect the
device by cable once with Developer Mode on. Then:

```bash
bash scripts/ios-build.sh
```

With a free Apple ID the app expires after 7 days; run the script again. The
app warns you before that happens.

### Mac

The same project builds for the Mac (Mac Catalyst) as **Web Terminal**: its own
window and Dock icon, a "Terminal" menu, native notifications and several
windows (⌘N). Signed to run locally, so it does not expire.

**Without building**, in Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/damillano93/web-terminal/main/scripts/install-mac-app.sh | bash
```

It downloads the app from the [latest release](../../releases/latest), puts
**Web Terminal** in Applications and opens it. The first time it asks for the
address of your web-terminal (`terminal.example.com`) and remembers it from
then on; Terminal → "Cambiar servidor…" (⇧⌘,) changes it. Run the same line
again to update.

You can also download `Web-Terminal-mac.zip` from the releases page by hand,
but the app is not signed with an Apple Developer ID, so macOS then blocks the
first launch until you allow it in System Settings → Privacy & Security →
"Open Anyway". The installer above avoids that.

To build it yourself, with your server built in:

```bash
bash scripts/mac-build.sh                                  # uses ios/local.env
SERVER=http://127.0.0.1:7681/ bash scripts/mac-build.sh   # on the server Mac itself
bash scripts/mac-deploy.sh user@other-mac.local            # copy the built app to another Mac over SSH
bash scripts/mac-release.sh                                # the zip for a release: no server inside
```

The server URL can also be changed in the app's Settings (⌘,).

### Direct connection at home

With `WT_LAN_URL` set (or Settings → "Dirección local"), the apps connect
straight to the server on your LAN, skipping the round trip through the
internet. They only do so after the LAN address proves it is your server: it
signs a random nonce with a key the app fetched over the authenticated public
URL, so on another network the same IP is never trusted. A fixed "Servidor" URL
in Settings turns the switching off.

## Development

```bash
npm run watch      # rebuild the frontend on change
npm start          # run the server
npm run themes     # re-fetch the Gogh palettes
```

| Path | What it is |
|---|---|
| `server.js` | The web server: auth, sessions, WebSocket, uploads, static files. |
| `pty-host.js` | The detached process that owns the shells. |
| `public/app.src.js` | Frontend source, bundled to `public/app.js` by esbuild. |
| `shell-integration/zsh/` | The zsh hooks (OSC 7 / OSC 133). |
| `ios/` | The iOS / Mac Catalyst wrapper app. |
| `scripts/` | Build, theme-fetch and app install helpers. |

Changes are tracked in [CHANGELOG.md](CHANGELOG.md). Issues and pull requests
are welcome.

## License

[MIT](LICENSE) © 2026 David Millán
