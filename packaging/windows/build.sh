#!/usr/bin/env bash
# Local Windows build helper.
# On macOS this will not produce a runnable Windows .exe (PyInstaller is host-bound).
# Use this only for syntax sanity (it builds a Mac-native binary from launcher.py).
# Real Windows builds happen on GitHub Actions (windows-latest).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

cd "$ROOT"
python3 -m pip install --upgrade pip >/dev/null
python3 -m pip install -r packaging/windows/requirements.txt
python3 -m pip install pyinstaller

if [ ! -f packaging/windows/icon.ico ]; then
  python3 packaging/windows/generate_icon.py || true
fi

python3 -m PyInstaller \
  --noconfirm \
  --clean \
  --distpath build/windows \
  --workpath build/windows-work \
  packaging/windows/optimizer.spec

echo
echo "Local artifact (host-arch, not runnable on Windows):"
ls -lh "build/windows" || true
