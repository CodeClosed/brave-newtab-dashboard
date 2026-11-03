# Product Specification: New Tab Dashboard (v0.3.0)

**Target Audience:** Power users, developers, students, and professionals using Chromium browsers (Brave, Chrome) who want a clean, organized, context-separated personal workspace instead of cluttered default bookmark bars or noisy default new-tab pages.

---

## 1. Product Summary & Core Identity

- **Positioning:** A local-first browser workspace that organizes browsing activities into customizable contexts. Bookmarks and collections remain the central core; widgets, wallpapers, and glass visual customization support that experience.
- **Core Value Proposition:**
  - **Local-first & Private:** No backend, no accounts, no analytics, zero telemetry.
  - **Fast & Lightweight:** Pure ES modules, zero runtime npm dependencies, zero build step, zero flash of wrong theme (FOWT).
  - **Context Isolation:** Spaces partition distinct environments (Personal, Work, Study) with instant keyboard switching.
  - **Reliable Data Contracts:** Automated snapshots with checksum validation, rolling recovery copies, and emergency tab-close persistence.

---

## 2. Feature Architecture

### 2.1 Two-Stage Dashboard
- **Stage 1 (Hero Screen):** Clean, calm opening view showing high-resolution wallpaper, hero clock typography, personalized greeting, pill search bar, floating app dock, and optional opt-in widgets.
- **Stage 2 (Collections Hub):** Discovered by scrolling down or pressing `g` / clicking the bidirectional top-right jump toggle. Collections are rendered as frosted glass panels (`backdrop-filter: blur()`).
- **Hub View Modes:** One-click toggle between responsive multi-column layout and a tabbed glass stack with collection category pills.

### 2.2 Spaces (Multi-Context Workspaces)
- Partition bookmarks and widgets across distinct contexts (e.g. *Personal*, *Development*, *Academic*, *Work*).
- Switch spaces via inline header switcher or keyboard shortcuts (`[` and `]`).
- Move collections between spaces.
- Independent notes scratchpad and to-do task checklist isolated per space.

### 2.3 Omnidirectional Floating App Dock
- Quick launch bar displaying pinned bookmarks and app launcher trigger.
- Configurable to 5 positions: `bottom` (default), `top`, `left`, `right`, or `off`.
- Up to 12 pinned items with drag-and-drop reordering.
- Auto-hide mode fades when idle and smoothly reveals on viewport edge hover or keyboard focus.

### 2.4 Native Chromium Tab Groups Integration
- **Save Current Tabs:** One-click capture of open browser tabs into categorized collections, preserving tab group titles and colors with instant Undo and tab-close options (uses optional `tabs` permission).
- **Open as Tab Group:** Launch entire collections directly into Chrome/Brave native tab groups (uses optional `tabGroups` permission).

### 2.5 Unified Search & Instant Calculator
- Focus with `/` key.
- Multi-signal ranking: exact > prefix > word-prefix > substring > domain.
- Search engine shortcuts (e.g. `yt cats` expands to YouTube).
- Hand-written recursive-descent math parser (`+ - * / ^ ( ) %`) calculates expressions directly inside the search bar without `eval()`.
- Search and filter across all spaces or active space.

### 2.6 Backgrounds, Wallpapers & Glass Styling
- **Bundled SVG Wallpapers:** Six original bundled SVG wallpapers (misty forest, warm wave, violet dusk, midnight blue, sand, graphite).
- **Custom Wallpapers:** Client-side downscaled (max 2560px) and compressed (<1.5MB) stored in IndexedDB.
- **Wallpaper Tuner:** Interactive popover with live thumbnail selection, blur, dim, focal point picker, and glass opacity tuner.
- **Day/Night Theme Mapping:** Assign distinct wallpapers to light and dark themes with automatic switching.

### 2.7 Data Safety, Snapshots & Emergency Recovery
- **Automated Snapshots:** Up to 10 rolling snapshots saved in IndexedDB with FNV-1a checksums, schema version, and data size metrics.
- **Pre-Restore Validation:** Every snapshot is verified against its checksum, schema-validated, and auto-migrated before replacing state.
- **Clean Daily Baseline:** Automatic daily snapshots capture the clean state upon opening the first tab of the day, before modifications occur.
- **Emergency Unload Recovery:** Synchronous emergency recovery slot mirrors debounced writes during `pagehide` so abrupt tab termination cannot lose data.

---

## 3. Privacy, Permissions & Network Boundaries

### Strictly Zero-Network by Default
- The extension makes zero background network requests upon install and startup.
- **Weather Widget (Opt-in only):**
  - Connects exclusively to Open-Meteo (`api.open-meteo.com` and `geocoding-api.open-meteo.com`).
  - No API keys, no tracking, no cookies, no advertising.
  - Transparent in-drawer privacy disclosure explaining that coordinates are transmitted only to fetch local temperatures and cached for 30 minutes.
- **Runtime Permissions:**
  - `storage`, `favicon`: Core required permissions.
  - `bookmarks`, `tabs`, `tabGroups`: Strictly optional permissions requested only on user action.
