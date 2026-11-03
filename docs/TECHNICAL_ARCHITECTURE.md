# Technical Architecture: New Tab Dashboard (v0.3.0)

## 1. Overview & Core Philosophy

- **Platform:** Chromium Manifest V3 (Brave Browser & Google Chrome).
- **Core Principle:** Local-first, privacy-first, zero runtime npm dependencies, zero build step.
- **Language / Runtime:** Modern JavaScript ES Modules with JSDoc typing (`// @ts-check`).
- **Load Unpacked Target:** The `extension/` directory serves directly as the unpacked extension root.
- **Visual Design:** Glass v2 design system — two-stage calm dashboard with frosted-glass surfaces over high-resolution bundled and custom wallpapers.

---

## 2. Manifest V3 & Permissions Architecture

### `manifest.json` Structure
```json
{
  "manifest_version": 3,
  "name": "New Tab Dashboard",
  "version": "0.3.0",
  "description": "A clean, local-first customizable New Tab dashboard for Brave and Chrome.",
  "chrome_url_overrides": {
    "newtab": "newtab.html"
  },
  "permissions": [
    "storage",
    "favicon"
  ],
  "optional_permissions": [
    "bookmarks",
    "tabs",
    "tabGroups"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com"
  }
}
```

### Permission Strategy & Justifications
| Permission | Scope | Justification |
|---|---|---|
| `storage` | Required | Authoritative persistence for dashboard state, spaces, bookmark collections, and settings via `chrome.storage.local`. |
| `favicon` | Required | Securely fetches cached favicons using the internal Chromium `chrome.runtime.getURL('/_favicon/')` protocol without leaking browsing history to third-party servers. |
| `bookmarks` | Optional | Requested on-demand only when the user explicitly triggers "Import from browser bookmarks". |
| `tabs` | Optional | Requested on-demand only when the user executes "Save current tabs into collection". |
| `tabGroups` | Optional | Requested on-demand only when opening a collection as a native Chromium colored tab group. |

---

## 3. Storage Architecture & Persistence Contract

To guarantee data integrity across rapid edits and abrupt tab closes, the dashboard implements a strict multi-tier persistence contract:

```
+-------------------------------------------------------------------------+
|                              In-Memory State                            |
|                 (core/state.js reactive observable store)               |
+------------------------------------+------------------------------------+
                                     |
              +----------------------+----------------------+
              |                                             |
              v (Debounced 300ms)                           v (Sync on Boot)
+-----------------------------+               +---------------------------+
|    chrome.storage.local     |               |       localStorage        |
|  [Authoritative Store]      |               |      [Boot Cache Only]    |
| - spaces, categories, items |               | - ntd_boot_theme          |
| - settings, widgets, layout |               | - ntd_boot_glass          |
+--------------+--------------+               +---------------------------+
               |
               v (Auto snapshots on migrate & mutations)
+-------------------------------------------------------------------------+
|                           IndexedDB Stores                              |
| 1. ntd_snapshots: Up to 10 rolling point-in-time state recovery copies. |
| 2. ntd_wallpapers: Downscaled blobs & thumbnails (max 1.5MB per image). |
+-------------------------------------------------------------------------+
```

### Persistence Guarantees
1. **Single Source of Truth:** `chrome.storage.local` is the sole authoritative store for all settings, spaces, and bookmarks.
2. **FOWT Elimination:** `localStorage` holds only immutable theme/glass tokens (`ntd:boot`) read synchronously by `js/boot.js` in `<head>` before CSS parsing to eliminate Flash of Wrong Theme.
3. **Emergency Unload Recovery:** Synchronous mirroring to `localStorage` under `dashboard:emergency_recovery` during `pagehide` prevents data loss when asynchronous operations are abruptly killed on tab closure. The slot is only cleared once primary storage confirms a successful write.
4. **Rollback & Disaster Recovery:** Every schema migration and major import automatically snapshots state into IndexedDB before applying changes. If corruption is detected on load, a recovery copy is preserved without overwriting storage. Snapshots are verified with FNV-1a checksums before restore.

---

## 4. Directory Structure (v0.3.0)

