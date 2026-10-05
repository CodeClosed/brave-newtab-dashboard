# New Tab Dashboard — Unified Roadmap (for Google Antigravity)

> **Status:** Phases 0–7 shipped as v0.2.0. The v0.3 UI overhaul (Phases 8–16: two-stage glass dashboard, dock, tab groups, weather) continues in `docs/ROADMAP_V2.md`. Its approved decisions replace the "Deferred" entries below for weather and tab groups, and the visual rules now follow the Glass v2 design skill.

This merges three things into one plan for the existing repo (`CodeClosed/brave-newtab-dashboard`, v0.1.0):

1. The bug and accessibility fixes found in the code review.
2. The quality-of-life (QoL) feature list.
3. The UI/UX and personalization list (backgrounds, cards, themes, and so on).

Save as `docs/ROADMAP.md`. It extends, and does not replace, `docs/IMPLEMENTATION_PLAN.md` and `.agents/skills/soft-browser-design/SKILL.md`. Where they conflict on process, this file wins; on visual rules, the design skill wins.

---

## Part 1 — Kickoff prompt (paste into Antigravity)

```text
You are the lead engineer and designer on this repo. Read, in order: docs/ROADMAP.md (this plan),
docs/IMPLEMENTATION_PLAN.md, docs/TECHNICAL_ARCHITECTURE.md, docs/DESIGN_SYSTEM.md and
.agents/skills/soft-browser-design/SKILL.md. Activate the chrome-extensions and soft-browser-design skills.

Execute ONE phase at a time, starting with Phase 0. After each phase, stop and report using the gate
format in Part 3 and wait for my approval. Never start the next phase on your own.

For every feature: write the unit tests for the pure logic first, implement, then verify in a running
Chrome through the Chrome DevTools MCP. If you cannot verify something (especially in Brave), say
"not verified". Passing tests alone never proves a UI feature works.
```

Setup (Chrome DevTools MCP with `--categoryExtensions --autoConnect`, remote debugging allowed in Chrome) is unchanged from `docs/IMPLEMENTATION_PLAN.md` Part 1.

---

## Part 2 — Ground rules

**Calm by default.** The default page must look like today's page. Every new feature is either invisible until used or controlled by a setting. The defaults table is in Part 4.

**Permissions budget.** Stay at `storage` + `favicon` (+ optional `bookmarks`). No `tabs`, `history`, `tabGroups`, `alarms`, or host permissions in this roadmap. Anything that would need one is listed under "Deferred" and stays out.

**Performance budget** (measure with the 12-category / 150-bookmark fixture, plus an image wallpaper):
- No network requests on load.
- No long task over 50 ms during first render.
- Unminified JS under 250 KB total. Lazy-load rarely used code with dynamic `import()` (settings drawer, import parsers, colour analysis, snapshot UI, first-run tour).

**Security rules that stay in force:** no `innerHTML`, no `eval` or `new Function` (the search calculator must use a hand-written parser), no remote code or assets, http/https URLs only, DOM built with `el()`/`textContent`.

**Accessibility rules that stay in force:** semantic elements, visible focus, keyboard parity for every mouse action, `prefers-reduced-motion` honoured, contrast checked in every theme.

**Process rules:** one commit per feature; tests ship with the feature; no unrelated refactors; update `docs/` and the README when behaviour changes.

---

## Part 3 — Gate format and verification

At the end of each phase report: (1) what changed, (2) files changed, (3) how it was verified, with screenshots, (4) issues, including anything **not verified**, (5) recommendation for the next phase.

**Verification protocol (every phase):**
- Chrome via DevTools MCP: load unpacked `extension/`, screenshots at 1440 / 1280 / 1024 / 768 in light and dark (and in each new theme once it exists), console free of errors, reload persistence.
- `npm test` green. Lighthouse accessibility audit and a keyboard-only walkthrough of the new feature.
- Re-run the performance fixture and compare with the budget.
- **Brave (manual, done by me):** at the end of Phases 0, 4, 5 and 7. Provide a short checklist for the phase when you hand over.

---

## Part 4 — Decisions already made (don't re-litigate)

