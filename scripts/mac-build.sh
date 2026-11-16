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

# Your own server URLs live in ios/local.env (git-ignored); see ios/local.env.example.
if [ -f local.env ]; then set -a; . ./local.env; set +a; fi
URLS=()
[ -n "${WT_SERVER_URL:-}" ] && URLS+=("WT_SERVER_URL=$WT_SERVER_URL")
[ -n "${WT_LAN_URL:-}" ] && URLS+=("WT_LAN_URL=$WT_LAN_URL")
xcodegen generate >/dev/null
xcodebuild -project WebTerminal.xcodeproj -scheme WebTerminal -configuration Release \
  -destination 'platform=macOS,variant=Mac Catalyst' -derivedDataPath build \
  CODE_SIGN_IDENTITY="-" CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="" PROVISIONING_PROFILE_SPECIFIER="" \
  ${URLS[@]+"${URLS[@]}"} build | grep -E "error:|BUILD (SUCCEEDED|FAILED)"
pkill -f "Web Terminal.app/Contents/MacOS/WebTerminal" || true
rm -rf "/Applications/Web Terminal.app"
cp -R build/Build/Products/Release-maccatalyst/WebTerminal.app "/Applications/Web Terminal.app"
if [ -n "${SERVER:-}" ]; then defaults write com.example.webterminal server_url "$SERVER"; fi
open "/Applications/Web Terminal.app"
echo "Installed /Applications/Web Terminal.app"
