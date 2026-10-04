// @ts-check
import { store } from '../core/state.js';
import { queueSaveDashboardData } from '../core/storage.js';
import { el, clearChildren } from '../utils/dom.js';
import { createFaviconElement } from '../ui/favicons.js';
import { showToast } from '../ui/toasts.js';

/**
 * Checks if a bookmark is currently pinned in the active space.
 * @param {string} bookmarkId
 * @returns {boolean}
 */
export function isBookmarkPinned(bookmarkId) {
  const state = store.getState();
  const space = state.spaces?.find((s) => s.id === state.activeSpaceId) || state.spaces?.[0];
  return Boolean(space?.pinned?.includes(bookmarkId));
}

/**
 * Returns all pinned bookmarks in the active space.
 * @returns {Array<{ bookmark: import('../core/schema.js').Bookmark, category: import('../core/schema.js').Category }>}
 */
export function getPinnedBookmarks() {
  const state = store.getState();
  const space = state.spaces?.find((s) => s.id === state.activeSpaceId) || state.spaces?.[0];
  if (!space || !Array.isArray(space.pinned) || space.pinned.length === 0) {
    return [];
  }

  const results = [];
  for (const bmId of space.pinned) {
    for (const cat of state.categories || []) {
      const bm = cat.bookmarks?.find((b) => b.id === bmId);
      if (bm) {
        results.push({ bookmark: bm, category: cat });
        break;
      }
    }
  }
  return results;
}

/**
 * Toggles the pinned status of a bookmark in the active space.
 * Enforces a strict maximum of 8 pinned bookmarks.
 *
 * @param {string} bookmarkId
 * @returns {{ success: boolean, pinned: boolean, reason?: string }}
 */
export function togglePinBookmark(bookmarkId) {
  const state = store.getState();
  let space = state.spaces?.find((s) => s.id === state.activeSpaceId);
  if (!space && state.spaces?.length) {
    space = state.spaces[0];
  }
  if (!space) {
    return { success: false, pinned: false, reason: 'no-space' };
  }

  if (!Array.isArray(space.pinned)) {
    space.pinned = [];
  }

  const idx = space.pinned.indexOf(bookmarkId);
  if (idx !== -1) {
    // Unpin
    space.pinned.splice(idx, 1);
    queueSaveDashboardData(state);
    store._notify();
    return { success: true, pinned: false };
  }

  // Pin
  if (space.pinned.length >= 8) {
    return { success: false, pinned: false, reason: 'Maximum 8 pinned bookmarks reached' };
  }

  space.pinned.push(bookmarkId);
  queueSaveDashboardData(state);
  store._notify();
  return { success: true, pinned: true };
}

/**
 * Opens all links in a collection, asking confirmation if links exceed 10.
 * Uses chrome.tabs.create (does not require the "tabs" permission in MV3).
 *
 * @param {Array<import('../core/schema.js').Bookmark>} bookmarks
 * @param {{ confirmFn?: (msg: string) => boolean }} [options]
 * @returns {Promise<void>}
 */
export async function openAllCollectionLinks(bookmarks, options = {}) {
  if (!Array.isArray(bookmarks) || bookmarks.length === 0) return;

  if (bookmarks.length > 10) {
    const confirmFn =
      options.confirmFn ||
      (typeof window !== 'undefined' ? window.confirm.bind(window) : () => true);
    const confirmed = confirmFn(`Open all ${bookmarks.length} links in new tabs?`);
    if (!confirmed) return;
  }

  for (const bm of bookmarks) {
    if (!bm || !bm.url) continue;

    if (
      typeof chrome !== 'undefined' &&
      chrome.tabs &&
      typeof chrome.tabs.create === 'function'
    ) {
      try {
        await chrome.tabs.create({ url: bm.url });
        continue;
      } catch (err) {
        console.warn('chrome.tabs.create failed, falling back to window.open', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.open(bm.url, '_blank', 'noopener,noreferrer');
    }
  }
}

/**
 * Renders the pinned bookmarks strip element.
 * @param {HTMLElement} container
 */
export function renderPinnedStrip(container) {
  if (!container) return;
  clearChildren(container);

  const pinnedItems = getPinnedBookmarks();
  if (pinnedItems.length === 0) {
    container.hidden = true;
    container.style.display = 'none';
    return;
  }

  container.hidden = false;
  container.style.display = 'flex';

  const list = el('div', { className: 'pinned-strip-list' });

  pinnedItems.forEach(({ bookmark }) => {
    const favicon = createFaviconElement(bookmark.url, bookmark.name);
    const itemLink = el(
      'a',
      {
        className: 'pinned-item-btn',
        href: bookmark.url,
        title: `${bookmark.name} (${bookmark.url})`,
        'aria-label': bookmark.name
      },
      favicon,
      el('span', { className: 'pinned-item-name', text: bookmark.name })
    );

    itemLink.addEventListener('click', (e) => {
      const state = store.getState();
      const openIn = state.settings?.behavior?.openIn || 'same';
      if (openIn === 'new') {
        e.preventDefault();
        window.open(bookmark.url, '_blank', 'noopener,noreferrer');
      }
    });

    list.appendChild(itemLink);
  });

  container.appendChild(list);
}
