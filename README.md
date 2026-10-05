# New Tab Dashboard

> A clean, local-first customizable New Tab dashboard for Brave and Chrome — organize bookmarks into beautiful collections instead of cluttered bookmark grids.

A local-first, customizable New Tab extension for Chromium browsers that transforms the traditional bookmark grid into a calm, soft, responsive personal dashboard. Users can organize websites into categorized collections and multiple Spaces, edit inline or via bulk operations, personalize layout and typography, customize wallpapers and themes, and keep their data safe with automated snapshots. Built with Manifest V3 and designed around speed, zero telemetry, full keyboard accessibility, and a quiet desktop utility aesthetic.

---

## Features

### 1. Organization & Spaces
- **Multiple Spaces:** Partition dashboards across contexts (e.g. *Personal*, *Work*, *Study*) with an inline header switcher and keyboard shortcuts (`[` and `]` to cycle). Collections can be moved between spaces.
- **Categorized Collections:** Group websites into cards with custom icons and emojis. Add, rename, collapse, or delete collections with undo.
- **Pinned Strip:** Pin favorite bookmarks to a quick-access top strip.
- **Sort & Collapse:** Instant A–Z sorting per collection, plus toolbar "Collapse all" and "Expand all".
- **Bulk Operations:** Multi-select bookmarks in Edit Mode (with Shift+Click range selection) to batch move, pin, or delete. "Add many" accepts multiline URL lists with live preview.
- **Custom Icons & Import:** Assign emojis, upload lightweight custom icons (downscaled to 64px, <12KB), or refresh favicons. Import from browser bookmarks (HTML Netscape format or API) and CSV.
- **First-Run Templates:** Choose from curated presets (*Student*, *Developer*, *Creator*, or *Start empty*) on fresh installs with a short, skippable tour.

### 2. Daily-Driver Speed & Search
- **Unified Search Combobox:** Type `/` to search the web or filter bookmarks across spaces, ranked by relevance (exact > prefix > word-prefix > substring > domain).
- **Search Engine Shortcuts:** Register custom search engine shortcuts (e.g., `yt cats` expands to YouTube).
- **Instant Calculator:** Hand-written math parser (`+ - * / ^ ( ) %`) calculates expressions directly inside the search bar without `eval`.
- **Edit Mode & Inline Editing:** Toggle with `e`. Press `F2` or double-click to rename collections and bookmarks in place. Inline "paste URL" row adds bookmarks instantly.
- **Drag-and-Drop & Paste:** Native drag reordering across cards and spaces, plus link drop and paste handlers.

### 3. Look & Feel
- **Card Styles & Layout:** Filled, frosted, outline, or minimal card styles; translucent surfaces; equal height toggle; configurable columns (auto, 1–6), card width, gap, and alignment.
- **Display Modes:** Per-collection overrides for List, Grid, or compact Icons-only display modes with rounded, square, or circular tile shapes.
- **Themes & Palettes:** System, Light, Dark themes with 5 color palettes (*Default*, *AMOLED*, *Paper*, *WCAG AAA High Contrast*).
- **Accent Colors & Contrast Guard:** Slate, Blue, Emerald, Amber, Rose, plus custom hex colors validated against WCAG AA contrast rules with automatic accessible shade suggestions.
- **Theme Presets & Schedule:** One-click presets (*Warm paper*, *Forest*, *Midnight*, *High contrast*) with undo, plus automatic day/night theme scheduling via clock hours or solar sunrise/sunset.

### 4. Backgrounds & Wallpapers
- **IndexedDB Wallpaper Library:** Store up to 10 wallpapers locally with client-side canvas downscaling (max 2560px), compression (<1.5MB), and library storage quotas.
- **Focal Point & Auto-Readability:** Click-to-set focal point (`background-position`), blur and dim sliders, and automatic luminance calculation ensuring text contrast.
- **Day & Night Pairs:** Assign distinct wallpapers for light and dark modes with automatic switching.
- **Wallpaper Rotation:** Cycle through library wallpapers on new tab, hourly, or daily without page flicker.
- **Solid Colors & Gradients:** Subdued color presets, custom hex pickers, and linear gradient builder safely guarded against injection.

### 5. Clock, Typography & Personal Touches
- **Clock Styles:** Large, small, or left-aligned clock displays; optional seconds; date format formats; secondary world timezone.
- **Typography:** System fonts only (sans, serif, mono) with adjustable font scale (0.9 to 1.3).
- **Greeting & Countdown:** Personalized greeting (`Good evening, Name`) and countdown badge to target dates.
- **Focus & Auto-Hide Modes:** Press `f` to enter distraction-free Focus Mode. Optional auto-hide dims dashboard after idle and reveals upon mouse/keyboard activity.

### 6. Accessibility & Localization
- **Accessibility Center:** Dedicated Accessibility settings drawer tab with motion preference overrides (System vs. Reduce Motion with 0.01ms animations) and Large Touch Targets (enforcing 44×44px minimum targets).
- **Full Keyboard Navigation:** Complete keyboard walkthrough (`/` search, `e` edit mode, `f` focus mode, `[` / `]` space cycling, arrows, Enter, Escape).
- **Localization Ready:** User-facing strings structured with `_locales/en/messages.json` and safe runtime fallbacks.

### 7. Optional Widgets
- **Notes Widget:** Plain-text scratchpad isolated per space with debounced automatic saving.
- **To-do Widget:** Lightweight task checklist per space with add, check, delete, and clear-completed actions.
- *Both widgets are off by default and toggleable in Settings → Widgets.*

### 8. Data Safety & Snapshots
- **Automated Snapshots:** Up to 10 snapshots stored in IndexedDB before imports, migrations, resets, or daily edits.
- **One-Click Restore:** Restores full state with safety preview and undo.
- **Import / Export:** Robust JSON export and schema-validated import with collision resolution.

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

- **Manifest V3:** Complies strictly with Chromium extension security guidelines. Zero inline scripts, zero remote code execution, zero external CDNs, zero `eval`, zero `innerHTML`.
- **Permissions Audit:**
  - `storage`: Required for local dashboard preferences and collections via `chrome.storage.local`.
  - `favicon`: Required for internal cached favicon resolution via `chrome.runtime.getURL('/_favicon/')`.
  - `bookmarks` *(optional)*: Only requested dynamically on-demand if the user clicks "Import Browser Bookmarks".
- **Zero Telemetry:** No tracking, no analytics, no network pings. All data remains strictly local on your device.
- **Performance Budget:** First paint < 20ms; 150 bookmarks and 12 collections benchmark runs in ~4ms (budget: 50ms). Zero runtime dependencies.

---

## Running Automated Tests

Run the full automated test suite using Node.js:

```powershell
npm test
```

Currently contains **242+ unit and integration tests** verifying all schemas, migrations, security validations, UI components, search ranking, calculator, wallpaper processing, and accessibility features.
