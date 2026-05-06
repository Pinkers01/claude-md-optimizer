#!/usr/bin/env bash
# Build the customer download ZIP.
# Output: build/claude-md-optimizer-v1.0.0.zip
#
# Contents:
#   optimizer.html          (from src/optimizer.html)
#   CLAUDE.md Optimizer.app (from ~/Desktop/Apps Cloude/CLAUDE.md Optimizer.app)
#   CLAUDE.md Optimizer.exe (placeholder until GitHub Actions builds it)
#   README.md
#   LICENSE
#   LICENSE_KEY.txt         (template, customer pastes their key)

set -euo pipefail

VERSION="${VERSION:-1.0.0}"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$LOCAL_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/build"
STAGE_DIR="$BUILD_DIR/_stage_$$"
ZIP_NAME="claude-md-optimizer-v${VERSION}.zip"
ZIP_PATH="$BUILD_DIR/$ZIP_NAME"
APP_BUNDLE="$HOME/Desktop/Apps Cloude/CLAUDE.md Optimizer.app"

echo "==> build $ZIP_NAME"
mkdir -p "$BUILD_DIR" "$STAGE_DIR"

# 1. optimizer.html
if [[ ! -f "$PROJECT_DIR/src/optimizer.html" ]]; then
  echo "ERROR: src/optimizer.html missing" >&2
  exit 1
fi
cp "$PROJECT_DIR/src/optimizer.html" "$STAGE_DIR/optimizer.html"

# 2. macOS .app bundle
if [[ -d "$APP_BUNDLE" ]]; then
  cp -R "$APP_BUNDLE" "$STAGE_DIR/CLAUDE.md Optimizer.app"
else
  echo "WARN: macOS .app bundle not found at: $APP_BUNDLE — skipping"
fi

# 3. Windows .exe placeholder (real build comes from GitHub Actions)
WIN_EXE_SRC="$PROJECT_DIR/packaging/windows/CLAUDE.md Optimizer.exe"
if [[ -f "$WIN_EXE_SRC" ]]; then
  cp "$WIN_EXE_SRC" "$STAGE_DIR/CLAUDE.md Optimizer.exe"
else
  cat > "$STAGE_DIR/CLAUDE.md Optimizer.exe.placeholder.txt" <<'PLACEHOLDER'
The Windows .exe is built by GitHub Actions and shipped in the next release ZIP.

For now you can use:
  - optimizer.html  (open in any modern browser, works offline)
  - CLAUDE.md Optimizer.app  (macOS users)

A separate notification will go out when the .exe is ready, with a fresh download link.

Pinky Creative Studio · klantenservice@stopmetzoeken.store
PLACEHOLDER
fi

# 4. README + LICENSE
[[ -f "$PROJECT_DIR/README.md" ]] && cp "$PROJECT_DIR/README.md" "$STAGE_DIR/README.md"
[[ -f "$PROJECT_DIR/LICENSE" ]] && cp "$PROJECT_DIR/LICENSE" "$STAGE_DIR/LICENSE"

# 5. License key template
cat > "$STAGE_DIR/LICENSE_KEY.txt" <<'TPL'
CLAUDE.md Optimizer · Lifetime license
Pinky Creative Studio

Your license key is in the email we sent you. It looks like:

    OPT-XXXX-XXXX-XXXX-XXXX

Paste it below this line to keep a local copy:

    LICENSE: __________________________________

Order reference: see your email.

The optimizer itself does not require a key to run; the key is your proof
of purchase if you want updates, support, or to redownload from
https://stopmetzoeken.store/apps/optimizer.

All processing happens in your browser. Nothing leaves your machine.

Support: klantenservice@stopmetzoeken.store
WhatsApp: +31 6 38 90 94 16
TPL

# 6. Build version file
cat > "$STAGE_DIR/VERSION" <<EOF
claude-md-optimizer
version: $VERSION
built:   $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

# Zip it.
( cd "$STAGE_DIR" && zip -r -q "$ZIP_PATH" . )

# Hash + cleanup.
SHA="$(shasum -a 256 "$ZIP_PATH" | awk '{print $1}')"
SIZE="$(wc -c < "$ZIP_PATH" | tr -d ' ')"
rm -rf "$STAGE_DIR"

echo "==> done"
echo "  path:   $ZIP_PATH"
echo "  size:   $SIZE bytes"
echo "  sha256: $SHA"
echo "$SHA  $ZIP_NAME" > "$ZIP_PATH.sha256"
