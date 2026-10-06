#!/usr/bin/env bash
#
# Install the current Mac app on another Mac over SSH (same network or any
# host you can reach). The other Mac needs Remote Login on and this machine's
# key in its ~/.ssh/authorized_keys.
#
#   bash scripts/mac-deploy.sh usuario@otro-mac.local
#
# Copies /Applications/Web Terminal.app from this Mac (run scripts/mac-build.sh
# first to rebuild it), replaces the remote copy and reopens it. The remote
# app keeps its own settings (server URL, lock); files copied this way carry
# no quarantine flag, so macOS opens them without the "unidentified developer"
# prompt.
set -euo pipefail
TARGET="${1:?usage: mac-deploy.sh user@host}"
APP="/Applications/Web Terminal.app"
[ -d "$APP" ] || { echo "No $APP here; run scripts/mac-build.sh first." >&2; exit 1; }
ZIP=$(mktemp -t webterminal).zip
trap 'rm -f "$ZIP"' EXIT
ditto -c -k --keepParent "$APP" "$ZIP"
scp -q "$ZIP" "$TARGET:/tmp/Web-Terminal.zip"
ssh "$TARGET" '
  set -e
  osascript -e "quit app \"Web Terminal\"" >/dev/null 2>&1 || true
  sleep 1
  rm -rf "/Applications/Web Terminal.app"
  ditto -x -k /tmp/Web-Terminal.zip /Applications
  rm -f /tmp/Web-Terminal.zip
  open "/Applications/Web Terminal.app"
'
echo "Installed on $TARGET"