| Topic | Decision |
|---|---|
| Spaces (separate dashboards) | Implement as `spaces[]` plus a `spaceId` on each category (small blast radius), not by nesting categories inside spaces |
| Themes | Keep `theme` as `system / light / dark`; add a separate `palette`: `default / amoled / paper / contrast` |
| Right-click on bookmarks | Keep the browser's native context menu on links (open in new tab, copy link). Custom actions live in a `⋯` menu and the keyboard (Shift+F10 / ContextMenu key) |
| Sorting a collection | A one-shot "Sort A–Z" action with undo, not a persistent sort mode, so manual order is never lost |
| Edit mode | Adds persistent handles, multi-select and inline editing. It does NOT remove keyboard access: row controls stay reachable on hover and focus-within in normal mode |
| Keyboard shortcuts | Avoid browser-reserved combos (Ctrl/Alt+digit, Ctrl+K). Use plain keys that only fire when no input is focused |
| Pomodoro | Dropped: a timer needs a background worker and extra permissions, and dies when the tab navigates |
| Gradients | Stored as structured data `{from, to, angle}`, never raw CSS strings |
| Network features | Weather, search suggestions, link checker, wallpaper downloads: Deferred |

**Defaults for new features**

| Feature | Default |
|---|---|
| Bookmark filtering in the search box | On |
| Automatic snapshots | On |
| Auto-readability for image wallpapers | On |
| Pinned strip | Hidden until something is pinned |
| Space switcher | Hidden until a second space exists |
| Edit mode, focus mode, auto-hide | Off |
| Translucent cards, per-collection accent | Off |
| Widgets (notes, to-do), countdown, second timezone, theme schedule | Off |
| Wallpaper rotation | Off |

---

## Part 5 — Data model v2

Migrate v1 to v2 once, and add everything below in that single migration so users never go through repeated schema bumps. A snapshot is taken before migrating.

```jsonc
{
  "version": 2,
  "activeSpaceId": "…",
  "spaces": [ { "id": "…", "name": "Home", "icon": "🏠", "order": 0, "pinned": ["bookmarkId"] } ],
  "settings": {
    // v1 fields kept: theme, accent, layout, showClock, showDate, showGreeting,
    //                 timeFormat, searchEngine, background
    "palette": "default",                    // default | amoled | paper | contrast
    "accent": "slate",                       // existing presets | "custom"
    "accentCustom": null,                    // "#rrggbb" when accent === "custom"
    "userName": "",
    "themeSchedule": { "enabled": false, "lightFrom": "07:00", "darkFrom": "19:00" },
    "cards": { "style": "filled", "translucent": false, "columns": "auto",
               "width": 340, "gap": 16, "align": "center", "equalHeight": true,
               "verticalCenter": false },
    "display": { "defaultMode": "list", "iconSize": 20, "tileShape": "rounded",
                 "showDomains": true, "density": "comfortable" },
    "clock": { "style": "large", "showSeconds": false, "secondTimezone": null,
               "dateFormat": "weekday-short" },
    "font": { "family": "system", "scale": 1 },
    "countdown": { "label": "", "date": null },
    "behavior": { "openIn": "same", "autoHide": false,
                  "search": { "filterBookmarks": true, "calculator": true,
                              "shortcuts": [ { "key": "yt", "name": "YouTube",
                                "url": "https://www.youtube.com/results?search_query=%s" } ] } },
    "motion": "system",                      // system | reduce
    "largeTargets": false,
    "background": {
      "type": "none",                        // none | solid | gradient | image
      "value": null,                         // solid: "#rrggbb"; gradient: {from,to,angle}
      "dim": 0.35, "autoReadability": true,
      "blur": 0, "fit": "cover", "focal": { "x": 0.5, "y": 0.5 },
      "wallpapers": [ { "id": "…", "name": "…", "luminance": 0.4, "p10": 0.1, "p90": 0.8 } ],
      "activeId": null, "dayId": null, "nightId": null,
      "rotation": "off"                      // off | tab | hourly | daily
    },
    "widgets": { "notes": false, "todo": false },
    "firstRunDone": false
  },
  "categories": [ {
    "id": "…", "spaceId": "…", "name": "…", "icon": "💻", "order": 0, "collapsed": false,
    "displayMode": null,                     // null = use settings.display.defaultMode; list | grid | icons
    "accent": null,                          // optional per-collection accent, off by default
    "bookmarks": [ { "id": "…", "name": "…", "url": "https://…", "order": 0,
                     "icon": null           // { "type": "emoji" | "image", "value": "…" }
    } ]
  } ]
}
```

