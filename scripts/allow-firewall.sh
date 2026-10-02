#!/usr/bin/env bash
#
# Authorize the Homebrew Node binary in the macOS application firewall so the
# web-terminal server can accept LAN / Tailscale connections (not just loopback).
#
# Needed because macOS silently blocks Homebrew's ad-hoc-signed binaries from
# receiving incoming connections unless they are explicitly allowed. When the
# service moved from the vendored node to /opt/homebrew/bin/node, the old
# authorization no longer applied.
#
#   sudo bash scripts/allow-firewall.sh
#
set -euo pipefail

FW=/usr/libexec/ApplicationFirewall/socketfilterfw
NODE="$(command -v node || echo /opt/homebrew/bin/node)"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo:  sudo bash scripts/allow-firewall.sh" >&2
  exit 1
fi

# The firewall keys on the binary's code signature, not its path. Every
# `brew upgrade node` installs a new ad-hoc-signed binary under Cellar, so the
# old grant silently stops matching even though the symlink path is still
# listed. Authorize the resolved path as well as the symlink.
REAL="$(readlink -f "$NODE" 2>/dev/null || echo "$NODE")"
for bin in "$NODE" "$REAL"; do
  echo "Authorizing: $bin"
  "$FW" --remove "$bin" >/dev/null 2>&1 || true
  "$FW" --add "$bin"
  "$FW" --unblockapp "$bin"
done

echo
echo "Firewall state:"
"$FW" --getglobalstate
echo "Done. Reconnect from the LAN / Tailscale — it should respond now."
