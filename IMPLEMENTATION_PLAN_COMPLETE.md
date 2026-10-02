# New Tab Dashboard — Complete Implementation Plan (for Google Antigravity)

A local-first, customizable New Tab extension for Brave and Chrome that turns the flat bookmark grid into a clean, categorized personal dashboard.

This document merges **everything in the original master prompt** with the **corrections and additions from the technical review**. Where the two disagreed, the corrected version is used and the change is listed in Appendix A.

Save it as `docs/IMPLEMENTATION_PLAN.md` in the workspace.

## Contents

| Part | What it covers |
|---|---|
| 1 | One-time setup (done by you) |
| 2 | Skills and tooling, including the custom `soft-browser-design` skill |
| 3 | Kickoff prompt, agent role, operating rules, development process, approval gates, first task |
| 4 | Product: concept, scope, non-goals, layout, cards, flows, settings, states |
| 5 | Technical: decisions, manifest, structure, data model, storage, favicons, security, performance |
| 6 | Design system: philosophy, visual language, colour, type, motion, anti-generic rules |
| 7 | Accessibility |
| 8 | Milestones and gates |
| 9 | Verification: agent protocol, acceptance test, design QC, Brave checklist |
| 10 | Definition of done, README text, GitHub description |
| A | Original vs corrected: what changed and why |
| B | Verified facts, sources, and what is still unverified |

---

# Part 1 — One-time setup (you, not the agent)

1. **Antigravity IDE → Settings → Customizations → Build with Google Plugins**: enable **Modern Web Guidance** (it includes the `chrome-extensions` skill) and **Chrome DevTools**.
   - If the IDE install errors (a checksum error was reported for IDE 2.17.0), run `npx modern-web-guidance@latest install --choose` inside the project and select `chrome-extensions` and `modern-web-guidance`.
2. **Add the Chrome DevTools MCP server**: Settings → Customizations → Add MCP server → search "Chrome DevTools" → Open MCP Config. Set the args to `-y`, `chrome-devtools-mcp@latest`, `--categoryExtensions`, `--autoConnect`. Close settings and restart the IDE.
3. **In Chrome (not Brave)**: open `chrome://inspect/#remote-debugging` and enable "Allow remote debugging for this browser instance". Re-allow it at the start of every browser session. Chrome shows an "automated test software" banner while it's active.
4. **Sanity check** in a scratch workspace: prompt "Create a hello world Chrome extension. Test using Chrome DevTools." Approve the remote-debugging dialog. If the agent can install and inspect it, setup is done.
5. **Skills location:** project skills live in `<workspace-root>/.agents/skills/<skill-name>/SKILL.md` (the older `.agent/skills` is still read). Global skills live in `~/.gemini/antigravity/skills/`.
6. **Publishing (later, optional):** when you're ready for the Chrome Web Store, add this line to `~/.gemini/GEMINI.md`: "Whenever you are creating or making changes to a Chrome extension, create and manage a CHROMEWEBSTORE.md file. You can use the chrome-extensions skill to learn about the format of this file." Skip it until then.

**Reality check:** the agent can drive and inspect **Chrome**. It cannot drive Brave this way. Brave is verified by you using the checklist in Part 9.

---

# Part 2 — Skills and tooling

## 2.1 What to install (and what is not a real install)

Don't install dozens of skills. Use a small, relevant stack.

| Item | Status | Purpose |
|---|---|---|
| **Modern Web Guidance** (Build with Google plugin) | Real, installable | Modern HTML/CSS/JS, performance, accessibility guidance; includes the **`chrome-extensions`** skill (MV3 APIs, permission justifications, store readiness) |
| **Chrome DevTools** (Build with Google plugin + MCP server) | Real, installable | Lets the agent install, reload, and inspect the extension in a running Chrome, and capture console, screenshots, audits |
| **`soft-browser-design`** | Project skill you create in M0 | Enforces this project's visual philosophy |
| Frontend design / UI design | Optional | Extra layout/hierarchy guidance; useful but the project skill takes precedence |
| Web accessibility | Optional | Keyboard, focus, contrast, semantics; **the audit gate is what proves it**, not the skill |
| Testing / browser testing | Covered by Chrome DevTools MCP + `node:test` | Test the real extension, not assumptions |
| Performance | Covered by Modern Web Guidance + DevTools traces | The New Tab must feel instant |
| Code review | Optional | Catch architectural and security problems before each gate |

The original list named generic skills (browser-extension, web-accessibility, testing, performance, code-review) as if each were a defined package. Only the two Google plugins above are verified as real; treat the others as optional extras if they exist in your skill registry.

**Caution:** Modern Web Guidance is an early preview. Independent testing of Antigravity with it found accessibility failures. So accessibility here is a **verifiable gate** (audit + keyboard walkthrough), never an assumption.

## 2.2 Workspace layout for skills

