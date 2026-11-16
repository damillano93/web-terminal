#!/bin/bash
# macOS only. Helper to grant Full Disk Access to the node binary that runs
# web-terminal, so shells started from it can read ~/Documents, ~/Desktop, etc.
# without a permission popup each time. TCC cannot be granted programmatically:
# this only opens the right windows so you can drag-and-drop the file.
#
#   bash scripts/grant-fda.sh
#   NODE_BIN=/path/to/node bash scripts/grant-fda.sh
#   PLIST=~/Library/LaunchAgents/com.you.web-terminal.plist bash scripts/grant-fda.sh
#
# NODE_BIN defaults to ./bin/node when present, else the node on your PATH.
# PLIST defaults to the first LaunchAgent whose name contains "web-terminal".

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-7681}"

if [ -z "${NODE_BIN:-}" ]; then
  if [ -x "$ROOT/bin/node" ]; then NODE_BIN="$ROOT/bin/node"; else NODE_BIN="$(command -v node)"; fi
fi
# Full Disk Access is tied to the real file, not to a symlink to it.
[ -n "$NODE_BIN" ] && NODE_BIN="$(realpath "$NODE_BIN" 2>/dev/null || echo "$NODE_BIN")"

if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo "ERROR: node not found (${NODE_BIN:-not on PATH}). Pass NODE_BIN=/path/to/node."
  exit 1
fi

if [ -z "${PLIST:-}" ]; then
  PLIST="$(ls "$HOME"/Library/LaunchAgents/*web-terminal*.plist 2>/dev/null | head -1)"
fi

echo "Opening Finder at $NODE_BIN ..."
open -R "$NODE_BIN"

sleep 1

echo "Opening System Settings → Privacy & Security → Full Disk Access..."
open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"

cat <<'EOF'

============================================================
  NOW DO THIS:

  1. Finder just opened with 'node' highlighted.
  2. System Settings just opened at Full Disk Access.
  3. If there is an OLD entry for another 'node',
     click the (-) minus button to remove it.
  4. DRAG the 'node' file from Finder into the Full Disk
     Access list (or drop it on the [+] button).
     (Touch ID / password will be asked once.)
  5. Make sure the toggle next to 'node' is ON (blue).
  6. Come back to the terminal and press ENTER to restart
     the web-terminal service so it picks up the grant.
============================================================

Waiting for you to finish the drag-and-drop... (press ENTER when done)
EOF

read -r _

if [ -n "$PLIST" ] && [ -f "$PLIST" ]; then
  echo "Restarting web-terminal service ($PLIST)..."
  launchctl unload "$PLIST" 2>/dev/null
  sleep 1
  launchctl load "$PLIST"
  sleep 2
else
  echo "No web-terminal LaunchAgent found; restart the server yourself."
fi

echo ""
echo "--- Health check ---"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:$PORT/healthz"

echo ""
echo "Done. Open your web-terminal and run:"
echo "    cd ~/Documents && ls"
echo "If no popup appears, Full Disk Access is working."
