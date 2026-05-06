#!/usr/bin/env bash
# Build a macOS .app bundle for CLAUDE.md Optimizer.
# Output: build/CLAUDE.md Optimizer.app
# Strategy: native bundle layout with a shell launcher (no osacompile dependency).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

APP_NAME="CLAUDE.md Optimizer"
BUILD_DIR="$ROOT/build"
APP_DIR="$BUILD_DIR/$APP_NAME.app"
HTML_SOURCE="$ROOT/src/optimizer.html"

if [ ! -f "$HTML_SOURCE" ]; then
    echo "ERROR: $HTML_SOURCE missing" >&2
    exit 1
fi

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

cp "$HERE/Info.plist" "$APP_DIR/Contents/Info.plist"
cp "$HERE/launcher.sh" "$APP_DIR/Contents/MacOS/launcher"
chmod +x "$APP_DIR/Contents/MacOS/launcher"

cp "$HTML_SOURCE" "$APP_DIR/Contents/Resources/optimizer.html"

if [ -f "$HERE/icon.icns" ]; then
    cp "$HERE/icon.icns" "$APP_DIR/Contents/Resources/icon.icns"
elif [ -f "$HERE/icon.png" ] && command -v iconutil >/dev/null 2>&1 && command -v sips >/dev/null 2>&1; then
    ICONSET_DIR="$BUILD_DIR/icon.iconset"
    rm -rf "$ICONSET_DIR"
    mkdir -p "$ICONSET_DIR"
    SOURCE="$HERE/icon.png"
    for size in 16 32 64 128 256 512; do
        sips -z "$size" "$size" "$SOURCE" --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null
        sips -z $((size * 2)) $((size * 2)) "$SOURCE" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" >/dev/null
    done
    iconutil -c icns "$ICONSET_DIR" -o "$APP_DIR/Contents/Resources/icon.icns"
    rm -rf "$ICONSET_DIR"
else
    echo "WARN: no icon.icns or icon.png; bundle will use generic icon" >&2
fi

# Ad-hoc codesign so Gatekeeper does not immediately quarantine the bundle.
# Real Developer ID signing is handled in CI when MAC_DEVELOPER_ID is set.
if command -v codesign >/dev/null 2>&1; then
    codesign --force --deep --sign - "$APP_DIR" 2>/dev/null || true
fi

echo
echo "Built: $APP_DIR"
ls -lh "$APP_DIR/Contents/MacOS"
ls -lh "$APP_DIR/Contents/Resources"
