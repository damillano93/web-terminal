# Sourced by scripts/ios-build.sh and scripts/mac-build.sh (cwd: ios/).
#
# Loads your app settings from ios/local.env (git-ignored). The first time, it
# asks for them and writes that file. Nothing about your server is kept in the
# repository. Sets WT_SERVER_URL, WT_LAN_URL, WT_BUNDLE_ID and the SETTINGS
# array to pass to xcodebuild.

if [ -f local.env ]; then set -a; . ./local.env; set +a; fi

if [ -z "${WT_SERVER_URL:-}" ] || [ -z "${WT_BUNDLE_ID:-}" ]; then
  if [ ! -t 0 ]; then
    echo "The app is not configured. Copy ios/local.env.example to ios/local.env and" >&2
    echo "set WT_SERVER_URL and WT_BUNDLE_ID, or run this script in a terminal." >&2
    exit 1
  fi
  echo "First build: where is your web-terminal? (saved to ios/local.env, git-ignored)"
  while [ -z "${WT_SERVER_URL:-}" ]; do
    read -r -p "Public URL of your server (e.g. https://terminal.example.com/): " WT_SERVER_URL
    case "$WT_SERVER_URL" in
      http://*|https://*) ;;
      *) echo "It must start with https:// or http://"; WT_SERVER_URL="" ;;
    esac
  done
  if [ -z "${WT_LAN_URL:-}" ]; then
    read -r -p "Same server on your home network, optional (e.g. http://192.168.1.10:7681/): " WT_LAN_URL
  fi
  if [ -z "${WT_BUNDLE_ID:-}" ]; then
    DEFAULT_ID="com.$(id -un | tr -cd 'A-Za-z0-9').webterminal"
    read -r -p "Bundle identifier, unique to you [$DEFAULT_ID]: " WT_BUNDLE_ID
    WT_BUNDLE_ID="${WT_BUNDLE_ID:-$DEFAULT_ID}"
  fi
  {
    echo "WT_SERVER_URL=$WT_SERVER_URL"
    echo "WT_LAN_URL=${WT_LAN_URL:-}"
    echo "WT_BUNDLE_ID=$WT_BUNDLE_ID"
  } > local.env
  echo "Saved ios/local.env"
fi

SETTINGS=("WT_SERVER_URL=$WT_SERVER_URL" "WT_LAN_URL=${WT_LAN_URL:-}" "PRODUCT_BUNDLE_IDENTIFIER=$WT_BUNDLE_ID")