```text
├── .github/
│   └── workflows/
│       └── ci.yml               <- Automated Node 18, 20, 22 test matrix
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── TECHNICAL_ARCHITECTURE.md
│   ├── DESIGN_SYSTEM.md
│   ├── ROADMAP.md
│   └── ROADMAP_V2.md
├── tests/
│   ├── benchmark.test.js        <- 150, 1k, and 5k bookmark benchmarks
│   ├── launcher.test.js         <- App launcher & quick-launch tests
│   ├── useful_widgets.test.js   <- Timer, speed dial, quote widgets
│   ├── weather.test.js          <- Open-Meteo parsing & opt-in tests
│   └── ...                      <- 328 unit & integration tests
└── extension/                   <- Unpacked Chrome/Brave Extension Root
    ├── manifest.json
    ├── newtab.html
    ├── icons/                   <- Standard 16, 48, 128px icons
    ├── css/
    │   ├── tokens.css           <- Glass v2 CSS variables & themes
    │   ├── base.css             <- Two-stage scroll snap & typography
    │   └── components/
    │       ├── cards.css        <- Frosted glass collections & tabs
    │       ├── dialogs.css      <- Native dialog backdrops & modals
    │       ├── drawer.css       <- Two-column centered settings modal
    │       ├── launcher.css     <- Fullscreen app launcher modal
    │       └── toasts.css       <- Floating status & undo notifications
    └── js/
        ├── boot.js              <- Synchronous head script preventing FOWT
        ├── main.js              <- App bootstrapper & selective subscription router
        ├── core/
        │   ├── state.js         <- Observable state store with subscriber filtering
        │   ├── storage.js       <- chrome.storage.local adapter with debounce
        │   ├── schema.js        <- Schema v3 definitions & validators
        │   ├── migrate.js       <- v1 -> v2 -> v3 migration pipeline
        │   ├── snapshots.js     <- IndexedDB automated snapshot engine
        │   └── idb.js           <- IndexedDB wallpaper blob store
        ├── features/
        │   ├── spaces.js        <- Multi-space context isolation
        │   ├── tab-groups.js    <- Native Chrome/Brave tab group integration
        │   ├── dock.js          <- Floating frosted app dock with reordering
        │   ├── hero.js          <- Hero layout (Studio / Centered) & clock
        │   ├── search.js        <- Ranked search, calculator, engine shortcuts
        │   ├── weather.js       <- Opt-in Open-Meteo weather capsule
        │   ├── wallpaper.js     <- Bundled wallpapers & focal point engine
        │   ├── wallpaper-tuner.js <- Interactive glass & blur popover
        │   ├── widget-drag.js   <- Free-drag widget positioning & grid snapping
        │   ├── notes.js         <- Per-space isolated scratchpad
        │   ├── todo.js          <- Per-space isolated task list
        │   ├── timer.js         <- Focus / Pomodoro countdown timer
        │   ├── speeddial.js     <- Quick access tiles
        │   └── quote.js         <- Daily focus & inspirational quote
        ├── ui/
        │   ├── components.js    <- Safe DOM node builders (el, clearChildren)
        │   ├── dialogs.js       <- Bookmark / category edit dialogs
        │   ├── drawer.js        <- Settings drawer orchestrator
        │   ├── launcher.js      <- Application & folder launcher modal
        │   ├── favicons.js      <- Chromium _favicon resolver & letter fallback
        │   ├── icons.js         <- Static, trusted SVG icon library
        │   └── toasts.js        <- Accessible toast stack with undo actions
        └── utils/
            ├── dom.js           <- Safe DOM helpers
            └── url.js           <- Safe URL validator & normalizer
```

---

## 5. Data Model (Schema v3)

