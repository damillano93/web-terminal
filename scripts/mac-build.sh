#!/usr/bin/env bash
#
# Build the Mac app (Mac Catalyst build of ios/) and install it as
# /Applications/Web Terminal.app. Signed ad-hoc ("sign to run locally"): it
# does not expire, but copied to another Mac it must be opened once with
# right-click → Open.
#
#   bash scripts/mac-build.sh
#   SERVER=http://127.0.0.1:7681/ bash scripts/mac-build.sh   # also set the server URL
set -euo pipefail
cd "$(dirname "$0")/../ios"
xcodegen generate >/dev/null
xcodebuild -project WebTerminal.xcodeproj -scheme WebTerminal -configuration Release \
  -destination 'platform=macOS,variant=Mac Catalyst' -derivedDataPath build \
  CODE_SIGN_IDENTITY="-" CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="" PROVISIONING_PROFILE_SPECIFIER="" \
  build | grep -E "error:|BUILD (SUCCEEDED|FAILED)"
pkill -f "Web Terminal.app/Contents/MacOS/WebTerminal" || true
rm -rf "/Applications/Web Terminal.app"
cp -R build/Build/Products/Release-maccatalyst/WebTerminal.app "/Applications/Web Terminal.app"
if [ -n "${SERVER:-}" ]; then defaults write com.example.webterminal server_url "$SERVER"; fi
open "/Applications/Web Terminal.app"
echo "Installed /Applications/Web Terminal.app"
