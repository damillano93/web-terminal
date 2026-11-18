#!/usr/bin/env bash
#
# Build the Mac app for a GitHub release: no server and no personal bundle id
# inside. The app asks for the server on its first launch and keeps it.
#
#   bash scripts/mac-release.sh            # → ios/build/release/Web-Terminal-<version>-mac.zip
#
# It does not read ios/local.env and does not touch /Applications. Signed
# ad-hoc (no Developer ID), so a downloaded copy has to be let through
# Gatekeeper once; see the README.
set -euo pipefail
cd "$(dirname "$0")/../ios"

VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' ../package.json | head -1)
BUNDLE_ID="${RELEASE_BUNDLE_ID:-io.github.webterminal.app}"
DERIVED=build/release-derived
OUT=build/release
ZIP="$OUT/Web-Terminal-$VERSION-mac.zip"

xcodegen generate >/dev/null
xcodebuild -project WebTerminal.xcodeproj -scheme WebTerminal -configuration Release \
  -destination 'generic/platform=macOS,variant=Mac Catalyst' -derivedDataPath "$DERIVED" \
  CODE_SIGN_IDENTITY="-" CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="" PROVISIONING_PROFILE_SPECIFIER="" \
  WT_SERVER_URL="" WT_LAN_URL="" PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID" \
  MARKETING_VERSION="$VERSION" build | grep -E "error:|BUILD (SUCCEEDED|FAILED)"

rm -rf "$OUT"; mkdir -p "$OUT"
cp -R "$DERIVED/Build/Products/Release-maccatalyst/WebTerminal.app" "$OUT/Web Terminal.app"
# The linker leaves the build directory (under your home) in the symbol
# table: strip it, sign again, and refuse to package anything of yours.
strip -S -x "$OUT/Web Terminal.app/Contents/MacOS/WebTerminal" 2>/dev/null
codesign --force --sign - --preserve-metadata=entitlements "$OUT/Web Terminal.app"
codesign --verify --deep --strict "$OUT/Web Terminal.app"
if grep -rqaF -e "$HOME" -e "$(id -un)" "$OUT/Web Terminal.app"; then
  echo "error: the build still contains your home path or user name" >&2; exit 1
fi
ditto -c -k --keepParent "$OUT/Web Terminal.app" "$ZIP"
echo "$ZIP"
shasum -a 256 "$ZIP"
