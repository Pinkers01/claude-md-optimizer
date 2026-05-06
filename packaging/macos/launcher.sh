#!/bin/bash
# Native launcher script bundled inside the .app as the CFBundleExecutable.
# Resolves the bundled optimizer.html and opens it with the default browser.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES="$DIR/../Resources"
HTML="$RESOURCES/optimizer.html"

if [ ! -f "$HTML" ]; then
    osascript -e 'display alert "CLAUDE.md Optimizer" message "optimizer.html not found in app bundle. Please reinstall from the GitHub Releases page.\n\nSupport: klantenservice@stopmetzoeken.store" as critical'
    exit 1
fi

open "$HTML"
