# Contributing to New Tab Dashboard

Thank you for your interest in contributing! This project is a local-first, privacy-focused customizable New Tab dashboard extension for Brave and Google Chrome.

---

## 1. Core Engineering Principles

Before contributing code, please review our strict architectural guardrails:

1. **Zero Runtime npm Dependencies:** The extension executes purely on vanilla modern JavaScript ES Modules (`// @ts-check` with JSDoc typing). Do not introduce React, Vue, Lodash, or runtime package bundles.
2. **Local-First & Zero Telemetry:** Never add tracking scripts, telemetry pings, remote scripts, or external CDN web fonts.
3. **Safe DOM Construction:** Never use `innerHTML` or `outerHTML` for user-supplied or dynamic data (bookmark titles, URLs, notes, todos, space names). All user text must be bound via `textContent`, `setAttribute`, or our safe DOM helper `el()` in `js/utils/dom.js`. Static internal SVG icons are isolated to `js/ui/icons.js`.
4. **Data Reliability & Migrations:** Any change to the state structure must be accompanied by a schema version bump in `core/schema.js` and a migration runner in `core/migrate.js`. Backward compatibility with earlier schemas is mandatory.
5. **No Regressions:** Every PR must pass all automated tests (`npm test`).

---

## 2. Development Setup

### Prerequisites
- Node.js (version 18.x, 20.x, or 22.x)
- Chromium-based browser (Brave Browser or Google Chrome)

### Running Tests Locally
```bash
# Run the complete unit, integration, and benchmark test suite
npm test
```

### Loading Unpacked Extension
1. Open your browser and navigate to `chrome://extensions` or `brave://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `extension/` folder inside this repository.
5. Open a new tab (`Ctrl + T` / `Cmd + T`).

---

## 3. Pull Request Guidelines

1. **Branch Naming:** Use descriptive branch names like `feat/new-widget-layout` or `fix/snapshot-recovery`.
2. **Commit Conventions:** Follow Conventional Commits:
   - `feat(...)`: New user-facing functionality.
   - `fix(...)`: Bug fixes or reliability patches.
   - `refactor(...)`: Code cleanup without behavior changes.
   - `test(...)`: New or updated tests.
   - `docs(...)`: Documentation updates.
3. **Automated Verification:** Your pull request will trigger the GitHub Actions CI suite testing across Node.js 18, 20, and 22.
4. **PR Checklist:**
   - [ ] All 336+ automated tests pass (`npm test`).
   - [ ] No `eval()`, `new Function()`, or untrusted `innerHTML` sinks added.
   - [ ] State mutations route strictly through `core/state.js` store methods.
   - [ ] Relevant documentation updated in `docs/` and `CHANGELOG.md`.
