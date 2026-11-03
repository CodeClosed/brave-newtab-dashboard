import { openShortcutsHelpDialog } from './keyboard.js';
import { applyWidgetPositions, initWidgetDrag } from './widget-drag.js';
import { showToast } from '../ui/toasts.js';
import { ICON_LAYOUT, ICON_CLOSE } from '../ui/icons.js';

let activeLayoutPopover = null;

/**
 * Closes the active layout popover if open.
 */
export function closeLayoutPopover() {
  if (activeLayoutPopover && activeLayoutPopover.parentNode) {
    activeLayoutPopover.parentNode.removeChild(activeLayoutPopover);
  }
  activeLayoutPopover = null;
}

/**
 * Applies hero layout ('studio' | 'centered') to #hero-panel and updates toggle button.
 * @param {import('../core/schema.js').DashboardData['settings']['hero']} heroConf
 * @param {HTMLElement | null} [heroElement]
 */
export function applyHeroLayout(heroConf, heroElement = null) {
  const hero = heroElement || (typeof document !== 'undefined' ? document.getElementById('hero-panel') : null);
  if (!hero || typeof hero.setAttribute !== 'function') return;

  const valid = ['studio', 'centered'];
  const layout = valid.includes(heroConf?.layout) ? heroConf.layout : 'studio';
  hero.setAttribute('data-hero-layout', layout);
  applyWidgetPositions(hero, heroConf?.widgets);

  // Update layout button icon and title
  const btn = typeof document !== 'undefined' && typeof document.getElementById === 'function'
    ? document.getElementById('hero-layout-toggle-btn')
    : null;

  if (btn) {
    const isStudio = layout === 'studio';
    btn.setAttribute('aria-label', `Layout: ${isStudio ? 'Studio (Default)' : 'Centered'}`);
    btn.setAttribute('title', `Layout: ${isStudio ? 'Studio (Default)' : 'Centered'} - Click to switch or reset`);
    btn.classList.toggle('active', isStudio);

    if (isStudio) {
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
      `;
    } else {
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="12" x2="21" y2="12"></line>
        </svg>
      `;
    }
  }
}

/**
 * Helper to clear custom free-drag coordinates from widgets so they snap cleanly into preset layout slots.
 * @param {Record<string, any>} [currentWidgets]
 */
function clearWidgetCoordinates(currentWidgets = {}) {
  const resetWidgets = {};
  for (const k of Object.keys(currentWidgets)) {
    resetWidgets[k] = {
      ...currentWidgets[k],
      x: null,
      y: null,
      w: null,
      h: null
    };
  }
  return resetWidgets;
}

/**
 * Toggles hero layout between 'studio' and 'centered'.
 * Resets conflicting free-drag coordinates to restore clean Bento grid structure.
 * @param {any} store
 */
export function toggleHeroLayout(store) {
  if (!store || typeof store.get !== 'function') return;
  const state = store.get();
  const currentLayout = state.settings?.hero?.layout || 'studio';
  const nextLayout = currentLayout === 'studio' ? 'centered' : 'studio';
  const resetWidgets = clearWidgetCoordinates(state.settings?.hero?.widgets);

  store.updateSettings({
    hero: {
      ...(state.settings?.hero || {}),
      layout: nextLayout,
      widgets: resetWidgets
    }
  });

  const heroPanel = typeof document !== 'undefined' ? document.getElementById('hero-panel') : null;
  if (heroPanel) {
    applyHeroLayout(store.get()?.settings?.hero, heroPanel);
  }

  try {
    showToast(`Layout: ${nextLayout === 'studio' ? 'Studio (Default)' : 'Centered'}`);
  } catch (_) {}
}

/**
 * Resets all hero widgets and layout back to default settings.
 * @param {any} store
 */
export function resetLayoutToDefault(store) {
  if (!store || typeof store.get !== 'function') return;
  const state = store.get();
  const resetWidgets = clearWidgetCoordinates(state.settings?.hero?.widgets);

  store.updateSettings({
    hero: {
      ...(state.settings?.hero || {}),
      layout: 'studio',
      widgets: resetWidgets
    }
  });

  const heroPanel = typeof document !== 'undefined' ? document.getElementById('hero-panel') : null;
  if (heroPanel) {
    applyHeroLayout(store.get()?.settings?.hero, heroPanel);
  }

  try {
    showToast('Reset layout to Default (Studio)', () => {
      store.updateSettings({
        hero: {
          ...(state.settings?.hero || {}),
          widgets: currentWidgets
        }
      });
      if (heroPanel) applyHeroLayout(store.get()?.settings?.hero, heroPanel);
    });
  } catch (_) {}
}

/**
 * Opens or toggles the Layout Menu Popover anchored near the button.
 * @param {HTMLElement} anchorBtn
 * @param {any} store
 */
