# Technical Architecture: New Tab Dashboard

## 1. Overview & Constraints

- **Platform:** Chromium Manifest V3 (Brave Browser & Google Chrome).
- **Core Principle:** Local-first, zero runtime npm dependencies, zero build step.
- **Language / Runtime:** Modern JavaScript ES Modules with JSDoc typing (`// @ts-check`).
- **Load Unpacked Target:** The `extension/` directory serves directly as the unpacked extension root.

---

## 2. Manifest V3 & Permissions

### `manifest.json` Structure
```json
{
  "manifest_version": 3,
  "name": "New Tab Dashboard",
  "version": "0.1.0",
  "description": "A clean, local-first customizable New Tab dashboard for Brave and Chrome.",
  "chrome_url_overrides": {
    "newtab": "newtab.html"
  },
  "permissions": [
    "storage",
    "favicon"
  ],
  "optional_permissions": [
    "bookmarks"
  ],
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

### Permission Justifications
| Permission | Justification |
|---|---|
| `storage` | Required for persisting dashboard settings, categories, and bookmark collections locally using `chrome.storage.local`. |
| `favicon` | Required to securely fetch cached website favicons using the internal Chromium `chrome.runtime.getURL('/_favicon/')` protocol without contacting third-party servers. |
| `bookmarks` *(optional)* | Only requested dynamically on-demand if the user explicitly triggers the "Import from browser bookmarks" feature; never requested at install time. |

---

## 3. Directory Structure

```text
├── .agents/
│   └── skills/
│       └── soft-browser-design/
│           └── SKILL.md
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── PRODUCT_SPEC.md
│   ├── TECHNICAL_ARCHITECTURE.md
│   └── DESIGN_SYSTEM.md
├── tests/
│   ├── models.test.js
│   ├── migrate.test.js
│   └── url.test.js
└── extension/                    <- Load Unpacked Root
    ├── manifest.json
    ├── newtab.html
    ├── icons/
    │   ├── icon-16.png
    │   ├── icon-48.png
    │   └── icon-128.png
    ├── css/
    │   ├── tokens.css
    │   ├── base.css
    │   └── components/
    │       ├── cards.css
    │       ├── search.css
    │       ├── clock.css
    │       ├── dialogs.css
    │       ├── drawer.css
    │       └── toasts.css
    └── js/
        ├── boot.js               <- Synchronous blocking script in <head> to eliminate FOWT
        ├── main.js               <- Application entry point (ES module)
        ├── core/
        │   ├── state.js          <- Reactive in-memory state store + event bus
        │   ├── storage.js        <- chrome.storage.local adapter with debounce & sync
        │   ├── schema.js         <- Schema validation & seed data
        │   ├── migrate.js        <- Migration pipeline runner
        │   └── idb.js            <- IndexedDB helper for image backgrounds
        ├── features/
        │   ├── categories.js
        │   ├── bookmarks.js
        │   ├── search.js
        │   ├── clock.js
        │   ├── theme.js
        │   ├── dnd.js
        │   └── data-io.js
        ├── ui/
        │   ├── components.js     <- Safe DOM builders (no unsafe innerHTML)
        │   ├── dialogs.js        <- Native <dialog> controllers
        │   ├── drawer.js         <- Settings drawer
        │   ├── toasts.js         <- Floating notifications & undo system
        │   └── favicons.js       <- Chromium _favicon resolver & letter fallback
        └── utils/
            ├── dom.js
            ├── url.js
            └── debounce.js
```

---

## 4. Data Model (Schema v1)

```typescript
interface DashboardData {
  version: 1;
  settings: {
    theme: "system" | "light" | "dark";
    accent: "slate" | "blue" | "emerald" | "amber" | "rose";
    layout: "grid" | "compact";
    showClock: boolean;
    showDate: boolean;
    showGreeting: boolean;
    timeFormat: "12h" | "24h";
    searchEngine: "google" | "brave" | "duckduckgo" | "bing";
    background: {
      type: "none" | "solid" | "gradient" | "image";
      value: string | null;       // Color hex, gradient rule, or IndexedDB image key
      dim: number;                // 0.0 to 0.8 opacity overlay
    };
  };
  categories: Category[];
}