**Rules for the new schema**
- Every enum is validated and clamped to its default, never grounds for discarding the document (see Phase 0, item A1).
- Strings have length caps (collection and bookmark names 80, emoji icons 8 characters, custom icon images under 12 KB as a data URL, search shortcut keys 12).
- `background.value` is validated by type. A solid value must match `#rgb` or `#rrggbb`; a gradient is `{from, to, angle}` with the same hex check and angle from 0 to 360. Nothing containing `url(` is ever written to a style.
- Wallpaper image blobs live in IndexedDB (store `wallpapers`, key = wallpaper id). Only metadata is in settings. Exports exclude blobs by default.
- Snapshots live in IndexedDB (store `snapshots`), never in `chrome.storage`.
- Deleting a bookmark removes its id from every space's `pinned` list.
- Import and export both carry `spaces` and the new settings. Importing a v1 file runs the full migration.

---

## Part 6 — Phases

### Phase 0 — Stabilize (prerequisite; nothing else starts before this is approved)

For each item: write a failing test that reproduces the bug, fix it, confirm `npm test` is green, one commit. If an existing test asserts the buggy behaviour, change that test and say so.

**A1. Data loss in `migrate()` and import**
- `core/migrate.js` returns the seed data whenever validation fails, so a stored document with one bad value (an unknown theme, or a missing newer settings field such as `accent`) is replaced by the seeds, and the next save overwrites the user's data. Import has the same flaw: a v1 backup without `settings` reports success but loads the seed categories.
- Required: for every version, merge default settings (including `background`) and clamp invalid enums to defaults. Repair categories and bookmarks item by item, dropping only the invalid items. Never replace the document because one field is bad.
- If stored data is unreadable (not an object, or no usable categories array), first copy the raw value to a recovery key (`dashboard:recovery`), then fall back to defaults and show a toast: "Your saved data couldn't be read. A backup copy was kept." If the stored version is newer than the code supports, keep a recovery copy and load best-effort without downgrading.
- Import: fail with a clear message if the file is not a backup (not an object, or no categories array). A backup missing only settings imports with default settings. The preview reports skipped bookmarks (for example "3 bookmarks skipped: invalid URL").

**A2. A tab re-applies its own saves**
- `chrome.storage.onChanged` also fires in the writing tab, so `onExternalStorageChange` swaps in the stored copy and re-renders, which can drop an edit made inside the 300 ms debounce window or disturb an active drag.
- Required: ignore events caused by this tab's own writes (for example a revision stamp, or comparing serialized values). Do not overwrite local state while a save is pending. Defer external updates while a drag is active and apply them on `dragend`.
- Verify with two real tabs in Chrome, including rapid edits.

**A3. `normalizeUrl` rejects `host:port`**
- `localhost:3000`, `my-nas.local:5000`, `example.com:8080` are rejected as "Only http/https" because `host:port` looks like a scheme.
- Required: treat `host:port` as a bare host. Bare hosts default to `https://`, except `localhost`, IP addresses, and `*.local`, which default to `http://`. Single-label hosts are rejected unless `localhost` or a port is given. Still rejected: `javascript:alert(1)`, `data:…`, `file:`, `mailto:`, `chrome://…`, `ftp://…`. Add a test documenting that `javascript:1` parses as host `javascript`, port 1, and yields a harmless https URL.

**A4. Wallpaper reloads on every state change**
- `applyBackground()` is called from every store notification and re-reads IndexedDB with a new blob URL each time. `core/idb.js` never closes its connections.
- Required: re-apply only when `settings.background` actually changed (serialized comparison) plus once on first render. Ignore stale async results. Reuse one DB connection. Revoke the previous object URL. Verify that reordering bookmarks over an image wallpaper causes no flicker.

