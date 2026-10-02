---
name: soft-browser-design
description: "Use for ANY UI work in this project (layout, components, styling, motion, theming, settings, dialogs). Enforces a calm, soft, precise, browser-utility look and rejects generic AI-dashboard aesthetics."
---

# Soft Browser Design Skill

Enforces the visual and interaction design philosophy for the New Tab Dashboard extension. The design target is a **calm, soft, quiet, precise, fast, personal, spacious, and uncluttered desktop browser utility**.

---

## 1. Core Principles

- **Utility Over Spectacle:** The browser New Tab page is visited dozens of times per day. It must load instantly, respect cognitive load, and never demand visual attention.
- **Tactile Softness without Blurry Gimmicks:** Surfaces have subtle contrast and delicate borders (6–10% alpha). Avoid heavy backdrop blur or glassmorphism.
- **Compact Density with Breathing Room:** Bookmarks and categories must fit comfortably without feeling like massive marketing cards or tiny spreadsheet cells.
- **Purpose-Driven Accents:** Color communicates selection, interactive focus, and state. Colors are not scattered as decorative confetti.

---

## 2. Enforced Design Rules

### Surfaces & Borders
- **Dark Mode:** Deep slate/charcoal backgrounds (e.g., `#141618` to `#181b1e`), not pitch black (`#000000`). Card backgrounds use low-contrast elevation steps with soft borders (`rgba(255, 255, 255, 0.08)`).
- **Light Mode:** Warm paper white or soft light stone (e.g., `#f8f7f5` to `#f3f2ee`), not stark `#ffffff`. Borders use subtle neutral lines (`rgba(0, 0, 0, 0.07)`).
- **Corner Radii:** Restrained radii:
  - Cards: `10px`
  - Dialogs & Drawers: `12px`
  - Controls, Buttons, Inputs: `6px`
  - Bookmark rows: `6px`
  - Pills or fully round elements are rejected except for circular favicons/avatars (`border-radius: 50%`).
- **Shadows:** Soft, diffused, low-elevation shadows only.
  - Normal cards: `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` or border-only.
  - Modals & Drawers: `0 12px 32px rgba(0,0,0,0.18)`.
  - No neon glows, no colored shadow halos.

### Typography & Hierarchy
- **System-First Stack:** System fonts only (`system-ui`, `-apple-system`, `BlinkMacSystemFont`, "Segoe UI", sans-serif). Never load external web fonts (Google Fonts, Adobe Fonts).
- **Scale:** Restrained scale:
  - Micro / Labels: `11px` - `12px`
  - Body / Bookmarks: `13px` - `14px`
  - Section / Category headers: `14px` - `15px` (medium/semi-bold weight)
  - Search Input: `15px` - `16px`
  - Clock: Capped at `40px` - `44px` (light or medium weight, tabular figures `font-variant-numeric: tabular-nums`).
- **Headings:** Headers are quiet and functional. Never use loud 24px+ card titles.

### Motion & Feedback
- **Micro-transitions:** 150ms–200ms ease-out transitions for hover, focus, and state changes.
- **Hover Motion:** Subtle translation (`transform: translateY(-1px)`) or simple surface/border tint change.
- **No Bouncy/Elastic Physics:** No bouncy spring physics, floating bobbing animations, or looping decorative keyframes.
- **Reduced Motion:** Always wrap animated transitions in `@media (prefers-reduced-motion: no-preference)`. Provide instantaneous state changes when reduced motion is preferred.

---

## 3. Explicit Prohibitions ("Do NOT Build")

| Prohibited Element | Why It Is Rejected | Replacement / Alternative |
|---|---|---|
| **Excessive Glassmorphism** | High GPU cost, poor contrast, tacky 2020 trend | Opaque or 95% opacity soft neutral surfaces with delicate 1px borders |
| **Neon / Multi-color Gradients** | Distracting, visual fatigue | Neutral single-color surfaces with muted single-hue accents |
| **Giant Hero Cards** | Wastes screen real estate, reduces bookmark utility | Compact category cards with high data density |
| **Glowing Borders / Drop Shadows** | "Gamer" aesthetic, inappropriate for desktop productivity | Restrained 1px border with neutral opacity |
| **Excessive Pill Buttons** | Inefficient layout, template-like | Rectangular controls with subtle 6px corner radii |
| **Decorative AI/Productivity Badges** | Fake productivity metric noise | Clean bookmark list showing only name, icon, and domain |
| **Loud Illustrations / Mascots** | Clutters empty space, feels childish | Crisp typographic empty states with direct actions |

---

## 4. Visual Inspection Requirement

Before any milestone UI is declared complete, inspect the running application visually at the following desktop breakpoints in both Light and Dark themes:
- `1440px` (standard desktop)
- `1280px` (laptop)
- `1024px` (small laptop / tablet landscape)
- `768px` (compact / tablet portrait)

Look for:
- Uneven padding or awkward alignment
- Contrast issues against custom backgrounds or dark surfaces
- Awkward text truncation on bookmark titles or URLs
- Inconsistent spacing scale adherence (use multiples of 4px: `4`, `8`, `12`, `16`, `24`, `32px`)