```text
.agents/
└── skills/
    ├── soft-browser-design/        <- created in Milestone 0
    │   └── SKILL.md
    ├── modern-web-guidance/        <- installed by the plugin or CLI
    ├── chrome-extensions/          <- installed with Modern Web Guidance
    └── (optional extras: frontend-design, web-accessibility, code-review)
```

Antigravity uses each skill's `description` to decide when to activate it, so every `SKILL.md` needs precise frontmatter (`name`, `description`) saying exactly when it applies.

## 2.3 The custom skill: `soft-browser-design`

Give the agent this instruction during Milestone 0:

```text
Create a project-specific skill called:

soft-browser-design

Location: .agents/skills/soft-browser-design/SKILL.md

Frontmatter description: "Use for ANY UI work in this project (layout, components,
styling, motion, theming, settings, dialogs). Enforces a calm, soft, precise,
browser-utility look and rejects generic AI-dashboard aesthetics."

Its purpose is to enforce the visual design philosophy of this project.
The skill must prevent generic AI-generated dashboard aesthetics.

It must enforce:
- restrained colour
- soft neutral surfaces
- subtle borders
- precise spacing
- excellent typography
- compact information density
- understated shadows
- minimal gradients
- minimal blur
- restrained corner radii
- subtle micro-interactions
- strong hierarchy
- desktop-first browser UX
- accessibility
- reduced-motion support

It must explicitly reject:
- generic SaaS dashboard aesthetics
- excessive glassmorphism
- neon gradients
- glowing UI
- giant cards
- oversized typography
- excessive pill controls
- decorative UI without function
- unnecessary illustrations
- excessive animations
- fake AI/productivity metrics

The skill must require visual inspection of the running application before UI
completion (screenshots at 1440/1280/1024/768, light and dark).

Write SKILL.md with clear decision rules and do/don't examples, derived from Part 6
of docs/IMPLEMENTATION_PLAN.md.
```

---

# Part 3 — Kickoff prompt and agent operating rules

## 3.1 Kickoff prompt (paste into Antigravity)

```text
You are the lead product engineer, frontend architect, UX designer, and
browser-extension engineer for the project described in docs/IMPLEMENTATION_PLAN.md.

Read Parts 3 to 9 of that file completely before doing anything.
Activate the chrome-extensions and modern-web-guidance skills.
Execute Milestone 0 only. Then stop and report using the gate format in Part 3.5.
Do not start Milestone 1 until I approve.

If you cannot verify something (for example, behaviour in Brave), say "not verified".
Never claim a feature works because the code compiles.
```

## 3.2 Role and mission

You are the lead product engineer, frontend architect, UX designer, and browser-extension engineer. We are building a **production-quality Chromium New Tab extension for Brave and Chrome**.

**Important:**
- Do NOT build a generic AI-looking dashboard.
- Do NOT produce a template-looking SaaS dashboard.
- Do NOT use excessive gradients, neon colours, glassmorphism everywhere, giant rounded cards, oversized typography, floating blobs, or decorative elements that do not improve usability.
- The product should feel like a carefully designed browser product made by a strong product-design team.

## 3.3 Development process (in order)

Do NOT immediately generate the entire application. First:

1. Inspect the workspace.
2. Determine available Antigravity skills.
3. Activate the relevant skills.
4. Create a concise product specification.
5. Create the technical architecture.
6. Create the data model.
7. Create the design system.
8. Create the extension skeleton.
9. Build the minimal working New Tab.
10. Test it in Chrome (Brave verification is manual, Part 9).
11. Then progressively implement features, milestone by milestone.

At every major stage: run the application, test the result, inspect it visually, fix issues, continue. Do not assume code works merely because it compiles.

## 3.4 First task

Do NOT start coding immediately. First inspect the available skills and workspace. Then create:

- `docs/PRODUCT_SPEC.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/DESIGN_SYSTEM.md`
- `.agents/skills/soft-browser-design/SKILL.md` (Part 2.3)

These define the product before implementation begins. After creating them, **stop**, show the proposed architecture and design direction, and **wait for approval** before implementing the main UI.

## 3.5 Approval gates (report format)

Before moving from one major phase to the next, show:

1. What you changed.
2. Files changed.
3. What was tested (and how: screenshots, console output, test results).
4. Any issues discovered, and anything **not verified**.
5. What you recommend doing next.

Do not silently make major architectural decisions. If you encounter ambiguity, choose the simplest architecture consistent with the requirements and explain the decision.

---

# Part 4 — Product

## 4.1 Concept

A customizable personal New Tab dashboard that replaces the browser's default New Tab page. Instead of a flat row of individual bookmarks, the user organizes websites into visual **collections/categories**. Each category is a compact, elegant card. The goal is for frequently visited sites to feel organized rather than cluttered.

Example collections:

```text
Entertainment: YouTube, Reddit, Spotify, Netflix, Twitch
Professional:  LinkedIn, GitHub, Gmail, WhatsApp, Calendar
College:       VTOP, College Email, Google Drive, Calendar
Development:   GitHub, Stack Overflow, AWS, npm, Docker
```

