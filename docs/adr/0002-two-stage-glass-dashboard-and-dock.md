# ADR 0002: Two-Stage Glass Dashboard Architecture and Omnidirectional Dock

- **Status:** Accepted
- **Deciders:** Antigravity Team, CodeClosed
- **Date:** 2026-11-03

## Context & Problem Statement
Traditional new tab startpages suffer from visual crowding: clock, weather, greetings, and dozens of bookmark folders fight for screen real estate on launch.
Conversely, hyper-minimal startpages require opening separate menus or modals just to reach bookmarks.
How can we provide a calm, ambient opening experience while keeping comprehensive bookmark collections instantly accessible?

## Decision Outcome
We adopted the **Glass v2 Two-Stage Dashboard**:
1. **Stage 1 (Hero Panel):**
   - Occupies 100vh on initial render.
   - Houses ambient wallpapers, large hero clock typography, personalized greeting, pill search bar, and the floating app dock.
   - Guaranteed clean and uncluttered.
2. **Stage 2 (Collections Hub):**
   - Positioned below the fold with native CSS scroll snap (`scroll-snap-type: y mandatory`).
   - Accessible by natural scrolling, pressing `g`, or clicking the corner bidirectional toggle (`corner-jump-btn`).
   - Displays bookmark collections as translucent frosted glass panels with responsive columns or tabbed stacks.
3. **Omnidirectional Floating App Dock:**
   - Houses the most frequently accessed pinned links and app launcher trigger.
   - Repositionable to `bottom`, `top`, `left`, `right`, or `off` to match user OS muscle memory (macOS Dock, Windows Taskbar, or Ubuntu launcher).

## Consequences
- **Positive:** Solves visual crowding; gives the extension a distinctive, refined identity beyond generic grid dashboards.
- **Negative:** Requires explicit discoverability cues (`scroll-to-hub` prompt, jump controls) so new users know that Stage 2 exists below the fold.
