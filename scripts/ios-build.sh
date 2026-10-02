#!/usr/bin/env bash
#
# Build the iOS wrapper (ios/) and install it on a connected iPhone/iPad.
#
#   bash scripts/ios-build.sh            # first paired device
#   DEVICE=<udid> bash scripts/ios-build.sh
#   TEAM=<team id> bash scripts/ios-build.sh
#
# One-time setup, on the Mac itself:
#   1. Xcode → Settings → Accounts → "+" → Apple ID (a free one works; the app
#      then expires after 7 days and needs this script run again).
#   2. Plug the device in by cable once, tap "Trust", and turn on
#      Settings → Privacy & Security → Developer Mode on the device.
#   After that the device can stay on Wi-Fi.
set -euo pipefail
cd "$(dirname "$0")/../ios"

if [ -z "${TEAM:-}" ]; then
  # Xcode keeps the teams of the signed-in accounts in its preferences.
  TEAM=$(defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier 2>/dev/null \
    | grep -oE 'teamID = [A-Z0-9]{10}' | head -1 | awk '{print $3}' || true)
fi
if [ -z "${TEAM:-}" ]; then
  # Otherwise from the "Apple Development" certificate Xcode created: its
  # subject's OU is the team id.
  TEAM=$(security find-certificate -a -c "Apple Development" -p 2>/dev/null \
    | openssl x509 -noout -subject 2>/dev/null \
    | grep -oE 'OU ?= ?[A-Z0-9]{10}' | head -1 | grep -oE '[A-Z0-9]{10}$' || true)
fi
if [ -z "${TEAM:-}" ]; then
  echo "No Apple ID found in Xcode. Add one in Xcode → Settings → Accounts, then" >&2
  echo "select it → Manage Certificates… → + → Apple Development. Or pass TEAM=<id>." >&2
  exit 1
fi

if [ -z "${DEVICE:-}" ]; then
  # The UDID is the id followed by "(UDID)"; device names can contain spaces.
  DEVICE=$(xcrun devicectl list devices 2>/dev/null \
    | grep -E 'available|connected' | grep -E 'iPhone|iPad' \
    | grep -oE '[0-9A-F]{8}-[0-9A-F]{16} \(UDID\)' | head -1 | cut -d' ' -f1)
fi
if [ -z "${DEVICE:-}" ]; then
  echo "No paired iPhone/iPad found (xcrun devicectl list devices). Connect it once by cable." >&2
  exit 1
fi

echo "Team $TEAM · device $DEVICE"
xcodegen generate >/dev/null
xcodebuild -project WebTerminal.xcodeproj -scheme WebTerminal -configuration Release \
  -destination "id=$DEVICE" -derivedDataPath build \
  -allowProvisioningUpdates DEVELOPMENT_TEAM="$TEAM" build | grep -E "error:|BUILD (SUCCEEDED|FAILED)"

APP=build/Build/Products/Release-iphoneos/WebTerminal.app
xcrun devicectl device install app --device "$DEVICE" "$APP"
xcrun devicectl device process launch --device "$DEVICE" com.example.webterminal || true
