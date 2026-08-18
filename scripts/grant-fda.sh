#!/bin/bash
# Helper to grant Full Disk Access to the pinned node binary.
# TCC cannot be granted programmatically — this only opens the right
# windows so you can drag-and-drop the file.

NODE_BIN="/Users/you/Library/Application Support/web-terminal/bin/node"

if [ ! -x "$NODE_BIN" ]; then
  echo "ERROR: pinned node not found at $NODE_BIN"
  exit 1
fi

echo "Opening Finder at the pinned node binary..."
open -R "$NODE_BIN"

sleep 1

echo "Opening System Settings → Privacy & Security → Full Disk Access..."
open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"

cat <<'EOF'

============================================================
  NOW DO THIS:

  1. Finder just opened with 'node' highlighted.
  2. System Settings just opened at Full Disk Access.
  3. If there is an OLD entry for '/opt/homebrew/bin/node',
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

echo "Restarting web-terminal service..."
launchctl unload ~/Library/LaunchAgents/com.you.web-terminal.plist 2>/dev/null
sleep 1
launchctl load ~/Library/LaunchAgents/com.you.web-terminal.plist
sleep 2

echo ""
echo "--- Health check ---"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:7681/healthz

echo ""
echo "Done. Test by opening https://terminal.example.com/ and running:"
echo "    cd ~/Documents && ls"
echo "If no popup appears, FDA is working."
