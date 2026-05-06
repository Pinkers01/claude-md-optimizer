"""CLAUDE.md Optimizer Windows launcher.

Resolves the bundled optimizer.html (PyInstaller --add-data drop) and
opens it in the user's default browser. On any failure shows a tkinter
messagebox with manual fallback instructions.
"""
import os
import sys
import webbrowser
from pathlib import Path


SUPPORT_EMAIL = "klantenservice@stopmetzoeken.store"
APP_NAME = "CLAUDE.md Optimizer"


def resource_path(relative: str) -> Path:
    """Return absolute path to a resource bundled by PyInstaller.

    When frozen, PyInstaller extracts --add-data files into sys._MEIPASS.
    When running from source, fall back to the script directory.
    """
    base = getattr(sys, "_MEIPASS", None)
    if base:
        return Path(base) / relative
    return Path(__file__).resolve().parent / relative


def find_optimizer_html() -> Path:
    """Locate optimizer.html in any of the supported locations."""
    candidates = [
        resource_path("optimizer.html"),
        Path(sys.executable).resolve().parent / "optimizer.html",
        Path(__file__).resolve().parent / "optimizer.html",
        Path(__file__).resolve().parent.parent.parent / "src" / "optimizer.html",
    ]
    for path in candidates:
        if path.is_file():
            return path
    raise FileNotFoundError(
        "optimizer.html not found near the executable. Tried: "
        + ", ".join(str(c) for c in candidates)
    )


def show_error(message: str) -> None:
    """Display a native error dialog. Falls back to stderr if tkinter is missing."""
    try:
        import tkinter as tk
        from tkinter import messagebox

        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(APP_NAME, message)
        root.destroy()
    except Exception:
        sys.stderr.write(message + "\n")


def open_in_browser(html_path: Path) -> None:
    """Open the given HTML file with the system default browser."""
    uri = html_path.absolute().as_uri()
    opened = webbrowser.open(uri, new=2)
    if not opened:
        raise RuntimeError(f"webbrowser.open returned False for {uri}")


def main() -> int:
    try:
        html = find_optimizer_html()
        open_in_browser(html)
        return 0
    except Exception as exc:
        show_error(
            f"{APP_NAME} could not start.\n\n"
            f"Reason: {exc}\n\n"
            f"Manual fallback: open optimizer.html in your browser. "
            f"If you do not have it, redownload from the GitHub Releases page.\n\n"
            f"Support: {SUPPORT_EMAIL}"
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
