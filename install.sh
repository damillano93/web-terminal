#!/usr/bin/env bash
#
# web-terminal — guided installer.
#
# Walks you through: local vs Docker, the auth method, and the environment it
# needs; writes a chmod-600 .env and then builds/runs (local) or brings up the
# container (Docker). Safe to re-run — it backs up an existing .env first.
#
#   bash install.sh
#
set -euo pipefail

# ── cosmetics ────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  B=$'\033[1m'; DIM=$'\033[2m'; R=$'\033[0m'
  GRN=$'\033[32m'; YEL=$'\033[33m'; RED=$'\033[31m'; CYN=$'\033[36m'
else
  B=""; DIM=""; R=""; GRN=""; YEL=""; RED=""; CYN=""
fi
say()  { printf '%s\n' "$*"; }
head() { printf '\n%s%s%s\n' "$B$CYN" "$*" "$R"; }
ok()   { printf '%s✓%s %s\n' "$GRN" "$R" "$*"; }
warn() { printf '%s!%s %s\n' "$YEL" "$R" "$*"; }
die()  { printf '%s✗ %s%s\n' "$RED" "$*" "$R" >&2; exit 1; }

# ── prompt helpers ───────────────────────────────────────────────────────────
# ask <var> <prompt> [default]
ask() {
  local __var="$1" __prompt="$2" __def="${3:-}" __in
  if [ -n "$__def" ]; then
    read -r -p "$__prompt ${DIM}[$__def]${R}: " __in || true
    __in="${__in:-$__def}"
  else
    read -r -p "$__prompt: " __in || true
  fi
  printf -v "$__var" '%s' "$__in"
}
# ask_secret <var> <prompt>  (no echo, confirmed)
ask_secret() {
  local __var="$1" __prompt="$2" a b
  while :; do
    read -r -s -p "$__prompt: " a; echo
    read -r -s -p "Confirm: " b; echo
    [ -n "$a" ] || { warn "Cannot be empty."; continue; }
    [ "$a" = "$b" ] || { warn "Did not match, try again."; continue; }
    break
  done
  printf -v "$__var" '%s' "$a"
}
# choose <var> <prompt> <opt1> <opt2> ...   → sets var to the 1-based index
choose() {
  local __var="$1" __prompt="$2"; shift 2
  local opts=("$@") i sel
  say ""
  for i in "${!opts[@]}"; do printf '  %s%d%s) %s\n' "$B" $((i+1)) "$R" "${opts[$i]}"; done
  while :; do
    read -r -p "$__prompt [1-${#opts[@]}]: " sel || true
    [[ "$sel" =~ ^[0-9]+$ ]] && [ "$sel" -ge 1 ] && [ "$sel" -le "${#opts[@]}" ] && break
    warn "Enter a number 1-${#opts[@]}."
  done
  printf -v "$__var" '%s' "$sel"
}
yesno() {  # yesno "prompt" [default y|n] → returns 0 for yes
  local p="$1" d="${2:-y}" a
  read -r -p "$p ${DIM}[$([ "$d" = y ] && echo Y/n || echo y/N)]${R}: " a || true
  a="${a:-$d}"; [[ "$a" =~ ^[Yy] ]]
}

rand_secret() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 32
  elif command -v node >/dev/null 2>&1; then node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
  else head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

cd "$(dirname "$0")"
ENV_FILE=".env"

# ── banner ───────────────────────────────────────────────────────────────────
head "web-terminal installer"
say "${DIM}A browser terminal that opens a real shell on this machine.${R}"
warn "This grants shell access to whoever logs in. Never expose it to the"
warn "internet without auth + HTTPS. Treat it like SSH."

OS="$(uname -s)"
case "$OS" in Darwin) PLATFORM=macOS;; Linux) PLATFORM=Linux;; *) PLATFORM="$OS";; esac
say ""; ok "Platform: $PLATFORM"

if [ -f "$ENV_FILE" ]; then
  warn "A .env already exists."
  yesno "Overwrite it?" n || die "Aborted — nothing changed."
  cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d-%H%M%S)"
  ok "Backed up existing .env"
fi

# ── 1. deploy mode ───────────────────────────────────────────────────────────
head "1. How do you want to run it?"
choose DEPLOY "Choose" \
  "Local  — Node on this machine (dev, or behind your own proxy)" \
  "Docker — build and run a container"

# ── 2. auth method ───────────────────────────────────────────────────────────
head "2. How should people log in?"
choose AUTH "Choose" \
  "Password — one shared password (simplest; good behind a VPN/LAN)" \
  "Google OAuth — sign in with Google, restricted to a domain/emails" \
  "Local-network bypass — no login from private IPs (LAN/Tailscale only)"

# accumulate env lines
declare -a ENV_LINES
add() { ENV_LINES+=("$1=$2"); }

# ── 3. common network ────────────────────────────────────────────────────────
head "3. Network"
ask PORT "Port" "7681"
if [ "$DEPLOY" = 2 ]; then
  BIND="0.0.0.0"; ok "Bind: 0.0.0.0 (Docker)"
else
  choose BINDSEL "Bind address" \
    "127.0.0.1 — localhost only (recommended; put a proxy in front)" \
    "0.0.0.0 — all interfaces (LAN/Tailscale direct access)"
  [ "$BINDSEL" = 1 ] && BIND="127.0.0.1" || BIND="0.0.0.0"