**A5. Letter-tile fallback may never fire**
- `ui/favicons.js` falls back only on the `<img>` `error` event. I believe `_favicon` returns a generic default icon for uncached sites instead of failing (not verified).
- Required: test with an unused random hostname and a few real, unvisited sites and screenshot the result. If a generic icon appears, detect it: fetch `_favicon` for a guaranteed-unknown host once at startup, hash the bytes, and treat any matching bookmark as "no favicon" (letter tile). Cache the per-domain result in memory. Render the tile first and swap in the real icon only once confirmed. Update the README to describe what actually happens. Mark Brave as not verified.

**S1. Security: unvalidated background values**
- `applyBackground` writes `settings.background.value` straight into `style.backgroundImage` for the solid and gradient types, and the validator doesn't check it. An imported JSON could set `url(https://…)` and cause a network request on every new tab.
- Required: validate as described in Part 5 and reject or reset anything else, on load and on import. Add a test with a `url(…)` payload.
- Add an explicit extension-page CSP to the manifest, for example `default-src 'self'; script-src 'self'; object-src 'self'; img-src 'self' blob: data:; connect-src 'none'; frame-src 'none'`. Verify in Chrome that nothing breaks (favicons, wallpapers, dialogs).

**S2. Length and size caps**
- Apply the caps in Part 5 on load and import. Reject import files over 5 MB. Cap bookmarks per import at a generous limit (for example 5,000) with a clear message.

**B1. Category menu** (`openCategoryMenu`): `aria-haspopup="menu"` and `aria-expanded` on the trigger; `role="menu"`/`menuitem`; focus the first item on open; Arrow/Home/End navigation; Escape closes and returns focus to the trigger; Tab closes; clamp position inside the viewport.

**B2. Settings drawer**: rebuild on a native `<dialog>` with `showModal()`, styled as a right-side drawer, labelled with `aria-labelledby`, focus returned on close. Use a transparent or very light backdrop so the live preview in Phase 1 still works. Animation disabled under reduced motion.

**B3. Collapse button**: stable accessible name plus `aria-expanded` and `aria-controls` pointing at the list.

**B4. Row controls**: up/down/edit/delete visible on `:hover` and `:focus-within`, always in tab order, in both Grid and Compact layouts.

**B5. Toasts**: `role="status"`/`aria-live="polite"`; Undo reachable by keyboard; a toast that has focus does not auto-dismiss.

**C1–C5 housekeeping**
- Replace the saturated letter-tile palette with muted tones (low saturation, passes contrast with the letter in both themes).
- Replace the personal seed bookmark (College Portal) with generic examples.
- Delete the duplicate `IMPLEMENTATION_PLAN_COMPLETE.md` at the repo root.
- Change the test script to `node --test tests/` so it works before Node 21.
- Do not add a LICENSE file; ask me which licence I want.

**Acceptance:** all tests green; Lighthouse accessibility audit run and reported; keyboard-only walkthrough (add, edit, move, delete, open menu, open settings, change theme, close, undo); A2/A4/A5 verified in a running Chrome; Brave checklist handed over.

---

### Phase 1 — Foundation for everything else

**1.1 Schema v2 and migration.** Implement Part 5 with `migrate()` handling v0 → v1 → v2 (each step repairs, none discards). Round-trip tests: v1 fixture, v1 backup file, and a v2 file must all import and export identically.

**1.2 Snapshots and restore** (QoL top 5, item 2).
- IndexedDB store `snapshots`: `{ id, createdAt, reason, counts, data }`. Keep the latest 10.
- Triggered automatically: before a migration, before import, before reset, before any bulk delete, at most once per 24 hours on edit; plus a manual "Create snapshot".
- Data settings shows the list (date, reason, collection and bookmark counts). Restoring shows a preview of the counts, takes a snapshot of the current state first, then applies. All with undo.

**1.3 Settings plumbing.**
- Live preview: changes in the drawer apply to the page behind it immediately; closing with "Cancel" reverts to the opening state. (Needs the transparent backdrop from B2.)
- "Reset this section" button in each settings section.
- Search box inside the settings drawer that filters sections and controls.
- Dynamic-import the drawer code so it doesn't count against first render.

