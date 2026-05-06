# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-05-06

### Added

- Standalone `optimizer.html` artifact, fully client-side, no telemetry.
- Section parser with H1, H2, H3 header detection. H3+ folds into the parent.
- Classification heuristic that suggests keep, move, or delete per section.
- Duplicate detection at the line level (>=25 normalized chars across sections) and at the rule-phrase level (key topics appearing in 3 or more sections).
- Conflict detection for 7 common rule pairs: Stripe vs Mollie for NL, em-dash policy, ask-first vs autonomous, lite vs full mode, paid API rules, Apps Cloude folder rules, autonomy vs 3-4 options.
- ZIP export with `CLAUDE_NEW.md`, `memory/*.md`, `OPTIMIZATION_REPORT.md`.
- macOS `.app` bundle with shell launcher, custom icon, ad-hoc codesigning.
- Windows `.exe` packaging via PyInstaller, single-file, custom icon.
- GitHub Actions workflow `build-release.yml` for tag-triggered cross-platform builds and GitHub Release publishing.
- GitHub Actions workflow `test.yml` for PR and main-branch validation: pytest, html5validator, inline JS syntax check, shellcheck.
- Pytest fixtures and 14 unit tests covering parser stats, classification, duplicate detection, conflict detection, filename suggestions.
- Multilingual UI in PL, EN, NL.

### Security

- All parsing and ZIP generation happens client-side. No `CLAUDE.md` content is uploaded to a remote server.
- The hosted landing page only handles payment and license issuance; it does not see user content.

[Unreleased]: https://github.com/Pinkers01/claude-md-optimizer/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Pinkers01/claude-md-optimizer/releases/tag/v1.0.0
