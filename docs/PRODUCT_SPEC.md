# Product Specification: New Tab Dashboard

**Target Audience:** Power users, developers, students, and professionals using Chromium browsers (Brave, Chrome) who want a clean, organized, categorized personal dashboard instead of cluttered default bookmark bars or noisy default new-tab pages.

---

## 1. Product Summary & Philosophy

- **Concept:** Replaces the default browser New Tab page with a customizable, categorized dashboard. Bookmarks are organized into cohesive category cards (e.g., *Development*, *Work*, *Reading*, *Media*).
- **Core Value Proposition:**
  - **Local-first & Private:** No backend, no accounts, no analytics, no third-party network pings.
  - **Fast & Lightweight:** Pure ES modules, zero framework overhead, zero flash of wrong theme (FOWT).
  - **Quiet & Utility-Focused:** High information density, restrained aesthetics, keyboard-friendly.

---

## 2. In-Scope Features

### 2.1 Category Cards
- **Structure:** Each card represents a collection/category.
  - Category header: Emoji/icon, category title, count of items, collapse/expand toggle, contextual action trigger (`...`).
  - Bookmarks list: Compact rows containing a favicon, bookmark name, and optional domain.
  - Quick action: Inline `+ Add Bookmark` trigger at the bottom of the card or in header actions.
- **Card Operations:**
  - Add category with name and icon/emoji.
  - Rename category and change icon.
  - Collapse / Expand category (collapsed state persisted in storage).
  - Reorder categories via drag-and-drop or accessible keyboard controls.
  - Delete category (with undo toast notification).

### 2.2 Bookmarks
- **Bookmark Attributes:** Title, URL, category ID, order index.
- **Bookmark Operations:**
  - Add bookmark (with auto-prepending `https://` if omitted).
  - Edit bookmark title and URL.
  - Delete bookmark (with undo toast notification).
  - Move bookmark across categories or within category via drag-and-drop or keyboard item menu.
  - Favicon resolution: Primary resolution via Chromium internal `chrome.runtime.getURL('/_favicon/')`; deterministic initials tile fallback when uncached or failed.

### 2.3 Search Experience
- Centered, visually balanced search bar with selectable engines:
  - Google (`https://www.google.com/search?q=`)
  - Brave Search (`https://search.brave.com/search?q=`)
  - DuckDuckGo (`https://duckduckgo.com/?q=`)
  - Bing (`https://www.bing.com/search?q=`)
- Pure HTML `<form method="get">` navigation (requires no permissions).
- Keyboard shortcut: Pressing `/` focuses the search bar once the document is active (without attempting to hijack browser omnibox focus on initial tab creation).

### 2.4 Clock, Date, and Greeting
- Optional greeting ("Good morning", "Good afternoon", "Good evening").
- Optional digital clock with 12-hour (with AM/PM) or 24-hour display format.
- Optional localized date display (e.g., "Thursday, October 1").
- Toggles for each element in the settings drawer; size is capped at 44px to prevent dominating the screen.

### 2.5 Personalization & Settings Drawer
- Sliding side drawer or modal dialog containing grouped settings:
  1. **Appearance:** Theme toggle (System / Dark / Light), subtle accent selector, background selector.
  2. **Layout:** Grid mode (multi-column) vs. Compact mode (condensed spacing and single/dual columns).
  3. **Clock & Greeting:** Visibility toggles and time format.
  4. **Search:** Default search engine dropdown.
  5. **Categories:** Overview manager list to view, reorder, or edit categories.
  6. **Data Management:** JSON Export, JSON Import (with preview, validation, and schema migration), and Reset to Defaults.

### 2.6 Background Options
- **None:** Clean neutral theme surface.
- **Solid:** User-selected subtle solid color.
- **Gradient:** Subdued two-stop neutral gradient.
- **Custom Image:** Stored as Blobs in IndexedDB (downscaled to max 2560px), with adjustable dimming overlay (default 35%) to maintain readable WCAG contrast.

---

## 3. Explicit Non-Goals (Out of Scope)

To preserve privacy, performance, and simplicity, the following are strictly non-goals:
- No remote user accounts, authentication, or cloud sync backends (Firebase, Supabase, AWS).
- No browsing history mining or automatic category generation.
- No telemetry, analytics, or behavioral tracking.
- No AI assistant chatbots, productivity scoreboards, or habit tracking widgets.
- No dynamic external web fonts or CDN script dependencies.

---

## 4. User Journeys & Core Flows

### 4.1 First Launch Flow
1. User installs the unpacked extension and presses `Ctrl + T`.
2. `boot.js` initializes default dark/light attributes from `localStorage` (or defaults to system scheme).
3. System loads initial seed data (4 starter categories: *Development*, *Productivity*, *Reading*, *Media* with representative links).
4. Page renders immediately with zero network requests.

### 4.2 Add Bookmark Flow
1. User clicks `+ Add Bookmark` on a category card or opens the global add shortcut.
2. Native `<dialog>` modal opens with inputs: Title, URL, and Category selector.
3. User types a URL (e.g. `github.com`).
4. On submit, URL is validated (prepending `https://` if needed; rejecting `javascript:` or non-http protocols).
5. State is updated, storage write is debounced, and category card re-renders with the new bookmark.

### 4.3 Drag-and-Drop & Keyboard Reorder Flow
- **Mouse Users:** Grab handle / card allows dragging bookmark within or across categories, and reordering categories. Clear drop indicators show target positions.
- **Keyboard Users:** Context menu on bookmarks/categories provides "Move Up", "Move Down", and "Move to Category...", announcing the new index and category via an `aria-live` status element.

### 4.4 Data Backup & Restore Flow
- **Export:** Serializes settings and categories to a downloadable `.json` file.
- **Import:** User selects a `.json` file. The app validates JSON structure, checks schema version, runs migration if needed, previews item counts, and allows one-click restore with an undo buffer.
