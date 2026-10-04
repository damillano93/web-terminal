#!/usr/bin/env bash
#
# Restart pty-host, the process that owns the shells. THIS ENDS EVERY OPEN
# SHELL. Only needed when pty-host.js itself changed; restarting the web
# server (launchctl kickstart, systemctl restart) leaves shells alone.
#
# The server notices the host went away, starts a new one and reconnects.
set -euo pipefail
SOCK="${WEB_TERMINAL_PTY_SOCKET:-$HOME/.web-terminal/pty-host.sock}"
# -a: include ancestors. Run from a web-terminal shell, pty-host IS an ancestor,
# and macOS pgrep leaves ancestors out by default.
PIDS=$(pgrep -a -f "web-terminal/pty-host.js" || true)
if [ -z "$PIDS" ]; then echo "pty-host is not running."; exit 0; fi
read -r -p "This closes every open shell. Continue? [y/N] " ok
[ "$ok" = "y" ] || [ "$ok" = "Y" ] || exit 1
kill $PIDS
echo "pty-host stopped (pid $PIDS). The server will start a new one on its next connection attempt."
rm -f "$SOCK"
