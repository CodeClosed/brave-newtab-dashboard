# New Tab Dashboard

> A clean, local-first customizable New Tab dashboard for Brave and Chrome — organize bookmarks into beautiful collections instead of cluttered bookmark grids.

A local-first, customizable New Tab extension for Chromium browsers that transforms the traditional bookmark grid into a calm, soft, responsive personal dashboard. Users can organize websites into categorized collections and multiple Spaces, edit inline or via bulk operations, personalize layout and typography, customize wallpapers and themes, and keep their data safe with automated snapshots. Built with Manifest V3 and designed around speed, zero telemetry, full keyboard accessibility, and a quiet desktop utility aesthetic.

---

## Features

### 1. Two-Stage Glass Architecture (v0.3.0)
- **Uncluttered Hero Stage:** Clean opening view featuring wallpaper, clock typography, personalized greeting, pill search bar, and optional weather capsule.
- **Frosted Glass Hub:** Scroll down or press `g` to reveal collections rendered as translucent frosted glass windows (`backdrop-filter: blur()`).
- **Responsive Hub Columns:** Automatic responsive column layout (1 to 5 columns based on viewport) with collapse animations.
- **Tabbed Stack View:** One-click toggle between traditional multi-column layout and a single tabbed glass window with category pills.
- **Free-Drag Widget Repositioning:** Press `e` to enter Edit Mode, grab widget handles or use arrow keys to position widgets anywhere on the main panel with center-percentage math and snap guides.

### 2. Floating Frosted Dock (v0.3.0)
- **Multi-Position Quick Launch:** Configurable dock position (`top`, `bottom`, `left`, `right`, or `off`) with up to 12 pinned links.
- **Drag-and-Drop Pinning & Reorder:** Drag bookmarks directly onto the dock to pin or reorder them, with keyboard Alt+Arrow parity.
- **Intelligent Auto-Hide:** Fades when idle and smoothly reveals on viewport edge hover or keyboard focus.

### 3. Native Browser Tab Groups (v0.3.0)
- **Save Current Tabs:** One-click "Save current tabs" captures open browser tabs into categorized collections, preserving tab group titles and colors with instant Undo and tab-close options.
- **Open as Tab Group:** Launch entire collections directly into Chrome/Brave native tab groups.
- **Session Badges:** Visual "Saved from tabs" indicator on imported collections that automatically clears upon custom editing.

### 4. Organization & Spaces
- **Multiple Spaces:** Partition dashboards across contexts (e.g. *Personal*, *Work*, *Study*) with an inline header switcher and keyboard shortcuts (`[` and `]` to cycle). Collections can be moved between spaces.
- **Categorized Collections:** Group websites into cards with custom icons and emojis. Add, rename, collapse, or delete collections with undo.
- **Sort & Collapse:** Instant A–Z sorting per collection, plus toolbar "Collapse all" and "Expand all".
- **Bulk Operations:** Multi-select bookmarks in Edit Mode (with Shift+Click range selection) to batch move, pin, or delete. "Add many" accepts multiline URL lists with live preview.
- **Custom Icons & Import:** Assign emojis, upload lightweight custom icons (downscaled to 64px, <12KB), or refresh favicons. Import from browser bookmarks (HTML Netscape format or API) and CSV.
- **First-Run Templates:** Choose from curated presets (*Student*, *Developer*, *Creator*, or *Start empty*) on fresh installs with a short, skippable tour.

### 5. Daily-Driver Speed & Search
- **Unified Search Combobox:** Type `/` to search the web or filter bookmarks across spaces, ranked by relevance (exact > prefix > word-prefix > substring > domain).
- **Search Engine Shortcuts:** Register custom search engine shortcuts (e.g., `yt cats` expands to YouTube).
- **Instant Calculator:** Hand-written math parser (`+ - * / ^ ( ) %`) calculates expressions directly inside the search bar without `eval`.
- **Edit Mode & Inline Editing:** Toggle with `e`. Press `F2` or double-click to rename collections and bookmarks in place. Inline "paste URL" row adds bookmarks instantly.
- **Drag-and-Drop & Paste:** Native drag reordering across cards and spaces, plus link drop and paste handlers.

### 6. Look & Feel
- **Card Styles & Layout:** Glass (v2), filled, frosted, outline, or minimal card styles; translucent surfaces; equal height toggle; configurable columns (auto, 1–6), card width, gap, and alignment.
- **Display Modes:** Per-collection overrides for List, Grid, or compact Icons-only display modes with rounded, square, or circular tile shapes.
- **Themes & Palettes:** System, Light, Dark themes with 5 color palettes (*Default*, *AMOLED*, *Paper*, *WCAG AAA High Contrast*) and 3 Glass Presets (*Ember*, *Dusk*, *Forest*).
- **Accent Colors & Contrast Guard:** Slate, Blue, Emerald, Amber, Rose, plus custom hex colors validated against WCAG AA contrast rules with automatic accessible shade suggestions.
- **Theme Presets & Schedule:** One-click presets with undo, plus automatic day/night theme scheduling via clock hours or solar sunrise/sunset.

