"""Importable parser library for CLAUDE.md.

The original parser.py is a script that reads /Users/pinky/CLAUDE.md and
writes a JSON file. This module exposes the same logic as a pure function
so tests and CI can run without touching the real file system.
"""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Any


KEEP_KW = [
    "kim jestem", "autoryzacja sesji", "formy zwracania", "happy app",
    "kontakt pinky", "design system", "code style", "tech stack",
    "folder standard", "__preamble__", "easter egg w kodzie",
    "zasady pracy", "master directive", "misja", "rule precedence",
]
MOVE_KW = [
    "moje projekty", "reguly produktow saas", "reguły produktów",
    "ai tools stack", "new project bootstrap", "codzienne rutyny",
    "tygodniowy raport", "discord strategy", "seo priority",
    "security roadmap", "profit scoring", "apple reminders",
    "kafelki", "cards", "ruflo", "lokalni agenci", "coworking",
    "ghost mode", "session management", "master mode",
    "telegram heartbeat", "autonomous learning", "hosting architecture",
    "standardy każdej", "standardy kazdej", "instalacja",
    "pixelforgood", "stopmetzoeken", "mural spirit", "octagon",
    "og electric", "3-task cycle", "auto-clear", "mode switching",
    "rejestracja nowych", "panel admin", "mobile responsive",
    "jezyki", "języki", "seo", "auto-load", "discord",
    "mobile-safe", "master cross-tenant", "per-project admin",
    "master admin", "wymagania techniczne", "anti-patterns",
    "model routing",
]

KEY_PHRASES_RE = [
    (r"\bem-?dash\b|myślnik(?:a)?\s+em", "reguła em-dash"),
    (r"\bbcrypt\b.*\b12\b", "bcrypt rounds 12"),
    (r"\bmollie\b.*\bnie\s+stripe\b|\bnigdy\s+stripe\b", "Mollie nie Stripe"),
    (r"\bpinkerson007", "kod autoryzacji"),
    (r"apps\s+cloude", "folder Apps Cloude"),
    (r"master\s+admin", "master admin"),
    (r"fleet\s+beacon", "fleet beacon"),
    (r"easter\s+egg", "easter eggs"),
    (r"pinky-mobile-safe|mobile-safe", "mobile-safe boilerplate"),
    (r"whatsapp\s+fab", "WhatsApp FAB"),
    (r"pinky\s+creative\s+studio", "brand stopki"),
    (r"\bAVG\b|\bGDPR\b", "AVG/GDPR"),
    (r"apple\s+reminders", "Apple Reminders"),
    (r"master\s+vault", "Master Vault"),
    (r"telegram\s+heartbeat|@pinky_openclaw_bot", "Telegram bot"),
    (r"\bbypass|--dangerously", "bypass permissions"),
    (r"NL.*PL.*EN|PL.*NL.*EN|3\s+języki", "3 języki"),
    (r"open\s+design|playwright\s+mcp|opencla[uw]", "AI tools stack"),
    (r"gp-maschinen", "gp-maschinen reference"),
    (r"octagon", "Octagon Sport"),
    (r"pixelforgood", "PixelForGood"),
    (r"invoiceflow", "InvoiceFlow"),
    (r"stopmetzoeken", "StopMetZoeken"),
]

