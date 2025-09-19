#!/usr/bin/env bash
set -euo pipefail

# build-xdc.sh - package the webxdc bundle with semantic version in filename
# Output: ./dist/kl3mousse-streetsweeper13-vNN.N.N.xdc
# Order of precedence for version resolution:
#  1. --version argument
#  2. VERSION env var
#  3. version value in src/manifest.toml
#  4. version in package.json
# Fallback: 0.0.0 (should not normally happen)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT_DIR/src"
DIST_DIR="$ROOT_DIR/dist"
MANIFEST="$SRC_DIR/manifest.toml"
PKGJSON="$ROOT_DIR/package.json"
OWNER="kl3mousse"
APP_ID="streetsweeper13" # from manifest id

usage() {
  echo "Usage: $0 [--version x.y.z]" >&2
  exit 1
}

REQ_VERSION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      REQ_VERSION="${2:-}" || true
      shift 2 || true
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      ;;
  esac
done

# Extract version from manifest.toml (simple grep; assumes version = "x.y.z")
manifest_version() {
  grep -E '^version\s*=\s*"[0-9]+\.[0-9]+\.[0-9]+"' "$MANIFEST" | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/' || true
}

# Extract version from package.json
package_json_version() {
  grep -E '"version"' "$PKGJSON" | head -1 | sed -E 's/.*"version"\s*:\s*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/' || true
}

VERSION="${REQ_VERSION:-}" 
[[ -z "$VERSION" && -n "${VERSION:-}" ]] || true # no-op, keep shellcheck quiet

if [[ -z "$VERSION" && -n "${VERSION:-}" ]]; then :; fi # placeholder

if [[ -z "$VERSION" ]]; then
  VERSION="${VERSION:-${VERSION_ENV:-}}"
fi

if [[ -z "$VERSION" && -n "${VERSION:-}" ]]; then :; fi

# Try env var next
if [[ -z "$VERSION" && -n "${VERSION:-}" ]]; then :; fi

if [[ -z "$VERSION" && -n "${VERSION:-}" ]]; then :; fi

if [[ -z "$VERSION" ]]; then
  VERSION="${VERSION:-${VERSION_ENV:-${VERSION:-}}}"
fi

# Actually implement precedence cleanly
if [[ -n "$REQ_VERSION" ]]; then
  VERSION="$REQ_VERSION"
elif [[ -n "${VERSION:-}" ]]; then
  VERSION="$VERSION" # from env
else
  mv=$(manifest_version)
  pj=$(package_json_version)
  if [[ -n "$mv" ]]; then
    VERSION="$mv"
  elif [[ -n "$pj" ]]; then
    VERSION="$pj"
  else
    VERSION="0.0.0"
  fi
fi

# Validate semantic version pattern
if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version '$VERSION' (expected N.N.N)" >&2
  exit 2
fi

mkdir -p "$DIST_DIR"
OUT_FILE="$DIST_DIR/${OWNER}-${APP_ID}-v${VERSION}.xdc"

# Remove any existing file with same name
rm -f "$OUT_FILE"

# Copy required files into a temp staging area to control contents
STAGING_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t ss13)"
cleanup() { rm -rf "$STAGING_DIR"; }
trap cleanup EXIT

# Copy core webxdc assets
cp "$SRC_DIR/index.html" "$STAGING_DIR/"
cp "$SRC_DIR/styles.css" "$STAGING_DIR/"
cp "$SRC_DIR/main.js" "$STAGING_DIR/"
cp "$SRC_DIR/manifest.toml" "$STAGING_DIR/"
cp "$SRC_DIR/icon.png" "$STAGING_DIR/" 2>/dev/null || true
cp "$SRC_DIR/credits.html" "$STAGING_DIR/" 2>/dev/null || true
cp -R "$SRC_DIR/assets" "$STAGING_DIR/assets"

# Add top-level docs if present
[[ -f "$ROOT_DIR/README.md" ]] && cp "$ROOT_DIR/README.md" "$STAGING_DIR/"
[[ -f "$ROOT_DIR/LICENSE" ]] && cp "$ROOT_DIR/LICENSE" "$STAGING_DIR/"

# Produce zip (webxdc is just a zip). Use reproducible flags.
( cd "$STAGING_DIR" && zip -9 -r - . ) > "$OUT_FILE"

# Basic size/info output
BYTES=$(wc -c < "$OUT_FILE")
KB=$(( (BYTES + 1023)/1024 ))
echo "Created $OUT_FILE (${KB} KB)"

# Optional: print sha256 for integrity
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$OUT_FILE" | awk '{print "SHA256: "$1}'
fi