Nothing is hard-coded: categories are data, and these are only first-run seed examples.

## 4.2 Scope (all in scope)

1. Custom New Tab page
2. Categorized bookmark dashboard
3. Category creation / editing / deletion
4. Bookmark creation / editing / deletion
5. Drag-and-drop ordering
6. Category reordering
7. Bookmark reordering
8. Local persistence
9. Search engine / search box
10. Clock / date / greeting customization
11. Theme customization
12. Background customization
13. Layout customization
14. Import / export of dashboard data
15. Chrome / Brave extension integration
16. Proper loading / error / empty states
17. Accessibility
18. Keyboard navigation
19. Responsive desktop layouts
20. Settings / customization interface

## 4.3 Explicit non-goals (do not build)

The original referred to an undefined "Phase 4". Replaced by this explicit list:

- browsing analytics
- recommendations
- recently-visited intelligence
- AI suggestions
- automatic categorization
- cloud synchronization / cross-device sync
- productivity analytics
- browser history analysis
- external accounts
- unnecessary backend infrastructure

Keep the product **local-first**. No backend, no authentication, no database server, no Firebase, no Supabase, no API key. The extension must work completely offline except when the user intentionally navigates to a website or performs a web search.

**Optional stretch (only after Milestone 7 is approved):** "Import from browser bookmarks" using `chrome.bookmarks`. Request the `bookmarks` permission as an **optional permission at the moment the user clicks Import**, never at install. Keep dashboard data separate from browser bookmarks:

```text
Browser bookmarks
       │  optional one-way import
       ▼
Your Dashboard  →  your own categories
```

The extension is not a replacement for the browser's bookmark system.

## 4.4 Default dashboard layout (concept only — do NOT copy literally)

```text
                         11:40

                    Good evening

                 Thursday, October 1

              ┌───────────────────────┐
              │ Search the web...     │
              └───────────────────────┘


     ┌──────────────────┐    ┌──────────────────┐
     │ Entertainment    │    │ Professional     │
     │                  │    │                  │
     │ YouTube          │    │ LinkedIn         │
     │ Reddit           │    │ GitHub           │
     │ Spotify          │    │ Gmail            │
     │ Netflix          │    │ WhatsApp         │
     │                  │    │                  │
     │ + Add            │    │ + Add            │
     └──────────────────┘    └──────────────────┘

     ┌──────────────────┐    ┌──────────────────┐
     │ College          │    │ Development      │
     │ VTOP             │    │ GitHub           │
     │ Calendar         │    │ Stack Overflow   │
     │ Drive            │    │ AWS              │
     │ + Add            │    │ + Add            │
     └──────────────────┘    └──────────────────┘
```

The real design must be more refined than this ASCII. Use the concept, but design the actual UI professionally. Cards must not look like generic Bootstrap cards. They should have: subtle surface differentiation, excellent internal spacing, clear hierarchy, compact bookmark rows, restrained hover states, a small but legible favicon/icon, a category title, optional category description, optional item count, and contextual controls that appear only when necessary.

**Visual direction I'd aim for (quieter than the box version):**

```text
                         11:40 PM
                    Thursday, Oct 1

                 Search anything...


    Entertainment                    Professional
    ─────────────                    ─────────────

    ◉ YouTube                        ◉ LinkedIn
    ◉ Reddit                         ◉ GitHub
    ◉ Spotify                        ◉ Gmail
    ◉ Netflix                        ◉ WhatsApp

    + Add                            + Add
```

Very little visual noise. The category provides structure, the favicon provides recognition, typography provides hierarchy, spacing provides separation, interaction provides feedback. You don't need 15 visual effects to feel premium.

## 4.5 Bookmark presentation

Bookmarks are lightweight. A bookmark shows a **favicon** and a **name**, optionally the **domain**:

```text
[YouTube icon] YouTube
               youtube.com
```

Avoid unnecessary metadata. Do not make every bookmark a giant card. Within a collection, bookmarks behave like a compact list.

## 4.6 Category cards

Categories are the primary organizational unit. Each supports: rename, icon, reorder, delete, collapse, expand, add bookmark, edit bookmarks.

Controls remain hidden until interaction where appropriate (hover, focus, or an overflow menu). Never permanently display five buttons on every card; use contextual controls.

## 4.7 Add Category

Opens a small focused interface. Fields: **Name** (e.g. "Entertainment") and **Icon** (e.g. 🎬). Don't overwhelm the user with configuration.

## 4.8 Add Bookmark

Fields: **Name**, **URL**, **Category**. Automatically derive the favicon where possible. If retrieval fails, use a deterministic fallback icon. Never show broken image icons. (Technical details in 5.6.)

## 4.9 Search

