// @ts-check
import { renderDailyQuote, loadQuotes } from './quote.js';
import { openShortcutsHelpDialog } from './keyboard.js';

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
 * Initializes Hero Panel interactions, corner buttons, and daily quote.
 * @param {any} store
 */
export async function initHero(store) {
  if (typeof document === 'undefined') return;

  const heroPanel = document.getElementById('hero-panel');
  const quoteContainer = document.getElementById('quote-display');
  const layoutToggleBtn = document.getElementById('hero-layout-toggle-btn');
  const wallpaperTunerBtn = document.getElementById('wallpaper-tuner-btn');
  const cornerJumpBtn = document.getElementById('corner-jump-btn');

  const settings = store?.get()?.settings || {};

  // 10.1 Hero layout
  applyHeroLayout(settings.hero, heroPanel);

  if (layoutToggleBtn && store) {
    layoutToggleBtn.addEventListener('click', () => {
      toggleHeroLayout(store);
    });
  }

  // 10.4 Corner buttons
  if (wallpaperTunerBtn) {
    wallpaperTunerBtn.addEventListener('click', async () => {
      const { openDrawer } = await import('../ui/drawer.js');
      openDrawer('wallpapers');
    });
  }

  if (cornerJumpBtn) {
    cornerJumpBtn.addEventListener('click', () => {
      const gEvent = new KeyboardEvent('keydown', { key: 'g', bubbles: true });
      window.dispatchEvent(gEvent);
    });
  }

  // 10.2 Daily Quote
  if (quoteContainer) {
    const quotes = await loadQuotes();
    renderDailyQuote(settings.quote, quoteContainer, quotes);
  }
}
