"""Smoke tests for src/parser_lib.parse()."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from parser_lib import parse  # noqa: E402


@pytest.fixture(scope="module")
def fixture_text() -> str:
    return (ROOT / "tests" / "fixtures" / "sample-claude.md").read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def parsed(fixture_text: str) -> dict:
    return parse(fixture_text)


def test_stats_present(parsed: dict) -> None:
    assert "stats" in parsed
    assert "sections" in parsed
    s = parsed["stats"]
    for key in ("total_chars", "section_count", "keep_count", "move_count",
                "duplicate_pairs", "conflict_count"):
        assert key in s, f"missing stat key {key}"


def test_section_count(parsed: dict) -> None:
    titles = [sec["title"] for sec in parsed["sections"]]
    assert "KIM JESTEM" in titles
    assert "ZASADY PRACY" in titles
    assert "MOJE PROJEKTY" in titles
    assert "RULE PRECEDENCE" in titles
    assert parsed["stats"]["section_count"] >= 4


def test_classification(parsed: dict) -> None:
    by_title = {sec["title"]: sec for sec in parsed["sections"]}
    assert by_title["KIM JESTEM"]["suggested_action"] == "keep"
    assert by_title["ZASADY PRACY"]["suggested_action"] == "keep"
    assert by_title["RULE PRECEDENCE"]["suggested_action"] == "keep"
    assert by_title["MOJE PROJEKTY"]["suggested_action"] == "move"


def test_duplicate_detection(parsed: dict) -> None:
    has_dup = any(sec["duplicates"] for sec in parsed["sections"])
    assert has_dup, "expected at least one duplicate (bcrypt rule appears in 2 sections)"
    assert parsed["stats"]["duplicate_pairs"] >= 1


def test_conflict_detection(parsed: dict) -> None:
    assert parsed["stats"]["conflict_count"] >= 1
    found_rules = set()
    for sec in parsed["sections"]:
        for c in sec["conflicts"]:
            found_rules.add(c["rule_id"])
    assert "stripe_vs_mollie" in found_rules or "em_dash" in found_rules


def test_filename_suggestions(parsed: dict) -> None:
    move_sections = [s for s in parsed["sections"] if s["suggested_action"] == "move"]
    for sec in move_sections:
        assert sec["suggested_filename"], f"missing filename for {sec['title']}"
        assert sec["suggested_filename"].endswith(".md")
        assert sec["suggested_filename"].startswith(("project_", "feedback_", "reference_"))


def test_total_chars_match_input(parsed: dict, fixture_text: str) -> None:
    assert parsed["stats"]["total_chars"] == len(fixture_text)


def test_empty_input() -> None:
    result = parse("")
    assert result["stats"]["section_count"] >= 1
    assert result["stats"]["total_chars"] == 0
