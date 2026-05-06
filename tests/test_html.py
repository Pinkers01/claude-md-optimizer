"""Static checks on the bundled optimizer.html artifact."""
from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
HTML_PATH = ROOT / "src" / "optimizer.html"


@pytest.fixture(scope="module")
def html() -> str:
    return HTML_PATH.read_text(encoding="utf-8")


def test_html_exists() -> None:
    assert HTML_PATH.is_file(), f"optimizer.html missing at {HTML_PATH}"
    size = HTML_PATH.stat().st_size
    assert 50_000 < size < 1_000_000, f"unexpected size {size}"


def test_doctype_and_root(html: str) -> None:
    assert html.lstrip().lower().startswith("<!doctype html"), "missing DOCTYPE"
    assert "<html" in html.lower()
    assert "</html>" in html.lower()


def test_has_title(html: str) -> None:
    assert re.search(r"<title>[^<]+</title>", html, re.I), "missing <title>"


def test_has_inline_script(html: str) -> None:
    scripts = re.findall(r"<script[^>]*>", html, re.I)
    assert len(scripts) >= 1, "expected at least one <script> block"


def test_no_external_telemetry(html: str) -> None:
    forbidden = [
        "google-analytics.com",
        "googletagmanager.com",
        "hotjar.com",
        "mixpanel.com",
        "segment.com",
        "facebook.net/tr",
    ]
    lower = html.lower()
    for needle in forbidden:
        assert needle not in lower, f"external telemetry endpoint found: {needle}"


def test_branding_present(html: str) -> None:
    lower = html.lower()
    assert "pinky creative studio" in lower or "stopmetzoeken" in lower, \
        "expected Pinky branding in optimizer.html"