**Acceptance:** upgrading a stored v1 dataset preserves every collection and bookmark; snapshots appear and restore correctly, including after a deliberate bad import; settings revert on cancel; budgets unchanged.

---

### Phase 2 — Daily-driver speed

**2.1 Unified search box** (the biggest QoL win).
- Typing shows matching bookmarks from the active space (toggle "search all spaces"), ranked: exact name, prefix, word-prefix, substring on name, then substring on domain. Show up to 8 results with favicon, name, collection and domain.
- Keys: ArrowDown/Up moves through results, Enter opens the highlighted result. The first result is highlighted automatically only for a strong match (exact or prefix); otherwise Enter performs the web search. Alt+Enter always performs the web search. Escape clears.
- Search shortcuts: `yt cats` expands via the `%s` URL template; the user manages them in Search settings (validate https and exactly one `%s`).
- Calculator: input that looks like an arithmetic expression shows the result as a row (Enter copies it). Hand-written parser only (digits, `+ - * / ^ ( ) %`, decimals); never `eval`.
- ARIA: combobox pattern (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`) with a `role="listbox"` results list.
- Tests: ranking, shortcut expansion, calculator parser including malformed input.

**2.2 Edit mode and inline editing.**
- A toggle (settings cog area, or `e`) that shows persistent drag handles, checkboxes, and inline controls. It never removes keyboard access to the normal controls.
- Double-click or F2 renames a collection or bookmark in place; Enter saves, Escape cancels. A trailing "paste URL" row in each collection adds a bookmark inline (Enter adds; the name defaults to the domain).

**2.3 Drop or paste to add.**
- Dragging a link (`text/uri-list` or `text/plain`) onto a collection adds it there; dropping on the page background opens the add dialog with a collection picker. Pasting a URL while no input is focused opens the add dialog pre-filled.
- Take a name from the dragged anchor's text via `DOMParser` on `text/html` (read `textContent` only); fall back to the domain.

**2.4 Duplicate detection.** Compare normalized URLs (lowercase host, strip `www.`, trailing slash and fragment). On add or edit, show an inline warning naming the collection that already has it; allow adding anyway.

**2.5 Pinned strip and Open all.**
- Pin and unpin from the `⋯` menu. Pinned items show as a one-line icon row above the collections (maximum 8, reorderable with the same drag and keyboard rules); the row is hidden when empty.
- "Open all" in the collection menu. Confirm above 10 links. Use `chrome.tabs.create` and **verify it works without requesting the `tabs` permission**; if it doesn't, report back and leave the action out rather than adding the permission.

**2.6 Keyboard navigation and help.**
- `/` focuses search (exists). `g` shows numbered badges on collections: a digit focuses that collection, a second digit opens its nth link. `[` and `]` cycle spaces (Phase 3). `e` toggles edit mode. `?` opens a shortcuts overlay (a `<dialog>`). All of these fire only when no input is focused and no dialog is open.

**2.7 Link behaviour.** Setting `openIn` (same tab or new tab). Middle-click works natively. Hover or focus on a bookmark shows its full URL in a tooltip; long names truncate with an ellipsis.

**Acceptance:** with the 150-bookmark fixture the filter responds with no visible lag; every action above is possible with the keyboard alone; Lighthouse accessibility still clean; no new permissions in the manifest.

---

### Phase 3 — Organization

**3.1 Spaces.** A small switcher in the header (hidden until a second space exists) to add, rename, reorder and delete spaces (deleting asks what to do with their collections: move to another space or delete, with undo). `[` / `]` cycle spaces; the active space is remembered. "Move to space…" in the collection menu. Search can span all spaces.

**3.2 Bulk operations.** In edit mode: select multiple bookmarks with checkboxes (Shift-click ranges), then a bar offers Move to…, Pin, Delete (with undo). "Add many": a textarea of one URL per line (optional `name | url`), previewing valid and invalid lines before adding.

**3.3 Sort and collapse.** "Sort A–Z" (one-shot, undoable) per collection. "Collapse all" and "Expand all" in the toolbar.

**3.4 Custom icons.** Per bookmark: choose an emoji, upload an image (downscaled to 64 px, under 12 KB, stored as a data URL), or "Use website icon". A "Refresh icon" action retries the favicon.

**3.5 Imports.** Browser bookmarks HTML export (Netscape format) and CSV (`name,url,collection`), both parsed with `DOMParser`/a plain parser, then pushed through the existing validation and the same preview and snapshot flow as JSON import. The optional `bookmarks`-API import stays as is.

**3.6 First-run templates.** On a fresh install choose Student, Developer, Creator, or Start empty. Each template is generic sample data. A short skippable tour (3 to 4 steps) is shown once; `firstRunDone` records it. Dynamic-import the tour.

**Acceptance:** upgrading an existing install never shows first-run; a 100-bookmark HTML import works and previews skipped items; spaces survive reload and export/import; undo works for every destructive action here.

---

### Phase 4 — Look and feel

**4.1 Card styles.** `filled` (today), `outlined`, `borderless` (the quiet list look). Optional `translucent` cards, available only when an image background is active, using a small blur (maximum 8 px) and a minimum card opacity of 0.7; disable the blur under `prefers-reduced-transparency`.

**4.2 Layout controls.** Columns (auto or 1 to 4), card width, gap, alignment, equal-height or masonry, and "centre vertically when there are few collections". Keep max-width containers and the 1440 / 1280 / 1024 / 768 checks.

**4.3 Bookmark display modes** per collection: `list`, `grid` (speed-dial tiles), `icons` (icons only). Settings: icon size slider (16 to 32), rounded or square tiles, show or hide domains, comfortable or compact density. Tooltips and accessible names remain in icons-only mode.

**4.4 Themes and accent.** `palette`: default, **AMOLED** (dark only, pure black base), **paper** (warm light), **contrast** (WCAG AAA targets, both modes). A custom accent picker (native colour input) with automatic contrast checking: warn if the accent fails 3:1 against the card surface or if text on it fails 4.5:1, and offer the nearest passing shade. Optional per-collection accent, off by default.

**4.5 Theme presets.** One-click bundles of theme, palette, accent, card style, layout and background: **Minimal**, **Focus**, **Photo**. Export and import a preset as a small JSON file (validated like any import).

**4.6 Theme schedule.** Optional: switch light and dark at set times, evaluated at load.

**Acceptance:** screenshots of every palette × card style × layout combination that applies at the four widths; contrast checks pass in each palette; unit tests for the contrast helper and preset validation.

---

### Phase 5 — Backgrounds

**5.1 Wallpaper library.** Multiple local wallpapers in IndexedDB (cap about 10, with a size readout); the active one is chosen from a thumbnail grid. Images are downscaled (maximum 2560 px, WebP or JPEG) on import, as today.

**5.2 Auto-readability** (most important). On import, downsample to 32×32 and store the mean luminance plus the 10th and 90th percentiles. When `autoReadability` is on, compute the smallest dim in [0.15, 0.85] that keeps the text colour at 4.5:1 against the worst case (the 90th percentile in dark themes, the 10th in light), and a minimum card opacity when cards are translucent. The dim slider shows an "Auto" state, and moving it switches to manual. The maths lives in a pure, unit-tested function.

**5.3 Blur, position and fit.** Blur slider (0 to 12 px), fit (cover, contain, centre), and a focal-point picker (click on the thumbnail) that sets `focal` and drives `background-position`.

**5.4 Day and night pair.** Optionally pick one wallpaper for light and one for dark; the page follows the resolved theme.

**5.5 Rotation.** Off, every new tab, hourly, or daily across chosen wallpapers. Computed at load only (a time bucket for hourly and daily; "every tab" avoids repeating the previous image). No timers or background work.

**5.6 Drop or paste to set.** Dropping an image file on the page, or pasting an image, opens a full-page preview with the dim slider and Save / Cancel. Nothing is stored until Save.

**5.7 Accent from wallpaper.** Extract a dominant, reasonably saturated colour (small median-cut or hue buckets on the 32×32 sample), run it through the contrast helper, and offer it as a suggestion chip. Never auto-apply.

**5.8 Gradient editor.** Two colour stops and an angle slider with live preview, stored as `{from, to, angle}`. No mesh gradients.

**5.9 Bundled wallpapers.** Create 6 subtle, flat, low-contrast wallpapers (SVG or small WebP) as original assets in `extension/assets/wallpapers/`. Do not download images. Reference them as `bundled:<name>`; they are not stored in IndexedDB.

**Acceptance:** with a bright, a dark and a busy test photo, text passes contrast in every palette without manual tweaking; reordering with an image background has no flicker (Phase 0, A4); the memory and JS budget still hold; a Brave checklist is provided.

---

### Phase 6 — Clock, type and personal touches

- **Clock:** styles large / small / left-aligned; optional seconds; an optional second timezone shown beneath (validated against `Intl.supportedValuesOf('timeZone')`); a date format picker.
- **Typography:** font family limited to system sans, serif, mono (no web fonts); text scale 0.9 to 1.3.
- **Greeting:** the user's name (`Good evening, Name`); optional countdown to a date (label plus days remaining).
- **Focus mode:** a key (`f`) hides everything except the clock and search; not persisted.
- **Auto-hide mode:** show only the clock and search until the mouse moves or a key is pressed; fade the rest in. The settings cog stays focusable and reveals itself on focus. Off by default.

**Acceptance:** every control works at all four widths and with large text; focus mode and auto-hide are fully keyboard-operable.

---

### Phase 7 — Polish, accessibility, and optional widgets

- **Accessibility settings:** `motion` override (system / reduce), `largeTargets`, and the high-contrast palette from 4.4 surfaced in one "Accessibility" settings section.
- **Localization:** move user-facing strings to `_locales` (`chrome.i18n`); ship English only, with the structure ready for more.
- **Optional widgets** (each behind its own switch, off by default, and each its own commit so any can be skipped): **Notes** (a single plain-text note per space, debounced saves) and **To-do** (add, check, delete; stored as text). No Pomodoro.
- **Final audits:** Lighthouse accessibility on every palette, keyboard walkthrough of every feature, performance fixture against the Part 2 budgets, permissions audit (still `storage`, `favicon`, optional `bookmarks`), README and docs updated, version bumped to 0.2.0 (or 1.0.0 if I say so).

**Acceptance:** all budgets met; manifest permissions unchanged; Brave checklist ticked by me.

---

## Part 7 — Deferred (do not build; ask first)

| Idea | Why deferred |
|---|---|
| Weather, search suggestions, link checker, online wallpaper sources | Need network calls and host permissions; would be opt-in with permissions requested only when the user turns the feature on |
| Most-used or recent sites | Overlaps the "no recently-visited intelligence" non-goal |
| Cross-device sync | `chrome.storage.sync` has small limits (about 100 KB total, not verified); would sync settings and a few collections only |
| Open collection as a tab group | Needs the `tabGroups` permission |
| Pomodoro timer | Needs a background worker and extra permissions |

---

## Part 8 — Quick reference: where each earlier idea landed

| Idea | Phase |
|---|---|
| Search that filters bookmarks, shortcuts, calculator | 2.1 |
| Snapshots and restore | 1.2 |
| Drop or paste a link to add | 2.3 |
| Pinned strip, Open all | 2.5 |
| Multiple spaces | 1.1 (schema) and 3.1 (UI) |
| Keyboard jump, `?` overlay, edit mode, inline add and rename | 2.2, 2.6 |
| Duplicate warning, bulk ops, sort, collapse all, custom icons, imports | 2.4, 3.2 to 3.5 |
| Auto-readability, blur/position/fit, day-night, rotation, drop-to-set, accent from wallpaper, gradient editor, bundled set | 5.2 to 5.9 |
| Card styles, translucent cards, columns/width/gap, display modes, tile shape | 4.1 to 4.3 |
| New palettes, accent picker, presets, theme schedule | 4.4 to 4.6 |
| Clock styles, second timezone, fonts, name, countdown, focus and auto-hide | Phase 6 |
| High contrast, large targets, reduced-motion toggle, localization, tour, first-run templates, widgets | 3.6, Phase 7 |
| Live preview, reset section, settings search | 1.3 |
