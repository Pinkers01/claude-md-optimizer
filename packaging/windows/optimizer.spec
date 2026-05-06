# PyInstaller spec for the CLAUDE.md Optimizer Windows launcher.
# Build with: pyinstaller packaging/windows/optimizer.spec
# Output:    dist/CLAUDE.md Optimizer.exe
# Notes:
#   - Single-file executable (--onefile via EXE(... onefile=True...) is not used directly;
#     the spec uses the standard pattern with EXE collecting binaries+datas inline).
#   - --add-data is provided through the 'datas' tuple.
#   - The optimizer.html path is resolved relative to the spec file.
import os
import sys
from pathlib import Path

# pyinstaller invokes the spec with __file__ pointing at this file.
SPEC_DIR = Path(os.path.abspath(SPEC)).parent if 'SPEC' in dir() else Path('.').resolve()
PROJECT_ROOT = SPEC_DIR.parent.parent
HTML_SOURCE = PROJECT_ROOT / 'src' / 'optimizer.html'
ICON_PATH = SPEC_DIR / 'icon.ico'

if not HTML_SOURCE.is_file():
    raise SystemExit(f"optimizer.html not found at {HTML_SOURCE}")

datas = [(str(HTML_SOURCE), '.')]

block_cipher = None

a = Analysis(
    [str(SPEC_DIR / 'launcher.py')],
    pathex=[str(SPEC_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['numpy', 'pandas', 'matplotlib', 'PIL', 'cryptography'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe_kwargs = dict(
    name='CLAUDE.md Optimizer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

if ICON_PATH.is_file():
    exe_kwargs['icon'] = str(ICON_PATH)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    **exe_kwargs,
)