One primary search field. Visually important, but not dominant. Selectable engine: **Google, Brave Search, Bing, DuckDuckGo**. Store the choice locally. Search submits via normal browser navigation; no custom search backend. (Technical details in 5.9.)

## 4.10 Clock, date, greeting

All optional. Settings: Show clock, Show date, Show greeting, 12-hour / 24-hour format. The clock must not dominate the page and must not be the largest element. The user's bookmarks are the primary purpose of the page.

## 4.11 Personalization: settings / customization drawer

A real-product settings interface, grouped into sections (not one giant screen):

**Appearance · Layout · Clock · Search · Categories · Data**

- **Appearance:** Theme (Light / Dark / System), accent colour (subtle selector), background.
- **Layout:** Grid / Compact.
- **Clock:** show clock, show date, show greeting, 12h/24h.
- **Search:** default engine.
- **Categories:** a management list (rename, reorder, delete, default collapsed state). In-place editing on the dashboard remains the primary way to edit.
- **Data:** export, import, reset.

Prefer a **side drawer or polished modal** over navigating away from the dashboard. It should feel lightweight and reversible.

```text
                 ┌────────────────────────────┐
                 │ Customize                  │
                 │                            │
                 │ Appearance                 │
                 │                            │
                 │ Theme                      │
                 │ ○ Light                    │
                 │ ● Dark                     │
                 │ ○ System                   │
                 │                            │
                 │ Accent                     │
                 │ [ subtle color selector ]  │
                 │                            │
                 │ Layout                     │
                 └────────────────────────────┘
```

## 4.12 Layout options

At least **Grid** (two or more category cards per row depending on viewport) and **Compact** (categories become more space-efficient). Responsive. Use max-width containers so cards never become ridiculously wide.

## 4.13 Background options

**No background · Solid · Gradient · Custom image.** The background stays subordinate to content. For images: provide overlay controls, maintain readable contrast, avoid excessive blur, avoid hiding content.

## 4.14 Empty state

If no categories exist, show a beautiful but minimal empty state:

> Your dashboard is empty.
> Create your first collection to get started.
> **[ + Create collection ]**

No giant illustration.

## 4.15 Error states

Errors must be understandable. Examples: "Invalid URL", "Unable to save bookmark", "Import file is invalid". Use small contextual messages. Avoid browser-style `alert()` unless absolutely necessary. Prefer inline feedback or lightweight toasts.

## 4.16 Toasts

Subtle notifications that don't dominate the UI. Examples: "Bookmark added", "Category deleted", "Settings saved", "Dashboard exported".

## 4.17 Delete confirmation

Don't confirm every tiny action. For destructive actions with meaningful data loss, show a compact confirmation. Prefer **undo** where practical:

> Category deleted. **[Undo]**

---

# Part 5 — Technical

## 5.1 Fixed decisions (don't re-litigate without asking)

- **Manifest V3**, `chrome_url_overrides.newtab` to replace the New Tab page.
- `chrome.storage.local` for application state.
- Use Chrome Extension APIs **only when genuinely necessary**.
- **Stack:** plain JavaScript ES modules with `// @ts-check` and JSDoc types. No bundler, no framework, no runtime npm dependencies. (The original offered "HTML/CSS/JS/TypeScript" and "a framework only if it materially improves maintainability"; TypeScript requires a build step, which conflicts with the no-bundler goal, so JSDoc type checking is used instead.) Dev-only tooling (lint, tests) is allowed and must not ship. Do NOT introduce React/Next.js/Vite/etc. because they are fashionable. The extension stays lightweight and fast.
- **MV3 page rules:** no inline `<script>`, no inline event handlers (`onclick=` etc.), no remote code, no CDN, no web fonts. System font stack only.
- Dialogs: native `<dialog>`; follow Modern Web Guidance for popovers/menus.

## 5.2 Manifest and permissions

```jsonc
{
  "manifest_version": 3,
  "name": "…",
  "version": "0.1.0",
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "permissions": ["storage", "favicon"]
}
```

- Least privilege. Do **not** request `tabs`, `history`, `cookies`, `webRequest`, `scripting`, or any host permissions unless a specific feature truly requires it.
- Never inject scripts into arbitrary websites to implement dashboard functionality.
- `bookmarks` only as an *optional* permission for the stretch feature (4.3).
- Include a `<title>` in `newtab.html`.
- Each permission gets a one-line justification in `docs/TECHNICAL_ARCHITECTURE.md`.

## 5.3 Repository layout

The original structure placed `manifest.json` in a separate `extension/` folder from `src/`, which can't be loaded unpacked as-is (the manifest must sit at the root of the loaded folder). Corrected:

```text
docs/                      PRODUCT_SPEC.md, TECHNICAL_ARCHITECTURE.md, DESIGN_SYSTEM.md, this plan
tests/                     node:test unit tests for pure modules
.agents/skills/            soft-browser-design/SKILL.md
extension/                 <- the "Load unpacked" root; everything the browser needs
  manifest.json
  newtab.html
  css/                     tokens.css, base.css, components/
  js/boot.js               tiny blocking theme script (5.5)
  js/core/                 storage/, state/, models/ (schema: validate + migrate), ids
  js/features/             categories/, bookmarks/, search/, theme/, clock/, dnd/, data-io/
  js/ui/                   components/, dialogs/, cards/, settings/, toasts/
  js/utils/
  js/main.js
  icons/
```

Adapt if a simpler architecture is more appropriate. Do not over-engineer.

## 5.4 Data model (versioned, data-driven)

```jsonc
{
  "version": 1,
  "settings": {
    "theme": "system",            // "light" | "dark" | "system"
    "accent": "slate",
    "layout": "grid",             // "grid" | "compact"
    "showClock": true,
    "showDate": true,
    "showGreeting": true,
    "timeFormat": "12h",          // "12h" | "24h"
    "searchEngine": "google",     // "google" | "brave" | "bing" | "duckduckgo"
    "background": { "type": "none", "value": null, "dim": 0.35 }
                                  // type: "none" | "solid" | "gradient" | "image"
                                  // image blobs live in IndexedDB, referenced by key
  },
  "categories": [
    {
      "id": "…",
      "name": "Entertainment",
      "icon": "🎬",
      "description": "",          // optional
      "order": 0,
      "collapsed": false,
      "bookmarks": [
        { "id": "…", "name": "YouTube", "url": "https://youtube.com", "order": 0 }
      ]
    }
  ]
}
```

Everything is data-driven; the UI must not be built around specific categories.

## 5.5 State, storage, and no flash of wrong theme

- One versioned document under a single key (e.g. `dashboard`) in `chrome.storage.local`.
- A `migrate(doc)` runner from day one, even with only v1.
- Debounce writes (~300 ms) and flush on `pagehide`.
- Listen to `chrome.storage.onChanged` so multiple open new tabs stay in sync.
- No global mutable state sprawl; state changes go through the state module.

`chrome.storage` is async and MV3 forbids inline scripts, so the first paint could use the wrong theme. Fix:
- `js/boot.js` is a tiny **classic (non-module), blocking** script in `<head>`.
- It synchronously reads a small cache from `localStorage` (e.g. key `ntd:boot` holding theme, accent, layout, background colour) and sets attributes on `<html>`.
- The cache is rewritten whenever settings change. `chrome.storage` stays the source of truth.
- Wrap everything in try/catch; the page must render correctly if the cache is empty.

## 5.6 Favicons (no fragile remote services)

1. **Primary:** the extension's own favicon endpoint, built with `chrome.runtime.getURL('/_favicon/')` plus `pageUrl` and `size` query params. Requires the `favicon` permission. It serves the browser's cached favicons, so expect misses for sites never visited.
2. **Fallback:** a deterministic letter tile (initial plus a colour derived from a hash of the domain). Never a broken image. Attach the `error` listener with `addEventListener`, not an inline handler.
3. Do **not** call Google's favicon service or any other remote service by default (it would leak the user's site list). The UI must remain fully usable when favicon retrieval fails. Do not request broad host permissions.

## 5.7 Background images

Store as Blobs in **IndexedDB**, never in `chrome.storage` (small quota). Downscale on import (max ~2560 px, re-encode to WebP/JPEG). Provide a dim/overlay control and keep text contrast readable. Exports exclude the image by default (offer an opt-in). Avoid huge background images.

## 5.8 Rendering safety

- Build DOM with `createElement` and `textContent`. Never `innerHTML` with user data.
- URL validation: accept only `http:` and `https:`. Auto-prefix `https://` to bare domains. Reject `javascript:`, `data:`, `file:`, and everything else. Apply the same rule on import.

## 5.9 Search

A plain `<form method="get">` to the selected engine, so navigation is normal and needs no permissions:

| Engine | Query URL |
|---|---|
| Google | `https://www.google.com/search?q=` |
| Brave Search | `https://search.brave.com/search?q=` |
| Bing | `https://www.bing.com/search?q=` |
| DuckDuckGo | `https://duckduckgo.com/?q=` |

**Do not promise autofocus.** Chrome has historically kept focus in the omnibox on extension new-tab pages. Add a `/` shortcut that focuses the search box once the page has focus. Test what happens on Ctrl+T and document it; don't fight the omnibox.

## 5.10 Drag and drop

Users can reorder categories, reorder bookmarks, and move bookmarks between categories. Use native HTML5 DnD for the mouse, with:
- a clear but subtle dragging indication; the page must not jump while dragging;
- respect for `prefers-reduced-motion`;
- a **required keyboard alternative**: an item menu with "Move up / Move down / Move to category…", with results announced via an `aria-live` region (native DnD is mouse-only).

Use a custom pointer-based implementation only if native DnD proves inadequate.

## 5.11 Import / export

