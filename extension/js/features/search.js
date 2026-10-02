// @ts-check
import { store } from '../core/state.js';

export const SEARCH_ENGINES = {
  google: {
    name: 'Google',
    url: 'https://www.google.com/search',
    param: 'q',
    placeholder: 'Search Google...'
  },
  brave: {
    name: 'Brave Search',
    url: 'https://search.brave.com/search',
    param: 'q',
    placeholder: 'Search with Brave...'
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/',
    param: 'q',
    placeholder: 'Search DuckDuckGo...'
  },
  bing: {
    name: 'Bing',
    url: 'https://www.bing.com/search',
    param: 'q',
    placeholder: 'Search Bing...'
  }
};

/**
 * Updates search form action, input name, and placeholder based on current settings.
 * @param {string} engineKey
 */
export function applySearchEngine(engineKey) {
  const form = /** @type {HTMLFormElement | null} */ (document.getElementById('search-form'));
  const input = /** @type {HTMLInputElement | null} */ (document.getElementById('search-input'));
  if (!form || !input) return;

  const engine = SEARCH_ENGINES[engineKey] || SEARCH_ENGINES.google;
  form.action = engine.url;
  input.name = engine.param;
  input.placeholder = engine.placeholder;
}

/**
 * Initializes keyboard shortcuts for search (e.g. '/' focuses search input).
 */
export function initSearchShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Focus search on '/' when not actively focused in an input, textarea, or open dialog
    const activeTag = document.activeElement?.tagName || '';
    const isDialogOpen = Boolean(document.querySelector('dialog[open], .settings-drawer.open'));

    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) && !isDialogOpen) {
      e.preventDefault();
      const input = document.getElementById('search-input');
      if (input) {
        input.focus();
      }
    }
  });
}
