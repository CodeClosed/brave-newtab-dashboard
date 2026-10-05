---
name: soft-browser-design
description: "Use for ANY UI work in this project (layout, components, styling, motion, theming, settings, dialogs, widgets, dock). Enforces the 'Glass v2' language: a calm two-stage dashboard with frosted-glass surfaces over wallpapers, precise typography, and zero clutter. Rejects generic AI-dashboard aesthetics."
---

# Soft Browser Design Skill: Glass v2

Enforces the visual and interaction design language for the New Tab Dashboard from v0.3 onward. The target is a **calm, atmospheric, precise, fast, personal and uncluttered** new tab: a wallpaper you enjoy looking at, frosted-glass surfaces floating over it, and nothing on screen you didn't ask for.

Full tokens and component specs live in `docs/DESIGN_SYSTEM.md`. The roadmap is in `docs/ROADMAP_V2.md`.

---

## 1. Core Principles

- **Two stages, zero clutter.** The main panel (first screen) shows only the dock, clock/greeting, weather, search and the scroll prompt. Collections live below the fold in the hub. Never add collection content to the main panel.
- **Glass over atmosphere.** Frosted translucent surfaces are the primary material **when there is a wallpaper or gradient behind them**. On a flat background, the same components fall back to solid surfaces automatically.
- **Utility over spectacle.** The page is opened dozens of times a day. It must render instantly, read clearly, and never demand attention.
- **Purposeful color.** Accents mark selection, focus and state. Collection colour tags use the Chrome tab-group palette, shown as small dots or tints rather than painted cards.

---

## 2. Enforced Design Rules

### Surfaces & Glass
- Use the glass tokens only: `--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-radius`, `--glass-shadow`. Never hand-roll `backdrop-filter` values in components.
- Blur range: **8–20px** (default 16px) with `saturate(140–160%)`. Glass opacity range: **0.45–0.90** (default 0.62), raised automatically by auto-readability so text stays at 4.5:1.
- Glass is disabled (solid `--bg-surface`) when: there is no image/gradient background, `prefers-reduced-transparency: reduce`, or the user turns it off.
- Border: 1px hairline (`rgba(255,255,255,0.10)` dark / `0.35` light). Inner highlight is allowed: `inset 0 1px 0 rgba(255,255,255,0.06)`.
- Shadows: soft and diffused, e.g. `0 8px 32px rgba(0,0,0,0.25)` for glass in dark mode. **No coloured glows or neon halos.** The one exception is a subtle accent glow on the primary action (Save current tabs / Open tab group) at most `0 0 16px` and 35% alpha.
- No more than about 12 blurred surfaces visible at once (performance). Hub cards use `content-visibility: auto`.

### Shape & Radii
| Element | Radius |
|---|---|
| Glass widgets and collection windows | `16px` |
| Dialogs and drawer | `14px` |
| Buttons, inputs, menu items | `8px` |
| Bookmark rows | `8px` |
| **Pills** (fully rounded) | Allowed **only** for: the dock, the search bar, hub tabs, the scroll prompt, toolbar chips |
| Favicons in the dock and avatars | `50%` |

### Typography
- **System fonts only** (`system-ui`, `-apple-system`, `Segoe UI`, …). Never load web fonts.
- Scale:
  - Micro / labels: `11–12px`
  - Body / bookmarks: `13–14px`
  - Collection titles: `15–16px`, medium weight
  - Search input: `15–16px`
  - Greeting: `22–28px`, medium weight
  - **Hero clock:** `clamp(56px, 7vw, 96px)`, weight 600, `tabular-nums`. Seconds may render at about 60% opacity, as in the reference. Classic layout keeps the clock at ≤ 44px.
- Text on glass always uses `--text-primary` / `--text-secondary`. Muted text on glass must still pass 4.5:1 for body text.

### Layout
- Spacing is a multiple of 4px (`4, 8, 12, 16, 24, 32, 48`).
- Main panel: `min-height: 100svh`. Hero layouts: `studio` (clock left, cards right) or `centered`. Free-dragged widget positions are stored as viewport percentages and clamped on screen.
- Hub: responsive columns (5 → 1) with a clear maximum card height; long lists scroll inside the card.
- Four corner anchors (34px glass circles) for spaces, edit, wallpaper tuner and settings. Nothing else is pinned to the corners.

### Motion & Feedback
- Micro-transitions: `150–220ms ease-out`. Collapse uses `grid-template-rows: 0fr ↔ 1fr`, never JS height animation.
- Hover: `translateY(-1px)` or a surface tint. In the dock, icon scale up to `1.15` is allowed.
- Smooth scroll between the main panel and the hub; it is instant under reduced motion.
- No bouncy springs, no looping decorative animation, no parallax.
- Always respect `prefers-reduced-motion` and the in-app `motion: reduce` setting.

---

## 3. Explicit Prohibitions ("Do NOT Build")

| Prohibited | Why | Use instead |
|---|---|---|
| Glass on a flat background | Looks muddy, costs GPU for nothing | Solid `--bg-surface` fallback (automatic) |
| Hand-tuned blur/opacity per component | Inconsistent, breaks readability tuning | Glass tokens |
| Neon, rainbow or multi-stop gradients on UI | Visual fatigue | Neutral glass with a single accent |
| Coloured glows/halos (beyond the one primary-action glow) | "Gamer" look | Hairline borders, soft neutral shadows |
| Collections or folders on the main panel | Breaks the two-stage calm | Put them in the hub |
| Duplicate controls (two search bars, two settings buttons) | Confusing | One instance per control |
| Dropdown launchers stuffed into the search bar | Rejected concept (clutter) | Hub toolbar actions |
| Fake productivity badges, scores, streaks | Noise | Plain counts ("12 items") |
| Mascots, loud illustrations | Childish, cluttered | Typographic empty states |
| Web fonts, CDN assets, remote images | Privacy + speed | System fonts, bundled assets |

---

## 4. Visual Inspection Requirement

Before any milestone UI is declared complete, inspect it in a running Chrome at **1440 / 1280 / 1024 / 768px**, in **light and dark**, and in three background states: **no wallpaper (solid fallback), a dark wallpaper, and a bright busy wallpaper**.

Look for:
- Text contrast on glass over the bright wallpaper (must pass 4.5:1)
- Uneven padding or alignment, off-grid spacing
- Main panel clutter (anything beyond dock, clock, weather, search, prompt, and widgets the user placed)
- Truncation of bookmark titles and collection names
- Frame drops while scrolling the hub with a wallpaper behind it
