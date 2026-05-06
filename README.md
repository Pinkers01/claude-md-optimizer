# CLAUDE.md Optimizer

Interactive optimizer for `CLAUDE.md` global instruction files used by Claude Code, Anthropic SDK projects and other LLM context files. Reduces oversized rule files (`>40k` chars) into a slim master instruction plus a topical memory tree, while flagging duplicate rules and self-contradictions before you ship.

Built by Pinky Creative Studio.

## Why

Long-running Claude Code sessions accrete rules. Each session adds preferences, anti-patterns, fixes. After six months a typical `CLAUDE.md` crosses the `40k`-character performance ceiling, the agent starts thrashing context, and many rules silently contradict each other. Manual cleanup is a chore.

This tool gives you a single click. It loads your `CLAUDE.md`, splits it into sections, detects duplicates and rule conflicts, and lets you decide per section: keep, move to a memory file, or drop. Output is a ZIP with a slim `CLAUDE_NEW.md`, individual `memory/*.md` files, and a report.

## Features

- 100 percent client-side. No data leaves the browser.
- Section-level keep / move / delete with live char counter and 35k target.
- Duplicate detection across sections (line-level and key-phrase level).
- Conflict detection for common rule pairs: payments stack (Stripe vs Mollie), em-dash policy, autonomy vs ask-first, lite vs full mode, paid API rules, hosting folder rules.
- Search and filter (Keep / Memory / Delete / With duplicates / With conflicts).
- Per section: edit textarea, shrink-by-50 percent, revert to original.
- Export ZIP with `CLAUDE_NEW.md`, `memory/*.md`, and `OPTIMIZATION_REPORT.md`.
- Multilingual UI (PL / EN / NL).
- Dark mode by default, system-ui font, no telemetry.

## Install

### macOS

Download `CLAUDE.md Optimizer.app.zip` from the Releases page, unzip, drag to Applications. Double click to launch. The app opens the local optimizer in your default browser.

### Windows

Download `CLAUDE.md Optimizer.exe` from the Releases page. Double click to launch. The app opens the local optimizer in your default browser.

### Standalone HTML

You can also use just the `optimizer.html` file. Open it in any modern browser (Chrome, Safari, Edge, Firefox).

## Usage

1. Launch the app (or open `optimizer.html` directly).
2. Drop your `CLAUDE.md` onto the loader, or paste the path.
3. Review sections. Pay attention to red conflict badges and orange duplicate badges first.
4. Edit, shrink, or reclassify each section.
5. Add any new instructions in the bottom textarea.
6. When the live counter is below 35k, click `Generate`.
7. Unzip the result and replace your old `CLAUDE.md`.

## Pricing

Hosted version with cloud sync, license, and updates: 9 EUR lifetime via [stopmetzoeken.store/apps/optimizer](https://stopmetzoeken.store/apps/optimizer).

The repository code is open under MIT. The hosted product bundles signed `.app` and `.exe` builds, license, payment integration, support, and future updates.

## Tech stack

- Vanilla HTML, CSS, JavaScript (zero framework).
- JSZip for ZIP export.
- Python parser for the initial section split (run server-side in the hosted version, or via the included `parser.py` for local dev).
- macOS `.app` packaged via `osacompile`.
- Windows `.exe` packaged via PyInstaller (built on GitHub Actions).

## Repository layout

```
claude-md-optimizer/
  src/                  # Source HTML, CSS, JS, Python parser
  packaging/
    macos/              # .app bundle source
    windows/            # PyInstaller spec
  landing/              # Marketing page deployed to stopmetzoeken.store/apps/optimizer
  server/               # Mollie checkout, license issuance, download portal
  docs/                 # User docs, screenshots, demo gif
  build/                # Output artifacts (gitignored)
```

## Privacy

All section parsing and ZIP generation happens in the browser. No `CLAUDE.md` content is ever uploaded to a remote server. The hosted landing page only handles payment and license issuance.

## License

MIT for the source repository. Hosted product (signed builds, payment, license server) is proprietary.

## Contact

- Pinky Creative Studio
- klantenservice@stopmetzoeken.store
- +31 6 38 90 94 16
- Troelstradreef 72, 5237 VJ Den Bosch, Netherlands