CONFLICT_RULES = [
    {
        "id": "stripe_vs_mollie",
        "label": "Stripe vs Mollie (NL)",
        "patterns_a": [r"\bnigdy\s+stripe\b", r"mollie\s+nie\s+stripe", r"\bMollie\s+\(primary"],
        "patterns_b": [r"invoiceflow.*stripe", r"stripe\s+€\d+", r"using\s+stripe"],
    },
    {
        "id": "em_dash",
        "label": "NIGDY em-dash vs zawiera em-dash",
        "patterns_a": [r"nigdy\s+myślnika?\s+em", r"zero\s+em-?dash", r"NIGDY.*\(—\)"],
        "patterns_b": [],
        "check_em_dash_present": True,
    },
    {
        "id": "always_ask",
        "label": "Nigdy nie pytaj vs lista akcji wymagajacych pytania",
        "patterns_a": [r"nigdy\s+nie\s+pytaj", r"staly\s+yes", r"stałe\s+yes", r"bez\s+pytania"],
        "patterns_b": [r"wymagają\s+zapytania", r"pytam.*tylko\s+gdy", r"pytaj.*pinky"],
    },
    {
        "id": "lite_version",
        "label": "Nigdy lite vs MVP/preview",
        "patterns_a": [r"nigdy.*lite", r"zero\s+skrótów", r"na\s+maksa"],
        "patterns_b": [r"\bMVP\b", r"lite\s+version", r"preview\s+version"],
    },
    {
        "id": "autonomy_vs_options",
        "label": "Decyzje same vs 3-4 opcje przed decyzja",
        "patterns_a": [r"decyduj.*samodzieln", r"autonomi.*działać", r"decyzje\s+same"],
        "patterns_b": [r"3-4\s+opcj", r"czeka.*wybór", r"czekaj\s+na\s+mój\s+wybór"],
    },
    {
        "id": "no_paid_apis",
        "label": "Zero placonych API vs InvoiceFlow Stripe / OpenRouter",
        "patterns_a": [r"zero\s+dodatkowych\s+płatnych", r"nie\s+proponuj.*api"],
        "patterns_b": [r"openrouter.*key", r"glm-5\.1.*openrouter", r"higgsfield"],
    },
    {
        "id": "desktop_folder",
        "label": "Apps Cloude folder vs sandbox/desktop",
        "patterns_a": [r"desktop/apps\s+cloude", r"pulpit\s+ma\s+zostać\s+czysty"],
        "patterns_b": [r"desktop/claude-sandbox", r"desktop/ai_studio"],
    },
]


def _slugify(t: str) -> str:
    t = re.sub(r"[^\w\s-]", "", t.lower())
    t = re.sub(r"[\s_-]+", "_", t).strip("_")
    return t[:50] or "section"


def _filename_for(s: dict[str, Any]) -> str:
    t = s["title"].lower()
    if any(p in t for p in ["pixelforgood", "stopmetzoeken", "mural", "octagon", "og electric", "invoiceflow"]):
        prefix = "project_"
    elif "reference" in t or "kontakt" in t or "strato" in t:
        prefix = "reference_"
    else:
        prefix = "feedback_"
    return prefix + _slugify(s["title"]) + ".md"


def _classify(s: dict[str, Any]) -> str:
    t = s["title"].lower()
    for k in KEEP_KW:
        if k in t and len(k) > 8:
            return "keep"
    for k in MOVE_KW:
        if k in t:
            return "move"
    if s["chars"] > 1200:
        return "move"
    return "keep"


def _norm_line(s: str) -> str:
    s = s.strip(" -*•·>").strip()
    s = re.sub(r"\s+", " ", s)
    return s.lower()