fi
add PORT "$PORT"; add BIND "$BIND"

PUBLIC_ORIGIN=""
if yesno "Will this be served on a public hostname (behind a proxy)?" n; then
  ask PUBLIC_ORIGIN "Public origin (e.g. https://terminal.example.com)"
  [ -n "$PUBLIC_ORIGIN" ] && add WEB_TERMINAL_ORIGIN "$PUBLIC_ORIGIN"
fi

# cookie-signing secret (always)
SECRET="$(rand_secret)"
add WEB_TERMINAL_SECRET "$SECRET"
ok "Generated WEB_TERMINAL_SECRET"

# ── 4. auth-specific env ─────────────────────────────────────────────────────
head "4. Auth details"
case "$AUTH" in
  1)  # password
    ask_secret PW "Set the access password"
    add WEB_TERMINAL_PASSWORD "$PW"
    ask WTUSER "Session owner name" "user"
    add WEB_TERMINAL_USER "$WTUSER"
    ;;
  2)  # oauth
    say "Create an OAuth client at https://console.cloud.google.com/apis/credentials"
    say "${DIM}(Web application). Redirect URI must be <origin>/auth/google/callback${R}"
    ask GID "Google Client ID"
    ask_secret GSEC "Google Client Secret"
    if [ -n "$PUBLIC_ORIGIN" ]; then
      REDIRECT="${PUBLIC_ORIGIN%/}/auth/google/callback"
      ask REDIRECT "Redirect URI" "$REDIRECT"
    else
      ask REDIRECT "Redirect URI (e.g. https://host/auth/google/callback)"
    fi
    add WEB_TERMINAL_GOOGLE_CLIENT_ID "$GID"
    add WEB_TERMINAL_GOOGLE_CLIENT_SECRET "$GSEC"
    add WEB_TERMINAL_GOOGLE_REDIRECT "$REDIRECT"
    choose RESTRICT "Restrict logins by" \
      "Domain — a whole Google Workspace domain" \
      "Emails — an explicit allowlist" \
      "None — any verified Google account (NOT for public instances)"
    case "$RESTRICT" in
      1) ask DOMAIN "Allowed domain (e.g. example.com)"; add WEB_TERMINAL_ALLOWED_DOMAIN "$DOMAIN" ;;
      2) ask EMAILS "Allowed emails (comma-separated)"; add WEB_TERMINAL_ALLOWED_EMAILS "$EMAILS" ;;
      3) warn "Any Google account will be able to log in." ;;
    esac
    ;;
  3)  # bypass
    add WEB_TERMINAL_LOCAL_BYPASS "1"
    ask WTUSER "Session owner name" "user"
    add WEB_TERMINAL_USER "$WTUSER"
    warn "Bypass trusts ALL private/Tailscale IPs, not just your devices."
    warn "On a shared Tailnet, restrict reachability with Tailscale ACLs."
    ;;
esac

# optional shell override (local only; Docker has bash)
if [ "$DEPLOY" = 1 ]; then
  DEF_SHELL="${SHELL:-/bin/bash}"
  ask WTSHELL "Shell to open" "$DEF_SHELL"
  [ -n "$WTSHELL" ] && add WEB_TERMINAL_SHELL "$WTSHELL"
fi

# ── 5. write .env ────────────────────────────────────────────────────────────
head "5. Writing configuration"
{
  echo "# Generated by install.sh on $(date)"
  echo "# Keep this file secret. It contains credentials."
  for line in "${ENV_LINES[@]}"; do echo "$line"; done
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"
ok "Wrote $ENV_FILE (chmod 600)"

# ── 6. build / run ───────────────────────────────────────────────────────────
URL_HOST="localhost"; [ "$BIND" = "0.0.0.0" ] && URL_HOST="$(hostname)"

if [ "$DEPLOY" = 2 ]; then
  # Docker
  head "6. Docker"
  command -v docker >/dev/null 2>&1 || die "docker not found. Install Docker first."
  docker info >/dev/null 2>&1 || die "Docker daemon not running. Start Docker and re-run."
  if yesno "Build and start the container now?" y; then
    docker compose --env-file "$ENV_FILE" up -d --build
    ok "Container is up."
    say ""; ok "Open: http://${URL_HOST}:${PORT}"
  else
    say "Later, run: ${B}docker compose --env-file .env up -d --build${R}"
  fi
else
  # Local
  head "6. Local build"
  command -v node >/dev/null 2>&1 || die "node not found. Install Node >= 20."
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$NODE_MAJOR" -ge 20 ] || die "Node >= 20 required (found $(node -v))."
  ok "Node $(node -v)"
  say "Installing dependencies…"; npm install --silent
  say "Building the frontend…"; npm run build >/dev/null 2>&1 && ok "Built."

  say ""
  say "To run it, load the env and start:"
  say "  ${B}set -a; . ./.env; set +a; npm start${R}"
  say ""
  if yesno "Start it now (foreground)?" y; then
    say ""; ok "Open: http://${URL_HOST}:${PORT}   (Ctrl-C to stop)"
    say ""
    set -a; . "./$ENV_FILE"; set +a
    exec npm start
  else
    case "$PLATFORM" in
      Linux) say "To run as a service, see the systemd unit in ${B}README.md${R}." ;;
      macOS) say "To run at login, see the launchd notes in ${B}README.md${R}." ;;
    esac
  fi
fi

say ""; ok "Done."
