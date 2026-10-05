# Design System: Glass v2

**Design Language:** Calm · Atmospheric · Precise · Uncluttered · Fast · Accessible

This document defines the aesthetic standards, CSS custom properties, and component specs for the New Tab Dashboard from v0.3 onward. It is enforced by `.agents/skills/soft-browser-design/SKILL.md`. The previous "Soft Browser Utility" language (solid surfaces only) survives as the automatic **solid fallback** and as the deprecated Classic layout.

---

## 1. Visual Foundation

### 1.1 Philosophy
- **Two stages.** The main panel (first screen) shows the wallpaper, dock, clock/greeting, weather, search and a scroll prompt, and nothing else. The collections hub sits below the fold, like the Microsoft Edge new tab feed.
- **Glass over atmosphere.** Frosted translucent surfaces float over a wallpaper or gradient. With no background image, every glass surface falls back to the solid tokens below.
- **Purposeful color.** Accents mark active, focus and selection states. Collection colour tags use the Chrome tab-group palette as small dots or header tints.

---

## 2. Design Tokens

### 2.1 Color Palette (solid surfaces, also the glass fallback)

#### Dark Theme
```css
:root[data-theme="dark"],
:root.dark {
  --bg-app: #141618;
  --bg-surface: #1b1e22;
  --bg-surface-hover: #22262b;
  --bg-surface-active: #292e34;
  --bg-surface-subtle: #181a1d;

  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-default: rgba(255, 255, 255, 0.12);
  --border-focus: rgba(255, 255, 255, 0.28);

  --text-primary: #ededed;
  --text-secondary: #9ea3ab;
  --text-muted: #6b7280;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.45);
}
```

#### Light Theme
```css
:root[data-theme="light"],
:root:not(.dark) {
  --bg-app: #f7f6f3;
  --bg-surface: #ffffff;
  --bg-surface-hover: #f1f0eb;
  --bg-surface-active: #e9e8e2;
  --bg-surface-subtle: #faf9f6;

  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-default: rgba(0, 0, 0, 0.10);
  --border-focus: rgba(0, 0, 0, 0.30);

  --text-primary: #191c1f;
  --text-secondary: #586069;
  --text-muted: #8c959f;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.12);
}
```

#### Accent Palette
| Accent Name | Light Token | Dark Token | Purpose |
|---|---|---|---|
| **Slate** (default) | `#3b4252` | `#8892b0` | Quiet, minimal |
| **Blue** | `#2563eb` | `#60a5fa` | Classic browser accent |
| **Emerald** | `#059669` | `#34d399` | Fresh, organic |
| **Amber** | `#d97706` | `#fbbf24` | Warm, golden |
| **Rose** | `#e11d48` | `#fb7185` | Vibrant |

#### Collection Colour Tags (Chrome tab-group palette)
`grey · blue · red · yellow · green · pink · purple · cyan · orange`. These are rendered as a 8px dot next to the collection name and a 6% tint on the window header. They map 1:1 to `chrome.tabGroups` colours when a collection is opened as a tab group.

### 2.2 Glass Tokens
```css
:root {
  --glass-opacity: 0.62;          /* 0.45–0.90, raised by auto-readability */
  --glass-blur-px: 16px;          /* 8–20px */
  --glass-bg: rgba(255, 255, 255, var(--glass-opacity));
  --glass-border: rgba(255, 255, 255, 0.35);
  --glass-blur: blur(var(--glass-blur-px)) saturate(150%);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.10);
  --glass-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.25);
  --glass-radius: 16px;
}
:root[data-theme="dark"] {
  --glass-bg: rgba(18, 21, 26, var(--glass-opacity));
  --glass-border: rgba(255, 255, 255, 0.10);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.30);
  --glass-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
/* Solid fallback: no image/gradient behind, or reduced transparency */
:root:not([data-bg="image"]):not([data-bg="gradient"]),
:root[data-glass="off"] {
  --glass-bg: var(--bg-surface);
  --glass-blur: none;
  --glass-border: var(--border-subtle);
}
@media (prefers-reduced-transparency: reduce) {
  :root { --glass-bg: var(--bg-surface); --glass-blur: none; }
}
```

### 2.3 Typography Scale
```css
:root {
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  --text-xs: 11px;      /* Micro captions, metadata */
  --text-sm: 12.5px;    /* Domains, chips */
  --text-base: 13.5px;  /* Bookmark titles, body */
  --text-md: 15px;      /* Collection titles, search text */
  --text-lg: 18px;      /* Dialog headings */
  --text-greeting: clamp(20px, 2vw, 28px);
  --text-clock: 42px;   /* Classic layout clock */
  --hero-clock-size: clamp(56px, 7vw, 96px);  /* Main panel clock, tabular-nums */
}
```