- **Export:** "Export Dashboard" downloads a JSON backup (Blob + `<a download>`; no `downloads` permission needed).
- **Import:** validate before writing to storage. Handle: invalid JSON, missing fields, invalid URLs, duplicate IDs, old schema versions (run `migrate`). Never blindly trust imported data. Show a summary preview before overwriting and offer undo.

## 5.12 Performance (extremely important)

The page should feel almost instantaneous; the browser should feel faster with this extension, not slower.

- Avoid: large JS bundles, unnecessary dependencies, blocking network requests, synchronous network/database operations, huge background images, unnecessary API calls.
- Load local UI immediately; render stored data quickly; defer non-critical work (favicon loading, clock ticking setup, drawer code) until after first paint.
- **No network operations during initial render.**
- Benchmark with a fixture of 12 categories and 150 bookmarks.

## 5.13 Security and privacy

- Least privilege (5.2). Never send user bookmark data to external servers.
- No telemetry. No tracking. No analytics by default.
- No remote code. Safe DOM rendering (5.8).

## 5.14 Browser compatibility

Primary: **Brave and Chrome**. Use Chromium-compatible Manifest V3 APIs only; do not rely on Firefox-only APIs. If a browser-specific difference exists, isolate it behind a small abstraction. Note: only one extension can override the new tab page at a time; document this in the README.

## 5.15 Code quality

Write production-quality code. Avoid: duplicated logic, giant functions, global mutable state, magic constants, inline event-handler spaghetti, unnecessary dependencies, dead code. Use clear names. Keep modules focused. Comment only where the reasoning is non-obvious. Don't over-engineer.

---

# Part 6 — Design system

## 6.1 Philosophy

The design goal is **SOFT · CLEAN · QUIET · PRECISE · FAST · PERSONAL · SPACIOUS · UNCLUTTERED**.

Think "premium browser utility". NOT: "AI SaaS dashboard", "Dribbble concept", "gaming dashboard", "crypto dashboard", "glassmorphism template". It should feel like something that could ship inside a polished browser. Soft without becoming blurry.

## 6.2 Visual language

**Prefer:** subtle surfaces, soft shadows, low-contrast borders, restrained corner radii, careful spacing, excellent typography, muted colours, subtle hover transitions, natural motion, strong alignment, generous whitespace.

**Avoid:** neon gradients, glowing borders, excessive blur, floating glass cards everywhere, huge pill buttons, excessive rounded rectangles, cartoonish icons, unnecessary illustrations, excessive animations, visual noise, rainbow colour palettes.

## 6.3 Colour system

- Neutral foundation. **Dark** = near-black / charcoal / deep slate, not pure `#000000`. **Light** = warm white / soft grey, not pure white everywhere.
- Accent colours are used sparingly and communicate **interaction, selection, focus, active state** only. Do not make every category a different bright colour.
- Theme modes: **Light, Dark, System** (`prefers-color-scheme`).
- Starting values (refine after visual inspection): dark base ≈ `#16181b`; light base ≈ `#f6f5f3`; borders ≈ 8% alpha.

## 6.4 Typography

