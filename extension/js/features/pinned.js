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
  const maxItems = typeof state.settings?.dock?.maxItems === 'number'
    ? state.settings.dock.maxItems
    : 12;

  if (space.pinned.length >= maxItems) {
    return { success: false, pinned: false, reason: `Maximum ${maxItems} pinned bookmarks reached` };
  }

  space.pinned.push(bookmarkId);
  queueSaveDashboardData(state);
  store._notify();
  return { success: true, pinned: true };
}

/**
 * Directly pins a bookmark into the active space dock at an optional index.
 * @param {string} bookmarkId
 * @param {number} [targetIndex]
 * @returns {{ success: boolean, pinned: boolean, reason?: string, alreadyPinned?: boolean }}
 */
export function pinBookmark(bookmarkId, targetIndex = -1) {
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

  const existingIdx = space.pinned.indexOf(bookmarkId);
  if (existingIdx !== -1) {
    if (targetIndex >= 0 && targetIndex < space.pinned.length && targetIndex !== existingIdx) {
      reorderPinnedBookmark(existingIdx, targetIndex);
    }
    return { success: true, pinned: true, alreadyPinned: true };
  }

  const maxItems = typeof state.settings?.dock?.maxItems === 'number'
    ? state.settings.dock.maxItems
    : 12;

  if (space.pinned.length >= maxItems) {
    return { success: false, pinned: false, reason: `Maximum ${maxItems} pinned bookmarks reached` };
  }

  if (targetIndex >= 0 && targetIndex <= space.pinned.length) {
    space.pinned.splice(targetIndex, 0, bookmarkId);
  } else {
    space.pinned.push(bookmarkId);
  }

  queueSaveDashboardData(state);
  store._notify();
  return { success: true, pinned: true };
}

/**
 * Reorders a pinned bookmark within the active space from one index to another.
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {boolean}
 */
export function reorderPinnedBookmark(fromIndex, toIndex) {
  const state = store.getState();
  let space = state.spaces?.find((s) => s.id === state.activeSpaceId) || state.spaces?.[0];
  if (!space || !Array.isArray(space.pinned)) return false;
  if (fromIndex < 0 || fromIndex >= space.pinned.length) return false;
  if (toIndex < 0 || toIndex >= space.pinned.length) return false;
  if (fromIndex === toIndex) return false;

  const [movedId] = space.pinned.splice(fromIndex, 1);
  space.pinned.splice(toIndex, 0, movedId);
  queueSaveDashboardData(state);
  store._notify();
  return true;
}

/**
 * Moves a pinned bookmark by relative direction (-1 or +1) within the dock.
 * @param {string} bookmarkId
 * @param {number} direction
 * @returns {number} The new index or -1 if not found
 */
export function moveDockItem(bookmarkId, direction) {
  const state = store.getState();
  let space = state.spaces?.find((s) => s.id === state.activeSpaceId) || state.spaces?.[0];
  if (!space || !Array.isArray(space.pinned)) return -1;
  const currentIdx = space.pinned.indexOf(bookmarkId);
  if (currentIdx === -1) return -1;
  const targetIdx = currentIdx + direction;
  if (targetIdx < 0 || targetIdx >= space.pinned.length) return currentIdx;
  reorderPinnedBookmark(currentIdx, targetIdx);
  return targetIdx;
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

  const state = store.getState();
  const openIn = state.settings?.behavior?.openIn || 'same';

  pinnedItems.forEach(({ bookmark }) => {
    const favicon = createFaviconElement(bookmark.url, bookmark.name);
    const itemLink = el(
      'a',
      {
        className: 'pinned-item-btn',
        href: bookmark.url,
        target: openIn === 'new' ? '_blank' : '_self',
        rel: openIn === 'new' ? 'noopener noreferrer' : undefined,
        title: bookmark.url,
        dataset: { tooltip: bookmark.url },
        'aria-label': bookmark.name
      },
      favicon,
      el('span', { className: 'pinned-item-name', text: bookmark.name })
    );

    list.appendChild(itemLink);
  });

  container.appendChild(list);
}
