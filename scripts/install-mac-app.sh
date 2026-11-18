#!/usr/bin/env bash
#
# Install the Mac app from the latest release, with nothing to approve:
#
#   curl -fsSL https://raw.githubusercontent.com/damillano93/web-terminal/main/scripts/install-mac-app.sh | bash
#
# The app is not signed with an Apple Developer ID, so a copy downloaded with
# a browser is blocked by Gatekeeper until you allow it in System Settings.
# Fetched this way it carries no quarantine flag and just opens. Run it again
# to update; the server you typed on the first launch is kept.
#
#   DEST=~/Applications bash install-mac-app.sh    # somewhere else than /Applications
set -euo pipefail

URL="https://github.com/damillano93/web-terminal/releases/latest/download/Web-Terminal-mac.zip"
[ "$(uname -s)" = "Darwin" ] || { echo "This installs a macOS app." >&2; exit 1; }

DEST="${DEST:-/Applications}"
[ -w "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"
APP="$DEST/Web Terminal.app"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "Downloading Web Terminal…"
curl -fL --progress-bar -o "$TMP/app.zip" "$URL"
ditto -x -k "$TMP/app.zip" "$TMP"
[ -d "$TMP/Web Terminal.app" ] || { echo "The download does not contain the app." >&2; exit 1; }
codesign --verify --deep --strict "$TMP/Web Terminal.app"

if [ -d "$APP" ]; then
  osascript -e 'quit app "Web Terminal"' >/dev/null 2>&1 || true
  sleep 1
  rm -rf "$APP"
fi
ditto "$TMP/Web Terminal.app" "$APP"
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
echo "Installed $APP"
[ -n "${NO_OPEN:-}" ] || open "$APP"