interface Category {
  id: string;                     // UUID / crypto.randomUUID()
  name: string;
  icon: string;                   // Emoji or unicode icon
  description?: string;
  order: number;
  collapsed: boolean;
  bookmarks: Bookmark[];
}

interface Bookmark {
  id: string;                     // UUID
  name: string;
  url: string;                    // Normalized https:// URL
  order: number;
}
```

---

## 5. Storage, Sync & Eliminating Theme Flash (FOWT)

### 5.1 Flash of Wrong Theme (FOWT) Prevention
- **The Challenge:** `chrome.storage.local` is purely asynchronous. MV3 prohibits inline `<script>` tags in HTML. If the theme is read asynchronously, the browser defaults to light mode for ~50ms before flipping to dark mode, creating a jarring white flash.
- **The Architecture:**
  1. [`extension/js/boot.js`](file:///c:/Users/vihaa/OneDrive/Desktop/Brave%20Extension/extension/js/boot.js) is loaded as a **synchronous, blocking classic script** in the `<head>` of `newtab.html`:
     ```html
     <head>
       <meta charset="utf-8">
       <title>New Tab</title>
       <script src="js/boot.js"></script>
       <link rel="stylesheet" href="css/tokens.css">
       <link rel="stylesheet" href="css/base.css">
     </head>
     ```
  2. `boot.js` synchronously reads a tiny cache from `window.localStorage` under key `ntd:boot`:
     ```javascript
     // js/boot.js
     (function() {
       try {
         const raw = localStorage.getItem('ntd:boot');
         if (raw) {
           const { theme, accent, layout } = JSON.parse(raw);
           const root = document.documentElement;
           if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
             root.classList.add('dark');
           }
           if (accent) root.dataset.accent = accent;
           if (layout) root.dataset.layout = layout;
         }
       } catch (e) {
         // Graceful fallback to default CSS rules
       }
     })();
     ```
  3. Whenever settings are mutated in the app, the state manager updates both `chrome.storage.local` (the source of truth) and writes the mirrored subset to `localStorage.setItem('ntd:boot', ...)` for future new tab boots.

### 5.2 Multi-Tab Synchronization & Persistence
- Storage writes to `chrome.storage.local` are debounced by 300ms to avoid I/O bottlenecks during rapid drag-and-drop or typing.
- A listener on `window.addEventListener('pagehide', ...)` immediately flushes any pending debounced writes to disk.
- A listener on `chrome.storage.onChanged` detects mutations from other open tabs and updates in-memory state cleanly without causing input jitter.

---

## 6. Favicon Architecture

To ensure zero third-party data tracking and zero broken image icons:
1. **Primary Method:** Chromium internal favicon API:
   ```javascript
   function getFaviconUrl(pageUrl, size = 32) {
     const url = new URL(chrome.runtime.getURL('/_favicon/'));
     url.searchParams.set('pageUrl', pageUrl);
     url.searchParams.set('size', size.toString());
     return url.toString();
   }
   ```
2. **Deterministic Fallback:**
   - If the image fails to load (`img.onerror`), it is replaced with an accessible SVG or canvas-generated initials tile.
   - The tile background color is deterministically chosen from a hash of the hostname, with high contrast text.
   - Event listeners are attached programmatically (never inline `onerror="..."`).

---

## 7. Security & Sanitization

1. **Strict DOM Construction:**
   - Elements are constructed using `document.createElement()`, `setAttribute()`, and `textContent`.
   - `innerHTML` with unsanitized user strings is strictly banned to prevent Cross-Site Scripting (XSS).
2. **URL Validation & Normalization:**
   - Protocols are strictly limited to `http:` and `https:`.
   - Strings without protocols are automatically prepended with `https://`.
   - Dangerous schemes (`javascript:`, `data:`, `file:`, `blob:`, `vbscript:`) are rejected immediately with descriptive feedback.

---

## 8. Performance Budgets

- Initial page paint: `< 50ms`.
- Network requests during initial render: `0`.
- Memory footprint: `< 15MB`.
- Benchmark test dataset: 12 categories, 150 bookmarks rendering smoothly at 60fps.