A major part of the design. Clean modern system stack: `Inter` (only if installed locally), `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, sans-serif. Restrained type scale (≈ 12 / 13 / 14 / 16 / 20). No enormous headings; the clock is capped around 44 px. The page should feel information-dense but breathable.

## 6.5 Spacing, radii, shadows

Spacing scale 4 / 8 / 12 / 16 / 24 / 32. Radii ≈ 10 px for cards, ≈ 6 px for controls. Shadows subtle and rare. Max-width containers; consistent spacing; check **1440, 1280, 1024, 768** px widths. Primary target is desktop Chromium.

## 6.6 Interaction states

Design each explicitly: **normal, hover, active, selected, editing, dragging, disabled** — plus **focus-visible, empty, error**.

## 6.7 Motion and microinteractions

- Use motion to explain interaction: bookmark hover, card hover, drawer opening, modal opening, dragging, saving, deleting.
- Hover transitions **150–220 ms**, e.g. `transform: translateY(-1px)` or subtle surface/border changes.
- Avoid: bounce, elastic, large scaling, continuous floating animations, exaggerated animation.
- Respect `prefers-reduced-motion` everywhere.

## 6.8 Anti-generic-AI rule (extremely important)

If the design starts looking like an "AI generated dashboard": **STOP**. Specifically avoid: purple/blue gradients everywhere, giant glowing hero sections, oversized cards, excessive glassmorphism, floating blobs, excessive pill-shaped controls, huge rounded corners, excessive shadows, decorative statistics, fake analytics, meaningless icons, meaningless labels, unnecessary "AI" terminology, excessive empty space, excessive animation.

The product is a browser utility. It should feel calm, useful, and intentional.

## 6.9 Design references

Use the principles of high-quality modern desktop software: excellent spacing, restrained colour, clear hierarchy, subtle borders, quiet surfaces, useful motion, strong typography, keyboard accessibility. Do NOT clone any existing browser's UI. Do NOT copy Chrome's or Brave's New Tab page. Create an original visual language.

---

# Part 7 — Accessibility (mandatory)

- Semantic HTML. Buttons are actual `<button>`s; links are actual `<a>`s; no `<div>` pretending to be a button. Every input has a label.
- Keyboard navigation for everything, including reordering (5.10). Visible focus states. Dialog focus trap and focus return.
- Screen-reader support (landmarks, names, `aria-live` for toasts and reorder announcements).
- Reduced motion. Sufficient contrast in both themes and over every background type.
- Follow modern browser accessibility practice. Proven by the audit and keyboard walkthrough in Part 9, not assumed.

---

# Part 8 — Milestones and gates

At the end of every milestone, **stop** and report in the gate format (3.5). Anything you couldn't verify is listed as "not verified".

**M0 — Define (no extension code).** Create `PRODUCT_SPEC.md`, `TECHNICAL_ARCHITECTURE.md` (data model, module boundaries, permissions with justifications), `DESIGN_SYSTEM.md` (tokens, components, states), and the `soft-browser-design` skill (2.3). Show the proposed architecture and design direction. **Wait for approval.**

**M1 — Skeleton.** `manifest.json`, `newtab.html`, tokens/base CSS, `boot.js`, storage + schema + `migrate`, first-run seed, read-only render of seeded categories. *Accept:* loads unpacked in Chrome; Ctrl+T shows the page; data survives reload; no console or CSP errors; no flash of the wrong theme.

**M2 — Core CRUD.** Category and bookmark add/edit/delete with `<dialog>`s, inline validation and errors, favicon tiers, collapse/expand, empty state, undo toasts. *Accept:* every flow works by mouse and keyboard; invalid URLs are rejected with a clear message.

**M3 — Reordering.** Drag-and-drop for categories, bookmarks, and cross-category moves, plus the keyboard alternative. *Accept:* no layout jump while dragging; order persists; keyboard-only reordering works and is announced.

**M4 — Search, clock, settings drawer.** Engine picker, search form, `/` shortcut, clock/date/greeting with toggles and 12h/24h, drawer with sections Appearance, Layout, Clock, Search, Categories, Data.

**M5 — Appearance depth.** Theme (Light/Dark/System), accent, Grid/Compact layouts, backgrounds (none, solid, gradient, image in IndexedDB with overlay). *Accept:* readable contrast in both themes with every background type.

**M6 — Import/export.** JSON export; import with full validation (5.11); preview before overwrite; undo. Unit tests (`node:test`) for validate, migrate, URL normalization, and reorder logic.

**M7 — Hardening.** Accessibility audit, performance check, permissions audit (only `storage` and `favicon`), README, Brave checklist. Optionally prepare store metadata. Stretch: bookmarks import (4.3).

---

# Part 9 — Verification

## 9.1 Agent protocol (Chrome, via Chrome DevTools MCP)

- Install the unpacked `extension/` folder, open a new tab, take screenshots at 1440 / 1280 / 1024 / 768 in light and dark.
- Check the console for errors on every screen. Run a Lighthouse accessibility audit and a performance trace with the 12-category / 150-bookmark fixture.
- Keyboard walkthrough: every control reachable, visible focus, dialog focus trap and return, reorder without a mouse. Verify `prefers-reduced-motion`.
- Do not use `--load-extension` with branded Chrome (removed in v137). Use the DevTools MCP install, or Chrome for Testing / Chromium for scripts.
- Treat Modern Web Guidance output as a starting point, not proof.

## 9.2 Acceptance test (end-to-end)

```text
Load unpacked extension
→ Ctrl + T
→ Dashboard appears
→ Add category
→ Add bookmark
→ Edit bookmark
→ Drag bookmark (and reorder with the keyboard)
→ Open bookmark
→ Open settings
→ Change theme
→ Change layout
→ Reload → data remains
→ Export
→ Delete data
→ Import → data restored
```

## 9.3 Design quality control (before any UI is called complete)

Don't judge the interface from source code alone. Run the extension, open the New Tab, and actually interact with: adding a category, adding a bookmark, editing a bookmark, deleting a bookmark, reordering, opening a bookmark, opening settings, changing theme, changing layout, importing, exporting.

Look for: misalignment, excessive whitespace, crowded areas, inconsistent spacing, bad typography, poor contrast, awkward hover states, unnecessary visual elements, broken responsive behaviour. Fix these before declaring completion.

## 9.4 Brave checklist (you, manual — at M1 and M7 at minimum)

- [ ] Load unpacked from `brave://extensions` (Developer mode on).
- [ ] Ctrl+T shows the dashboard. If not, check Brave's own new-tab setting and any other extension overriding the new tab (only one can win).
- [ ] Favicons appear for sites you've visited; letter tiles for the rest.
- [ ] Add, drag, reload, export, import all work.
- [ ] Theme "System" follows the OS; no wrong-theme flash on open.
- [ ] Note anything that differs from Chrome and report it at the gate.

