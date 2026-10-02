// @ts-check
import { store } from './core/state.js';
import { renderCategoriesGrid } from './ui/components.js';
import { openCategoryDialog } from './ui/dialogs.js';
import { showToast } from './ui/toasts.js';
import { openDrawer } from './ui/drawer.js';
import { applySearchEngine, initSearchShortcuts } from './features/search.js';
import { renderClockAndGreeting, startClockTicker } from './features/clock.js';
import { applyBackground } from './features/theme.js';

/**
 * Updates DOM root attributes and dynamic UI based on current settings.
 * @param {import('./core/schema.js').DashboardData['settings']} settings
 */
function applySettings(settings) {
  const root = document.documentElement;

  // Theme
  let isDark = false;
  if (settings.theme === 'dark') {
    isDark = true;
  } else if (settings.theme === 'light') {
    isDark = false;
  } else {
    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  if (isDark) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }

  // Accent & Layout
  root.setAttribute('data-accent', settings.accent || 'slate');
  root.setAttribute('data-layout', settings.layout || 'grid');

  // Search Engine
  applySearchEngine(settings.searchEngine || 'google');

  // Background
  applyBackground(settings.background || { type: 'none', value: null, dim: 0.35 });
}

/**
 * Application bootstrapper.
 */
async function initApp() {
  const data = await store.init();
  const gridContainer = document.getElementById('categories-grid');

  if (!gridContainer) {
    console.error('Missing #categories-grid element in DOM');
    return;
  }

  // Initial render
  applySettings(data.settings);
  renderClockAndGreeting(data.settings);
  renderCategoriesGrid(data.categories, gridContainer);

  // Bind Toolbar "New Collection" button
  const addCategoryBtn = document.getElementById('add-category-toolbar-btn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
      openCategoryDialog({
        mode: 'add',
        onSave: (catData) => {
          store.addCategory(catData);
          showToast(`Created collection "${catData.name}"`);
        }
      });
    });
  }

  // Bind Settings Cog Trigger
  const settingsBtn = document.getElementById('settings-trigger-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      openDrawer('appearance');
    });
  }

  // Start Clock Ticker & Keyboard Shortcuts
  startClockTicker();
  initSearchShortcuts();

  // React to store mutations
  store.subscribe((state) => {
    applySettings(state.settings);
    renderClockAndGreeting(state.settings);
    renderCategoriesGrid(state.categories, gridContainer);
  });
}

// Start app once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