export function toggleLayoutPopover(anchorBtn, store) {
  if (activeLayoutPopover) {
    closeLayoutPopover();
    return null;
  }

  if (typeof document === 'undefined' || !anchorBtn) return null;

  const state = store.getState ? store.getState() : store.get();
  const currentLayout = state.settings?.hero?.layout || 'studio';

  const popover = document.createElement('div');
  popover.className = 'layout-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Dashboard Layout Presets');

  // Header
  const header = document.createElement('div');
  header.className = 'layout-popover-header';

  const title = document.createElement('span');
  title.className = 'layout-popover-title';
  title.innerHTML = `${ICON_LAYOUT} <span>Layout Presets</span>`;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'layout-popover-close';
  closeBtn.setAttribute('aria-label', 'Close layout menu');
  closeBtn.innerHTML = ICON_CLOSE;
  closeBtn.addEventListener('click', () => closeLayoutPopover());

  header.appendChild(title);
  header.appendChild(closeBtn);
  popover.appendChild(header);

  // Cards Grid
  const grid = document.createElement('div');
  grid.className = 'layout-cards-grid';

  // 1. Studio (Default) Card
  const studioCard = document.createElement('button');
  studioCard.type = 'button';
  studioCard.className = `layout-card-option${currentLayout === 'studio' ? ' is-active' : ''}`;
  studioCard.innerHTML = `
    <div class="layout-card-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
      </svg>
    </div>
    <span class="layout-card-name">Studio</span>
    <span class="layout-default-pill">Default</span>
  `;
  studioCard.addEventListener('click', () => {
    const s = store.get()?.settings?.hero || {};
    const resetWidgets = clearWidgetCoordinates(s.widgets);
    store.updateSettings({
      hero: {
        ...s,
        layout: 'studio',
        widgets: resetWidgets
      }
    });
    const heroPanel = document.getElementById('hero-panel');
    applyHeroLayout(store.get()?.settings?.hero, heroPanel);
    closeLayoutPopover();
    showToast('Applied Default (Studio) Layout');
  });

  // 2. Centered Card
  const centeredCard = document.createElement('button');
  centeredCard.type = 'button';
  centeredCard.className = `layout-card-option${currentLayout === 'centered' ? ' is-active' : ''}`;
  centeredCard.innerHTML = `
    <div class="layout-card-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="3" y1="12" x2="21" y2="12"></line>
      </svg>
    </div>
    <span class="layout-card-name">Centered</span>
  `;
  centeredCard.addEventListener('click', () => {
    const s = store.get()?.settings?.hero || {};
    const resetWidgets = clearWidgetCoordinates(s.widgets);
    store.updateSettings({
      hero: {
        ...s,
        layout: 'centered',
        widgets: resetWidgets
      }
    });
    const heroPanel = document.getElementById('hero-panel');
    applyHeroLayout(store.get()?.settings?.hero, heroPanel);
    closeLayoutPopover();
    showToast('Applied Centered Layout');
  });

  grid.appendChild(studioCard);
  grid.appendChild(centeredCard);
  popover.appendChild(grid);

  // Reset to Default Layout Button
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'layout-reset-btn';
  resetBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg> <span>Reset Layout to Default</span>';
  resetBtn.addEventListener('click', () => {
    resetLayoutToDefault(store);
    closeLayoutPopover();
  });
  popover.appendChild(resetBtn);

  // Position popover
  document.body.appendChild(popover);
  activeLayoutPopover = popover;

  const rect = typeof anchorBtn.getBoundingClientRect === 'function'
    ? anchorBtn.getBoundingClientRect()
    : { left: 16, top: 16, right: 48, bottom: 48 };

  const winWidth = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1440;
  popover.style.position = 'fixed';
  popover.style.top = `${rect.bottom + 8}px`;

  if (rect.left + 320 > winWidth) {
    popover.style.right = `${Math.max(12, winWidth - rect.right)}px`;
    popover.style.left = 'auto';
  } else {
    popover.style.left = `${Math.max(12, rect.left)}px`;
    popover.style.right = 'auto';
  }

  return popover;
}

/**
 * Initializes Hero Panel interactions, corner buttons.
 * @param {any} store
 */
export async function initHero(store) {
  if (typeof document === 'undefined') return;

  const heroPanel = document.getElementById('hero-panel');
  const layoutToggleBtn = document.getElementById('hero-layout-toggle-btn');
  const wallpaperTunerBtn = document.getElementById('wallpaper-tuner-btn');
  const cornerJumpBtn = document.getElementById('corner-jump-btn');

  const settings = store?.get()?.settings || {};

  // 10.1 Hero layout
  applyHeroLayout(settings.hero, heroPanel);
  initWidgetDrag(heroPanel, store);

  if (layoutToggleBtn && store) {
    layoutToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLayoutPopover(layoutToggleBtn, store);
    });
  }

  // Close popover when clicking outside or pressing Escape
  if (typeof window !== 'undefined') {
    window.addEventListener('click', (e) => {
      if (activeLayoutPopover && !activeLayoutPopover.contains(/** @type {Node} */ (e.target)) && e.target !== layoutToggleBtn) {
        closeLayoutPopover();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeLayoutPopover) {
        closeLayoutPopover();
      }
    });
  }

  // 10.4 Corner buttons
  if (wallpaperTunerBtn) {
    wallpaperTunerBtn.addEventListener('click', async (e) => {
      if (typeof e?.stopPropagation === 'function') e.stopPropagation();
      const { toggleWallpaperTuner } = await import('./wallpaper-tuner.js');
      toggleWallpaperTuner(wallpaperTunerBtn, store);
    });
  }

  if (cornerJumpBtn) {
    const getScrollY = () => {
      if (typeof window === 'undefined') return 0;
      return window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0;
    };

    const updateJumpBtnState = () => {
      const isScrolled = getScrollY() > 150;
      cornerJumpBtn.setAttribute('data-direction', isScrolled ? 'top' : 'down');
      cornerJumpBtn.setAttribute('title', isScrolled ? 'Back to top' : 'Scroll down to collections');
      cornerJumpBtn.setAttribute('aria-label', isScrolled ? 'Back to top' : 'Scroll down to collections');

      const svg = cornerJumpBtn.querySelector('svg');
      if (svg) {
        if (isScrolled) {
          svg.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>';
        } else {
          svg.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', updateJumpBtnState, { passive: true });
      if (typeof document !== 'undefined') {
        document.addEventListener('scroll', updateJumpBtnState, { passive: true });
      }
      updateJumpBtnState();
    }

    cornerJumpBtn.addEventListener('click', () => {
      import('../ui/launcher.js').then(m => m.toggleAppLauncher()).catch(() => {});
    });
  }
}
