# Design System: Soft Browser Utility

**Design Language:** Quiet · Soft · Compact · Tactile · Fast · Accessible

This design system defines the aesthetic standards, CSS custom properties, and component styling guidelines for the New Tab Dashboard. It is enforced by `.agents/skills/soft-browser-design/SKILL.md`.

---

## 1. Visual Foundation

### 1.1 Philosophy
- **Restrained Elegance:** Avoid loud neon colors, excessive glassmorphic blur, or floating gradients. Surfaces are solid or near-solid neutrals with delicate 1px borders.
- **Desktop Utility Density:** Optimize for readability and quick access. Category cards should be compact and information-dense without feeling crowded.
- **Purposeful Color:** Accents are reserved exclusively for active states, focus rings, and selection indicators.

---

## 2. Design Tokens

### 2.1 Color Palette

#### Dark Theme (Default)
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
| **Slate** (default) | `#3b4252` | `#8892b0` | Quiet, minimal, distraction-free |
| **Blue** | `#2563eb` | `#60a5fa` | Classic browser accent |
| **Emerald** | `#059669` | `#34d399` | Fresh, organic tone |
| **Amber** | `#d97706` | `#fbbf24` | Warm, golden tone |
| **Rose** | `#e11d48` | `#fb7185` | Subtle vibrant accent |

### 2.2 Typography Scale

```css
:root {
  --font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  --text-xs: 11px;      /* Micro captions, secondary metadata */
  --text-sm: 12px;      /* Bookmark domain, small buttons */
  --text-base: 13.5px;  /* Bookmark title, body text, form inputs */
  --text-md: 15px;      /* Category titles, search bar text */
  --text-lg: 18px;      /* Dialog headings, greeting */
  --text-clock: 42px;   /* Time display (tabular numbers) */

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
}
```

### 2.3 Spacing & Layout Scale
- **Base Grid:** Multiples of 4px.
  - `--space-1`: `4px`
  - `--space-2`: `8px`
  - `--space-3`: `12px`
  - `--space-4`: `16px`
  - `--space-6`: `24px`
  - `--space-8`: `32px`
  - `--space-12`: `48px`

### 2.4 Corner Radii
- **Cards:** `10px`
- **Dialogs & Drawers:** `12px`
- **Buttons, Controls, Inputs:** `6px`
- **Bookmark Row Hover Target:** `6px`
- **Favicon / Badge Icons:** `4px` (or `50%` for circular avatars)

---

## 3. Core Components

### 3.1 Category Card
- **Container:** Background `--bg-surface`, border `1px solid --border-subtle`, radius `10px`, shadow `--shadow-sm`.
- **Header:** Flex row containing category icon (e.g. 🎬), bold title (`--text-md`), item count badge (`--text-xs`), and an action menu button (`...`) that appears on hover/focus.
- **Bookmark Items:**
  - Compact vertical list with `2px` gap.
  - Row padding: `6px 8px`.
  - Favicon: `16x16px` with `4px` radius.
  - Title: `--text-base`, primary text color.
  - URL / Domain: `--text-xs`, muted text color, truncated with ellipsis.
  - Hover: Subtle background shift to `--bg-surface-hover`.
- **Add Trigger:** Compact `+ Add` button styled quietly at the bottom of the category.

### 3.2 Search Field
- **Width:** Max-width `540px`, centered above bookmark cards.
- **Height:** `42px` with `8px` radius.
- **Style:** Subtle surface `--bg-surface`, soft border `1px solid --border-default`, search icon on the left, engine selector icon or label, keyboard shortcut badge (`/`) on the right.
- **Focus:** Subtle accent ring without glowing neon borders.

### 3.3 Clock & Greeting
- **Position:** Centered above the search bar.
- **Clock:** Capped at `42px`, `--weight-medium`, `font-variant-numeric: tabular-nums`.
- **Date & Greeting:** `--text-sm` or `--text-base`, `--text-secondary`, clean letter-spacing.

### 3.4 Modal Dialogs & Settings Drawer
- Native `<dialog>` backdrop: `rgba(0, 0, 0, 0.4)` with light blur (`backdrop-filter: blur(2px)`).
- Settings Drawer: Slides in from the right edge, `380px` wide, divided into clear sections (*Appearance*, *Layout*, *Clock*, *Search*, *Categories*, *Data*).

---

## 4. Responsive Breakpoints

| Breakpoint | Max Grid Columns | Layout Adjustments |
|---|---|---|
| `≥ 1440px` | 4 columns | Maximum whitespace, spacious dashboard |
| `1280px` - `1439px` | 3 or 4 columns | Standard desktop presentation |
| `1024px` - `1279px` | 3 columns | Laptop presentation |
| `768px` - `1023px` | 2 columns | Compact presentation |
| `< 768px` | 1 column | Single vertical stacked stream |

---

## 5. Accessibility & Motion

- **Focus Visible:** `:focus-visible` triggers an outline: `2px solid var(--accent-color)` with `2px` offset.
- **Reduced Motion:**
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
- **Contrast Ratios:** Text on surfaces strictly meets WCAG AA (minimum 4.5:1 for body, 3:1 for large text).