### 7. Backgrounds & Wallpapers
- **Bundled SVG Wallpapers:** Six original bundled SVG wallpapers (warm fluid wave, violet dusk, misty forest, midnight blue, sand, graphite).
- **Adaptive Glass Opacity:** Automatically tunes glass surface opacity based on wallpaper luminance to maintain WCAG contrast.
- **Wallpaper Tuner:** Bottom-left corner popover with live thumbnail selection, blur, dim, and opacity sliders.
- **IndexedDB Wallpaper Library:** Store up to 10 wallpapers locally with client-side canvas downscaling (max 2560px), compression (<1.5MB), and library storage quotas.
- **Focal Point & Auto-Readability:** Click-to-set focal point (`background-position`), blur and dim sliders, and automatic luminance calculation ensuring text contrast.
- **Day & Night Pairs & Rotation:** Assign distinct wallpapers for light/dark modes or cycle on new tab, hourly, or daily.

### 8. Clock, Typography & Personal Touches
- **Clock Styles:** Hero typography, large, small, or left-aligned clock displays; optional seconds; date format formats; secondary world timezone.
- **Typography:** System fonts only (sans, serif, mono) with adjustable font scale (0.9 to 1.3).
- **Greeting & Countdown:** Personalized greeting (`Good evening, Name`) and countdown badge to target dates.
- **Focus & Auto-Hide Modes:** Press `f` to enter distraction-free Focus Mode. Optional auto-hide dims dashboard after idle and reveals upon mouse/keyboard activity.

### 9. Optional Widgets
- **Weather Capsule:** Opt-in weather widget powered by Open-Meteo with 30-minute local caching, WMO weather code mapping, and offline fallback.
- **Notes Widget:** Plain-text scratchpad isolated per space with debounced automatic saving.
- **To-do Widget:** Lightweight task checklist per space with add, check, delete, and clear-completed actions.

### 10. Data Safety & Snapshots
- **Automated Snapshots:** Up to 10 snapshots stored in IndexedDB before imports, migrations, resets, or daily edits.
- **One-Click Restore:** Restores full state with safety preview and undo.
- **Import / Export:** Robust JSON export and schema-validated import with collision resolution (v1 → v2 → v3).

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

---

## Technical Architecture & Privacy

- **Manifest V3:** Complies strictly with Chromium extension security guidelines. Zero remote code execution, zero external CDNs, and zero `eval()`.
- **Safe DOM Construction:** All user-controlled and untrusted strings (bookmark titles, URLs, collection names, notes, and task items) are strictly rendered using safe DOM APIs (`document.createElement`, `textContent`, `setAttribute`). Static, trusted internal SVGs are isolated to immutable code templates (`ui/icons.js`).
- **Strict Content Security Policy:** Script execution is locked to `'self'`. Inline styles (`style-src 'self' 'unsafe-inline'`) are utilized solely for dynamic CSS custom property tokens (`--glass-opacity`, `--accent-color`, etc.). Network requests are strictly disabled by default; opt-in weather communicates exclusively with Open-Meteo.
- **Permissions Audit:**
  - `storage`: Required for local dashboard preferences and collections via `chrome.storage.local`.
  - `favicon`: Required for internal cached favicon resolution via `chrome.runtime.getURL('/_favicon/')`.
  - `bookmarks` *(optional)*: Only requested dynamically on-demand if the user imports browser bookmarks.
  - `tabs` *(optional)*: Only requested dynamically on-demand when saving current tabs or opening tab groups.
  - `tabGroups` *(optional)*: Only requested dynamically on-demand to create/update native browser tab groups.
- **Zero Telemetry:** No tracking, no analytics, no third-party profiling. All bookmark and personal data remains strictly local on your device.
- **Performance Budget:** First paint < 20ms; responsive CSS layout with `content-visibility: auto` on collections hub.

---

## Running Automated Tests

Run the full automated test suite using Node.js:

```powershell
npm test
```

Currently contains **336 automated unit, integration, and benchmark tests** (with automated GitHub Actions CI) verifying all schemas, migrations, security validations, UI components, search ranking, calculator, wallpaper processing, dock, tab groups, weather, widget dragging, and accessibility features.
