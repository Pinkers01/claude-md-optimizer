# CLAUDE.md Optimizer v1.0.0

First public release. A standalone tool for optimizing oversized `CLAUDE.md` instruction files.

## Highlights

- 100% client-side. No data leaves the browser.
- Section-level keep / move / delete with a live char counter and 35k target.
- Duplicate detection at the line level and at the rule-phrase level.
- Conflict detection for common rule pairs: payments stack, em-dash policy, autonomy vs ask-first, lite vs full mode, paid API rules, hosting folder rules.
- Search and filter views (Keep, Memory, Delete, With duplicates, With conflicts).
- Per-section editor with shrink-by-50%, revert to original, and direct textarea editing.
- ZIP export containing the slim `CLAUDE_NEW.md`, individual `memory/*.md` files, and `OPTIMIZATION_REPORT.md`.
- Multilingual UI in PL, EN, NL.
- Dark mode by default, system-ui font, no telemetry.

## How to install

### macOS

1. Download `CLAUDE.md.Optimizer.macOS.zip` from this release.
2. Unzip and drag `CLAUDE.md Optimizer.app` into Applications.
3. Right-click the app the first time and pick Open to bypass Gatekeeper warnings (this build is ad-hoc signed; an Apple Developer ID build is on the roadmap).

### Windows

1. Download `CLAUDE.md Optimizer.exe` from this release.
2. Double-click to launch. The app opens the local optimizer in your default browser.

### Standalone HTML

Download `optimizer.html` from this release and open it in any modern browser. No install needed.

## What it does

You drop your `CLAUDE.md` onto the loader. The tool parses it into sections, flags duplicate rules and rule conflicts, and lets you decide per section: keep, move to a memory file, or drop. When the live counter shows you are below the 35k character target, it generates a ZIP with a slim master file plus topical memory files plus an audit report.

## Limitations

- Section parsing handles H1, H2, and H3 headers. H4+ is folded into the parent.
- Conflict detection runs on a fixed rule-pair list (Stripe vs Mollie, em-dash policy, ask-first vs autonomous, lite vs full, paid APIs, desktop folder). Custom rule pairs are not configurable in v1.0.0.
- The macOS build is ad-hoc signed; users see a Gatekeeper prompt the first time.
- The Windows build is unsigned; SmartScreen will warn on first launch.

## Roadmap

- v1.1.0: Configurable conflict rule pairs via a small JSON config block.
- v1.2.0: Apple Developer ID + EV code-signing for Windows.
- v1.3.0: Optional memory tree visualization (graph view of cross-references between memory files).
- v2.0.0: Hosted version at `stopmetzoeken.store/apps/optimizer` with cloud sync, license, and updates.

## Pricing

The repository code is open under MIT.

The hosted product, with signed `.app` and `.exe` builds, license, payment integration, support, and future updates, is 9 EUR lifetime at https://stopmetzoeken.store/apps/optimizer.

## Contact

Pinky Creative Studio
klantenservice@stopmetzoeken.store
+31 6 38 90 94 16
Troelstradreef 72, 5237 VJ Den Bosch, Netherlands