### 2.4 Spacing
Multiples of 4px: `4 · 8 · 12 · 16 · 24 · 32 · 48`.

### 2.5 Corner Radii
| Element | Radius |
|---|---|
| Glass widgets, collection windows | `16px` |
| Dialogs, drawer | `14px` |
| Buttons, inputs, menu items, bookmark rows | `8px` |
| Pills (dock, search bar, hub tabs, scroll prompt, toolbar chips) | `9999px` |
| Dock favicons, avatars | `50%` |

---

## 3. Core Components

### 3.1 Main Panel (hero)
- `section#hero-panel`, `min-height: 100svh`, no collections.
- Layouts: **studio** (clock/greeting/quote left, weather/search right) or **centered**. In edit mode, widgets can be dragged anywhere and resized; positions are stored as viewport percentages.
- **Clock:** `--hero-clock-size`, weight 600, tabular numbers; seconds at about 60% opacity; date row below in `--text-sm`.
- **Greeting:** `--text-greeting`, medium weight, with an optional name and a quote line in `--text-sm` italic.
- **Scroll prompt:** a pill at the bottom centre reading "Scroll down for your collections ⌄". It fades out after scrolling.

### 3.2 Dock (nav bar)
- A glass pill of pinned bookmarks (max 12) at **top / left / bottom / right** (or off), 6px padding and 8px gap.
- 28px circular favicons. Hover scale is 1.15 with a tooltip showing the name. Auto-hide reveals the dock on edge hover or focus.

### 3.3 Weather Card
- Glass card 320–380px wide. Left: condition, humidity bar (4px track), "Feels like 27°C · City" chips. Right: inline-SVG icon + temperature at 40px semibold.
- States: loading skeleton, cached ("updated 2h ago"), error (hidden), disabled (not rendered).

### 3.4 Search Pill
- A glass pill 48px high, 520–640px wide: engine icon button, input (`--text-md`), `/` badge, submit chip.
- The suggestions listbox drops below as a glass panel (radius 14px) and overlays the main panel.

### 3.5 Collection Window (hub)
- Glass container with radius 16px.
- **Header:** icon, name (`--text-md`, medium), colour dot, "12 items", `+`, `⋯`, collapse chevron.
- **Body:** bookmark rows (favicon 16px, title, optional domain) with an 8px radius on hover.
- **Footer:** "⚡ Open tab group", plus "Save tabs here" when relevant.
- Collapse uses `grid-template-rows: 0fr ↔ 1fr` over 200ms.
- Badge "Saved from tabs · 5 Oct" for collections created from tabs.

### 3.6 Hub Toolbar
- A sticky glass pill bar holding: Back to top · filter input · space switcher · `+ New collection` · **Save current tabs** (primary, with a subtle accent glow) · Collapse/Expand all · `Columns | Tabs` view toggle.

### 3.7 Corner Anchors
- 34px glass circles. Top-left: spaces / jump to the hub. Top-right: edit mode + hero layout. Bottom-left: wallpaper tuner. Bottom-right: settings.

### 3.8 Dialogs & Settings Drawer
- Native `<dialog>`. The backdrop is `rgba(0,0,0,0.35)` with a 4px blur. The drawer is a 400px glass panel on the right, with the live preview visible behind it.

---

## 4. Responsive Breakpoints

| Breakpoint | Hub columns | Main panel |
|---|---|---|
| `≥ 1600px` | 5 | Studio layout, widest gutters |
| `1440–1599px` | 4 | Studio |
| `1280–1439px` | 3 | Studio |
| `1024–1279px` | 2 | Studio, with a narrower right column |
| `768–1023px` | 2 | Centered (studio collapses to centered) |
| `< 768px` | 1 | Centered, dock moves to bottom |

Free-dragged widget positions are clamped on resize so widgets stay fully visible.

---

## 5. Accessibility & Motion

- **Focus visible:** `2px solid var(--accent-base)` with a 2px offset, also on glass.
- **Contrast:** body text on glass must pass 4.5:1 against the worst-case wallpaper area (auto-readability raises `--glass-opacity` and the dim).
- **Reduced motion:** all transitions and smooth scrolling become instant (media query plus the in-app setting).
- **Reduced transparency:** all glass becomes solid.
- **Keyboard parity:** every drag action (widgets, dock, collections) has a keyboard equivalent.