---

# Part 10 — Definition of done, README text, GitHub description

**Done when:** all milestones approved; permissions are only `storage` and `favicon` (plus optional `bookmarks` if the stretch is built); no network activity on load; no telemetry; unit tests pass; accessibility audit clean; Brave checklist ticked; README covers install, data location, export/import, and the one-new-tab-extension limitation.

**README / project description:**

> A local-first, customizable New Tab extension for Chromium browsers that transforms the traditional bookmark grid into a clean, categorized personal dashboard. Users can organize websites into customizable collections, rearrange them through drag-and-drop, personalize their layout, theme, clock, search engine and background, and export or restore their dashboard data. Built with Manifest V3 and designed around speed, privacy, accessibility and a quiet, polished desktop experience.

**Short GitHub description:**

> A clean, local-first customizable New Tab dashboard for Brave and Chrome — organize bookmarks into beautiful collections instead of cluttered bookmark grids.

---

# Appendix A — Original vs corrected

| Topic | Original | Corrected | Why |
|---|---|---|---|
| Skills | Table of generic skill names | Two verified Google plugins + one project skill; others optional | Only the plugins are verified installable |
| Testing | "Open Brave → Ctrl+T" by the agent | Chrome DevTools MCP (`--categoryExtensions`, `--autoConnect`) in Chrome; manual Brave checklist | The agent can't drive Brave this way |
| Loading in automation | Not addressed | No `--load-extension` on branded Chrome ≥137 | Flag removed |
| Accessibility | Stated as mandatory | Mandatory **and** gated by audit + keyboard walkthrough | Modern Web Guidance output was found lacking in independent tests |
| Favicons | "Derive automatically; avoid fragile services" | `favicon` permission + `_favicon` endpoint, letter-tile fallback, no third-party service | Gives a concrete MV3 method; avoids leaking site list |
| Backgrounds | Unspecified storage | IndexedDB Blobs, downscaled | `chrome.storage` quota is small |
| Theme flash | Not addressed | Blocking external `boot.js` reading a mirrored cache | Async storage + no inline scripts |
| Search focus | (implicit autofocus) | `/` shortcut; test Ctrl+T behaviour | Omnibox historically keeps focus |
| Language | HTML/CSS/JS/TypeScript, "framework only if it helps" | Plain JS modules + JSDoc `@ts-check`, no build | TypeScript needs a build step |
| Layout of repo | `extension/manifest.json` apart from `src/` | One `extension/` load-unpacked root | Manifest must be at the loaded root |
| "Phase 4" | Referenced, undefined | Explicit non-goals list | The agent can't know what Phase 4 is |
| Drag and drop | Mouse DnD | Plus mandatory keyboard alternative | Native DnD is mouse-only |
| Imports | Validate | Plus http/https-only URLs, safe DOM rendering | Prevent `javascript:` URLs and XSS |
| Bookmarks API | "Optionally use `chrome.bookmarks`" | Optional permission requested at import time, stretch milestone | Keeps install-time permissions minimal |
| Settings sections | Appearance, Layout, Clock, Search, Categories, Data | Kept all six; Categories is a management list, in-place editing primary | Avoids duplicated editing UIs |
| Process | 10-step list + approval gates | Kept, mapped onto milestones M0–M7 with acceptance criteria | Makes each gate checkable |

---

# Appendix B — Verified facts, sources, and what's unverified

**Verified against current docs:**
- Workspace skills path `<workspace-root>/.agents/skills/` and global paths — atamel.dev "Where does Antigravity look for Agent Skills?" and the Antigravity skills codelab.
- Modern Web Guidance install path, the extensions skill, Chrome DevTools MCP flags, per-session remote debugging, `CHROMEWEBSTORE.md` workflow — developer.chrome.com/docs/extensions/ai/build-with-ai and /docs/modern-web-guidance/get-started.
- `favicon` permission and `_favicon/` URL — developer.chrome.com/docs/extensions/how-to/ui/favicons (the endpoint serves cached favicons per wxt.dev's guide).
- `--load-extension` removal in Chrome 137 branded builds — Chromium extensions group PSA.
- Plugin install checksum error in IDE 2.17.0 — GoogleChrome/modern-web-guidance-src issue #1512.
- Independent accessibility critique of Modern Web Guidance output — adrianroselli.com.
- Only one extension can override the new tab page; omnibox focus limitation — Kushagra Gour's write-up and the "Chrome 27" focus issue write-up. The focus behaviour is old evidence, so the plan says to test it.

**Still unverified (test, don't assume):**
- `_favicon` behaviour inside Brave.
- Brave's own new-tab settings interacting with an extension override.
- Exact Antigravity UI labels, which may shift between versions.
- `chrome.storage.local` default quota (about 10 MB in current Chrome) — confirm in the agent's architecture doc.
