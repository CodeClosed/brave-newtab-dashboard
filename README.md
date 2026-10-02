# New Tab Dashboard

> A clean, local-first customizable New Tab dashboard for Brave and Chrome — organize bookmarks into beautiful collections instead of cluttered bookmark grids.

A local-first, customizable New Tab extension for Chromium browsers that transforms the traditional bookmark grid into a clean, categorized personal dashboard. Users can organize websites into customizable collections, rearrange them through drag-and-drop, personalize their layout, theme, clock, search engine and background, and export or restore their dashboard data. Built with Manifest V3 and designed around speed, privacy, accessibility and a quiet, polished desktop experience.

---

## Features

- **Categorized Collections:** Group websites into clean, high-density cards (e.g. *Development*, *Professional*, *Reading*, *College*). Add, rename, collapse, or delete collections with customized icons and emojis.
- **Instant Boot & Zero Theme Flash (FOWT):** Synchronous blocking `<head>` script reading mirrored local state eliminates white screen flashing when opening tabs in dark mode.
- **Fluid Reordering:** Rearrange collections and bookmarks via native HTML5 drag-and-drop or accessible keyboard controls (`↑`/`↓`) with screen-reader announcements.
- **Privacy-Preserving Favicons:** Fetches website icons using Chromium's internal `chrome.runtime.getURL('/_favicon/')` API without pinging third-party servers. Sites without a cached favicon receive a deterministic, accessible letter-tile fallback.
- **Subtle Personalization:**
  - **Themes:** System (`prefers-color-scheme`), Light, Dark.
  - **Accents:** Slate, Blue, Emerald, Amber, Rose.
  - **Layouts:** Standard Grid vs. Compact.
  - **Backgrounds:** None, Subdued Solid presets, Gradient presets, or Custom Image Wallpapers stored as Blobs in IndexedDB (with adjustable dimming overlay).
  - **Clock & Greeting:** 12-Hour (AM/PM) / 24-Hour digital clock, localized date, and greeting toggles.
  - **Search:** Instant navigation to Google, Brave Search, DuckDuckGo, or Bing. Press `/` to focus.
- **Safe Data Management:**
  - One-click JSON backup export.
  - Hardened import with schema validation, ID collision deduplication, dangerous URL stripping (`javascript:`, `data:`), and pre-import preview.
  - One-click Undo for all deletions, restores, and resets.
  - Optional on-demand browser bookmarks import (requests permission only when clicked).

---

## Installation Guide

### Loading in Brave
1. Open Brave and navigate to `brave://extensions`.
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `extension` folder inside this repository:
   ```text
   c:\Users\vihaa\OneDrive\Desktop\Brave Extension\extension
   ```
5. Open a new tab (`Ctrl + T`).
   *Note: If Brave prompts you about an extension overriding your New Tab page, click "Keep Changes". In Brave Settings → "New Tab Page", make sure it is not locked to Brave News/Dashboard.*

### Loading in Google Chrome
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `extension` folder.
4. Press `Ctrl + T` to open your new tab dashboard.

*Note: Chromium only permits one extension to override the New Tab page at any time. If another new tab extension is enabled, disable it in your extensions manager.*

---

## Manual Verification Checklist (Brave Browser)

- [ ] Load unpacked extension from `brave://extensions`.
- [ ] Press `Ctrl + T`: Dashboard appears immediately with zero white flash.
- [ ] Click `+ New Collection` to create a custom category with name and emoji.
- [ ] Click `+ Add` to add a new bookmark. Verify URL auto-prepends `https://`.
- [ ] Drag a bookmark across collections and verify persistence after tab reload.
- [ ] Open Settings (`⚙` icon in top right):
  - Toggle Theme (Light / Dark / System).
  - Change Accent Color.
  - Toggle Clock, Date, and Greeting.
  - Select Brave Search as default engine.
- [ ] Export Backup JSON under Data tab.
- [ ] Test Reset to Defaults, then click **[Undo]** on the toast notification.

---

## Technical Architecture & Privacy

- **Manifest V3:** Complies strictly with modern Chromium extension security requirements. Zero inline scripts, zero remote code, zero external CDNs, and system fonts only.
- **Permissions Audit:**
  - `storage`: Required for local dashboard preferences and collections via `chrome.storage.local`.
  - `favicon`: Required for internal cached favicon resolution.
  - `bookmarks` *(optional)*: Only requested dynamically on-demand if the user clicks "Import Browser Bookmarks".
- **Zero Telemetry:** No analytics, no tracking pixels, no cloud servers. All bookmarks and settings remain 100% on your device.
- **Performance Budget:** Zero network requests during initial paint; renders 150+ bookmarks in under 20ms.

---

## Project Structure

```text
├── extension/                    <- Load Unpacked Root
│   ├── manifest.json             <- Manifest V3
│   ├── newtab.html               <- Main New Tab document
│   ├── icons/                    <- Extension icons (16, 48, 128px)
│   ├── css/
│   │   ├── tokens.css            <- CSS variables (colors, fonts, radii)
│   │   ├── base.css              <- Layout shell & typography
│   │   └── components/
│   │       ├── cards.css         <- Category cards & bookmark rows
│   │       ├── dialogs.css       <- Native <dialog> modals
│   │       ├── drawer.css        <- Settings side drawer
│   │       └── toasts.css        <- Undo notifications
│   └── js/
│       ├── boot.js               <- Synchronous blocking theme script
│       ├── main.js               <- Entry point
│       ├── core/                 <- State, storage, schema, migrations, idb
│       ├── features/             <- Search, clock, DnD, background, data-io
│       ├── ui/                   <- Components, dialogs, drawer, favicons, toasts
│       └── utils/                <- DOM and URL helpers
├── docs/                         <- Specifications & Architecture
│   ├── IMPLEMENTATION_PLAN.md
│   ├── PRODUCT_SPEC.md
│   ├── TECHNICAL_ARCHITECTURE.md
│   └── DESIGN_SYSTEM.md
└── tests/                        <- Automated node:test test suite
    ├── benchmark.test.js
    ├── background.test.js
    ├── crud.test.js
    ├── import-export.test.js
    ├── migrate.test.js
    ├── reorder.test.js
    ├── schema.test.js
    ├── settings.test.js
    └── url.test.js
```

---

## Running Automated Tests

Run the full unit test and performance benchmark suite using Node.js:

```powershell
node --test tests/*.test.js
```
