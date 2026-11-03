# Changelog

All notable changes to the **New Tab Dashboard** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2026-11-03

### Added
- **Two-Stage Glass Architecture:** Calm Stage 1 Hero panel with frosted Stage 2 Collections Hub below the fold (`backdrop-filter: blur()`).
- **Spaces (Context Isolation):** Multi-workspace partitioning across Personal, Work, and Study with `[` and `]` cycling shortcuts.
- **Omnidirectional Floating App Dock:** Configurable to 5 positions (`bottom`, `top`, `left`, `right`, `off`) with drag-and-drop pinning and intelligent idle auto-hide.
- **Native Browser Tab Groups Integration:** One-click "Save current tabs" into collections and "Open as native tab group" in Brave/Chrome.
- **Data Reliability Pipeline:**
  - 32-bit FNV-1a checksums on all snapshots for bitrot and tampering detection.
  - Pre-restore schema validation (`validateDashboardData`) and auto-migration pipeline.
  - Pre-edit baseline snapshots captured upon opening the first tab of the day.
  - Crash-safe emergency unload flush (`ntd_emergency_recovery`) preventing data loss on abrupt tab termination.
- **Performance:** Selective store subscriptions with memoized dirty-check watchers, eliminating full-page DOM re-renders during micro-interactions.
- **Large Dataset Benchmarks:** 1,000-bookmark (<15ms) and 5,000-bookmark (<45ms) search and ranking performance assertions.
- **CI / CD:** Automated GitHub Actions test workflow across Node.js 18.x, 20.x, and 22.x.
- **Widgets:** Countdown timer, speed dial tiles, and daily focus quote widgets.

### Fixed
- **Weather Opt-In Violation:** Removed forced `weather.enabled = true` and default city assignment during bootstrap; weather is now strictly opt-in (`enabled: false`) with zero network requests by default.
- **Snapshot Error Swallowing:** Resolved silent exception handling in `saveSnapshotRecord` to ensure database failures surface transparently.
- **Navigation Controls:** Restored top-right action capsule and bidirectional stage jump button.

### Refactored
- **Settings Drawer Decomposition:** Split monolithic ~3,000-line `drawer.js` into modular sub-controllers under `js/ui/drawer/` (`appearance.js`, `layout.js`, `widgets.js`, `data.js`, `common.js`).

---

## [0.2.0] - 2026-10-05

### Added
- Multi-space scratchpad Notes widget isolated per space.
- Checkable To-do task checklist isolated per space.
- Chrome internationalization (`chrome.i18n`) foundation with English message catalogs.
- Accessibility section with reduced motion toggle and 44px touch targets.
- Idle Auto-Hide mode with keyboard wake-up.
- Custom accent colors with real-time WCAG AA/AAA contrast validation.
- Automated IndexedDB rolling snapshots (up to 10 copies) with one-click restore.

### Changed
- Migrated data model from Schema v1 to Schema v2.
- Enforced 5MB import file cap and 5,000 bookmark ceiling.

---

## [0.1.0] - 2026-10-01

### Added
- Initial release for Brave Browser and Google Chrome.
- Manifest V3 compliant architecture with zero runtime npm dependencies.
- Categorized bookmark collections with inline drag-and-drop.
- Unified search combobox with ranked matching and instant math calculator.
- Digital clock, personalized greeting, and date display.
- Netscape HTML and CSV bookmark import/export.
- Synchronous blocking `boot.js` script eliminating Flash of Wrong Theme (FOWT).