```typescript
interface DashboardDataV3 {
  version: 3;
  activeSpaceId: string;
  spaces: Array<{
    id: string;
    name: string;
    icon: string;
    categoryIds: string[];
    pinned: string[];
    note?: string;
    todos?: Array<{ id: string; text: string; done: boolean; createdAt: number }>;
  }>;
  categories: Array<{
    id: string;
    name: string;
    icon: string;
    order: number;
    color?: string;
    collapsed: boolean;
    displayMode?: "list" | "grid" | "icons";
    bookmarks: Array<{
      id: string;
      name: string;
      url: string;
      icon?: string;
      order: number;
      pinned?: boolean;
    }>;
  }>;
  settings: {
    page: "two-stage";
    theme: "system" | "light" | "dark";
    accent: string;
    glass: { opacity: number; blur: number };
    background: {
      type: "none" | "color" | "gradient" | "image";
      value: string | null;
      activeId: string | null;
      dim: number;
      blur: number;
      autoReadability: boolean;
      focal: { x: number; y: number };
      rotation: "off" | "tab" | "hourly" | "daily";
    };
    dock: {
      position: "top" | "bottom" | "left" | "right" | "off";
      autoHide: boolean;
      maxItems: number;
    };
    weather: {
      enabled: boolean;          // Strictly false by default (opt-in)
      city: string;
      lat: number | null;
      lon: number | null;
      unit: "c" | "f";
    };
    widgets: {
      notes: boolean;
      todo: boolean;
      timer: boolean;
      speeddial: boolean;
      quote: boolean;
    };
    hero: {
      layout: "studio" | "centered";
      widgets: Record<string, { x: number | null; y: number | null; w: number | null; h: number | null; hidden: boolean }>;
    };
    hub: {
      view: "columns" | "tabs";
    };
  };
}
```

---

## 6. Performance Architecture & Selective Rendering

To prevent full-page DOM re-renders during micro-interactions (e.g. typing a note, checking a todo, or reordering a dock item), `main.js` dispatches through **selective dirty checks**:

```javascript
store.subscribe((state) => {
  if (shouldRenderSettings(state.settings)) applySettings(state.settings);
  if (shouldRenderClock(state.settings))    renderClockAndGreeting(state.settings);
  if (shouldRenderSpaces(state))            renderSpaceSwitcher(spaceContainer);
  if (shouldRenderDock(state))              renderDock(dockContainer, state);
  if (shouldRenderNotes(state))             renderNotesWidget(notesContainer, state);
  if (shouldRenderTodo(state))              renderTodoWidget(todoContainer, state);
  if (shouldRenderTimer(state))             renderTimerWidget(timerContainer, state);
  if (shouldRenderSpeedDial(state))         renderSpeedDialWidget(speedDialContainer, state);
  if (shouldRenderQuote(state))             renderQuoteWidget(quoteContainer, state);
  if (shouldRenderHub(state))               renderHubCollections(state);
});
```

### Benchmark Budgets (Enforced in `tests/benchmark.test.js`)
- **Validation:** < 25ms for 150 bookmarks.
- **Migration:** < 25ms from v1 to v3.
- **1,000 Bookmarks Search:** < 15ms per multi-term query.
- **5,000 Bookmarks Search:** < 45ms per multi-term query.

---

## 7. Security Architecture & Formal Threat Model

### Security Boundaries
1. **Zero Remote Scripts:** No remote code execution or CDN scripts. `script-src 'self'`.
2. **CSP Justification for Inline Styles:**
   `style-src 'self' 'unsafe-inline'` is used exclusively for injecting computed CSS Custom Properties (`--glass-opacity`, `--glass-blur-px`, `--accent-color`, `--card-width`) directly on root and card elements for high-performance visual customization without network downloads.
3. **DOM Sinks & XSS Prevention:**
   - **User Input:** Bookmark titles, URLs, collection names, notes, and todo items are strictly inserted via `document.createElement()`, `element.textContent`, or `element.setAttribute()`.
   - **Internal SVGs:** Designated SVG icons are static compile-time string constants stored in `extension/js/ui/icons.js`. No untrusted or user-supplied variables ever enter an SVG template.
4. **URL Sanitation:**
   All bookmark URLs are verified through `normalizeAndValidateUrl()` in `utils/url.js`. Dangerous protocols (`javascript:`, `data:`, `vbscript:`, `file:`) are strictly stripped or rejected.
5. **Network Boundaries:**
   - Strictly zero network calls by default.
   - The only external network feature is opt-in weather via Open-Meteo. The CSP strictly restricts `connect-src` to:
     - `https://api.open-meteo.com`
     - `https://geocoding-api.open-meteo.com`
   - Responses are cached for 30 minutes in memory/storage to prevent redundant network traffic.
6. **Import Threat Boundary:**
   Netscape HTML and CSV bookmark parsers enforce a strict 5MB file cap, a 5,000 bookmark count cap, and length boundaries on titles and URLs to prevent memory exhaustion attacks.
