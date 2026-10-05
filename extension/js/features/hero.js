import { openShortcutsHelpDialog } from './keyboard.js';
import { applyWidgetPositions, initWidgetDrag } from './widget-drag.js';

/**
 * Applies hero layout ('studio' | 'centered') to #hero-panel.
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
}

/**
 * Toggles hero layout between 'studio' and 'centered'.
 * @param {any} store
 */
export function toggleHeroLayout(store) {
  if (!store || typeof store.get !== 'function') return;
  const state = store.get();
  const currentLayout = state.settings?.hero?.layout || 'studio';
  const nextLayout = currentLayout === 'studio' ? 'centered' : 'studio';

  store.updateSettings({
    hero: {
      ...(state.settings?.hero || {}),
      layout: nextLayout
    }
  });
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
    layoutToggleBtn.addEventListener('click', () => {
      toggleHeroLayout(store);
      applyHeroLayout(store.get()?.settings?.hero, heroPanel);
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
    const updateJumpBtnState = () => {
      const isScrolled = typeof window !== 'undefined' && window.scrollY > 200;
      cornerJumpBtn.setAttribute('data-direction', isScrolled ? 'top' : 'down');
      cornerJumpBtn.setAttribute('title', isScrolled ? 'Back to top' : 'Jump to collections (g)');
      cornerJumpBtn.setAttribute('aria-label', isScrolled ? 'Back to top' : 'Jump to collections');

      const svg = cornerJumpBtn.querySelector('svg');
      if (svg) {
        if (isScrolled) {
          svg.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>';
        } else {
          svg.innerHTML = '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>';
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', updateJumpBtnState, { passive: true });
      updateJumpBtnState();
    }

    cornerJumpBtn.addEventListener('click', () => {
      const isScrolled = typeof window !== 'undefined' && window.scrollY > 200;
      const isReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (isScrolled) {
        const hero = document.getElementById('hero-panel');
        if (hero && typeof hero.scrollIntoView === 'function') {
          hero.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth' });
        } else if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
          window.scrollTo({ top: 0, behavior: isReduced ? 'auto' : 'smooth' });
        }
      } else {
        const hub = document.getElementById('collections-hub');
        if (hub && typeof hub.scrollIntoView === 'function') {
          hub.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth' });
        }
        try {
          const gEvent = new KeyboardEvent('keydown', { key: 'g', bubbles: true });
          window.dispatchEvent(gEvent);
        } catch (err) {
          // fallback
        }
      }
    });
  }
}