def parse(src: str) -> dict[str, Any]:
    """Parse raw CLAUDE.md text and return stats + section dicts.

    Same algorithm as the script in parser.py but takes the source as
    an argument and returns the structured payload instead of writing
    to disk.
    """
    total = len(src)
    lines = src.split("\n")

    sections: list[dict[str, Any]] = []
    current: dict[str, Any] = {"title": "__PREAMBLE__", "level": 0, "lines": []}
    for line in lines:
        m = re.match(r"^(#{1,3})\s+(.+)$", line)
        if m:
            if current["lines"] or current["title"] != "__PREAMBLE__":
                sections.append(current)
            current = {"title": m.group(2).strip(), "level": len(m.group(1)), "lines": [line]}
        else:
            current["lines"].append(line)
    sections.append(current)

    merged: list[dict[str, Any]] = []
    for s in sections:
        s["content"] = "\n".join(s["lines"])
        s["chars"] = len(s["content"])
        if s["level"] >= 3 and merged:
            merged[-1]["content"] += "\n" + s["content"]
            merged[-1]["chars"] = len(merged[-1]["content"])
        else:
            merged.append(s)

    duplicates: dict[int, list] = defaultdict(list)
    line_index: dict[str, list] = defaultdict(list)
    for i, s in enumerate(merged):
        seen_in_this = set()
        for raw in s["content"].split("\n"):
            n = _norm_line(raw)
            if len(n) < 25:
                continue
            if re.match(r"^#{1,6}\s", n):
                continue
            if n in seen_in_this:
                continue
            seen_in_this.add(n)
            line_index[n].append((i, raw.strip()))

    phrase_index: dict[str, set] = defaultdict(set)
    for i, s in enumerate(merged):
        cl = s["content"].lower()
        for pat, label in KEY_PHRASES_RE:
            if re.search(pat, cl, re.I):
                phrase_index[label].add(i)

    for n, occurrences in line_index.items():
        if len(occurrences) >= 2:
            ids = list({o[0] for o in occurrences})
            if len(ids) < 2:
                continue
            sample = occurrences[0][1][:80]
            for sid in ids:
                others = [x for x in ids if x != sid]
                duplicates[sid].append({"kind": "line", "with": others, "sample": sample})

    for label, sids in phrase_index.items():
        if len(sids) >= 3:
            for sid in sids:
                others = sorted(x for x in sids if x != sid)
                duplicates[sid].append({"kind": "phrase", "label": label, "with": others, "sample": label})

    cross_conflicts: dict[int, list] = defaultdict(list)
    section_sides = []
    for i, s in enumerate(merged):
        cl = s["content"].lower()
        sides = []
        for rule in CONFLICT_RULES:
            a = any(re.search(p, cl, re.I) for p in rule["patterns_a"])
            b = any(re.search(p, cl, re.I) for p in rule["patterns_b"]) if rule["patterns_b"] else False
            if rule.get("check_em_dash_present") and a and "—" in s["content"]:
                cross_conflicts[i].append({
                    "rule_id": rule["id"], "label": rule["label"], "with": i, "note": "em-dash w tej samej sekcji",
                })
            if a and b:
                cross_conflicts[i].append({
                    "rule_id": rule["id"], "label": rule["label"], "with": i, "note": "wewnatrz sekcji",
                })
            sides.append({"a": a, "b": b})
        section_sides.append(sides)

    for i, sa in enumerate(section_sides):
        for j, sb in enumerate(section_sides):
            if i == j:
                continue
            for ri, rule in enumerate(CONFLICT_RULES):
                if rule.get("check_em_dash_present"):
                    continue
                if sa[ri]["a"] and sb[ri]["b"]:
                    cross_conflicts[i].append({
                        "rule_id": rule["id"], "label": rule["label"], "with": j, "note": f"kolizja z sekcja #{j+1}",
                    })

    out_sections = []
    for i, s in enumerate(merged):
        action = _classify(s)
        out_sections.append({
            "id": i,
            "title": s["title"] if s["title"] != "__PREAMBLE__" else "(preambula)",
            "level": s["level"],
            "chars": s["chars"],
            "content": s["content"],
            "suggested_action": action,
            "suggested_filename": _filename_for(s) if action == "move" else "",
            "duplicates": duplicates.get(i, []),
            "conflicts": cross_conflicts.get(i, []),
        })

    stats = {
        "total_chars": total,
        "section_count": len(out_sections),
        "keep_count": sum(1 for s in out_sections if s["suggested_action"] == "keep"),
        "move_count": sum(1 for s in out_sections if s["suggested_action"] == "move"),
        "delete_count": 0,
        "keep_chars": sum(s["chars"] for s in out_sections if s["suggested_action"] == "keep"),
        "move_chars": sum(s["chars"] for s in out_sections if s["suggested_action"] == "move"),
        "duplicate_pairs": sum(len(d) for d in duplicates.values()) // 2,
        "conflict_count": sum(len(c) for c in cross_conflicts.values()),
    }

    return {"stats": stats, "sections": out_sections}
