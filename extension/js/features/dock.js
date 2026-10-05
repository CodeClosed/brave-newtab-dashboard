// @ts-check
import { store } from '../core/state.js';
import { clearChildren, el } from '../utils/dom.js';
import { createFaviconElement } from '../ui/favicons.js';
import { showToast } from '../ui/toasts.js';
import {
  getPinnedBookmarks,
  reorderPinnedBookmark,
  moveDockItem,
  pinBookmark
} from './pinned.js';

/**
 * Applies the dock position attribute to the dock and document body.
 * @param {HTMLElement} dockEl
 * @param {string} position
 */
export function applyDockPosition(dockEl, position) {
  const validPositions = ['top', 'left', 'bottom', 'right', 'off'];
  const pos = validPositions.includes(position) ? position : 'top';
  if (dockEl) {
    dockEl.dataset.position = pos;
    if (pos === 'off') {
      dockEl.hidden = true;
      dockEl.style.display = 'none';
    } else {
      dockEl.hidden = false;
      dockEl.style.display = 'flex';
    }
  }
  if (typeof document !== 'undefined' && document.body) {
    document.body.dataset.dockPosition = pos;
  }
}

/**
 * Renders the floating app dock into the given container.
 * @param {HTMLElement} container
 * @param {import('../core/schema.js').DashboardData} state
 */
export function renderDock(container, state) {
  if (!container) return;
  clearChildren(container);

  const dockSettings = state.settings?.dock || { position: 'top', autoHide: false, maxItems: 12 };
  const position = dockSettings.position || 'top';
  const autoHide = Boolean(dockSettings.autoHide);

  applyDockPosition(container, position);

  if (autoHide) {
    container.dataset.autohide = 'true';
  } else {
    delete container.dataset.autohide;
  }

  if (position === 'off') {
    container.hidden = true;
    container.style.display = 'none';
    return;
  }

  const pinnedItems = getPinnedBookmarks();
  if (pinnedItems.length === 0) {
    container.hidden = true;
    container.style.display = 'none';
    return;
  }

  container.hidden = false;
  container.style.display = 'flex';

  const maxItems = typeof dockSettings.maxItems === 'number' ? dockSettings.maxItems : 12;
  const itemsToRender = pinnedItems.slice(0, maxItems);
  const openIn = state.settings?.behavior?.openIn || 'same';

  itemsToRender.forEach(({ bookmark }, index) => {
    const favicon = createFaviconElement(bookmark.url, bookmark.name);
    const itemLink = el(
      'a',
      {
        className: 'app-dock-item',
        href: bookmark.url,
        target: openIn === 'new' ? '_blank' : '_self',
        rel: openIn === 'new' ? 'noopener noreferrer' : undefined,
        title: `${bookmark.name}\n${bookmark.url}`,
        'aria-label': bookmark.name,
        tabIndex: 0,
        draggable: true,
        dataset: {
          id: bookmark.id,
          index: String(index),
          tooltip: bookmark.name
        }
      },
      favicon
    );

    // Keyboard reorder: Alt + Arrow keys
    itemLink.addEventListener('keydown', (e) => {
      const isVertical = position === 'left' || position === 'right';
      const moveBack = isVertical ? e.key === 'ArrowUp' : e.key === 'ArrowLeft';
      const moveForward = isVertical ? e.key === 'ArrowDown' : e.key === 'ArrowRight';

      if (e.altKey && (moveBack || e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {
        e.preventDefault();
        e.stopPropagation();
        const targetIdx = moveDockItem(bookmark.id, -1);
        if (targetIdx !== -1 && targetIdx !== index) {
          showToast(`Moved "${bookmark.name}" left`);
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
              const movedEl = container.querySelector(`.app-dock-item[data-id="${bookmark.id}"]`);
              if (movedEl && typeof movedEl.focus === 'function') movedEl.focus();
            });
          }
        }
      } else if (e.altKey && (moveForward || e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
        e.preventDefault();
        e.stopPropagation();
        const targetIdx = moveDockItem(bookmark.id, 1);
        if (targetIdx !== -1 && targetIdx !== index) {
          showToast(`Moved "${bookmark.name}" right`);
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
              const movedEl = container.querySelector(`.app-dock-item[data-id="${bookmark.id}"]`);
              if (movedEl && typeof movedEl.focus === 'function') movedEl.focus();
            });
          }
        }
      }
    });

    // Drag and drop for reordering
    itemLink.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      const payload = {
        type: 'dock-item',
        bookmarkId: bookmark.id,
        sourceIndex: index
      };
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      }
      itemLink.classList.add('is-dragging');
    });

    itemLink.addEventListener('dragend', () => {
      itemLink.classList.remove('is-dragging');
      container.querySelectorAll('.app-dock-item').forEach((item) => {
        item.classList.remove('dock-drop-before', 'dock-drop-after');
      });
      container.classList.remove('dock-drop-target');
    });

    itemLink.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      if (typeof itemLink.getBoundingClientRect === 'function') {
        const rect = itemLink.getBoundingClientRect();
        const isVertical = position === 'left' || position === 'right';
        const offset = isVertical ? e.clientY - rect.top : e.clientX - rect.left;
        const threshold = (isVertical ? rect.height : rect.width) / 2;

        if (offset < threshold) {
          itemLink.classList.add('dock-drop-before');
          itemLink.classList.remove('dock-drop-after');
        } else {
          itemLink.classList.add('dock-drop-after');
          itemLink.classList.remove('dock-drop-before');
        }
      }
    });

    itemLink.addEventListener('dragleave', (e) => {
      if (!itemLink.contains(/** @type {Node} */ (e.relatedTarget))) {
        itemLink.classList.remove('dock-drop-before', 'dock-drop-after');
      }
    });

    itemLink.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      itemLink.classList.remove('dock-drop-before', 'dock-drop-after');
      container.classList.remove('dock-drop-target');

      let data = null;
      try {
        const raw = e.dataTransfer?.getData('text/plain');
        if (raw) data = JSON.parse(raw);
      } catch {}

      if (!data) return;

      let isAfter = false;
      if (typeof itemLink.getBoundingClientRect === 'function') {
        const rect = itemLink.getBoundingClientRect();
        const isVertical = position === 'left' || position === 'right';
        const offset = isVertical ? e.clientY - rect.top : e.clientX - rect.left;
        isAfter = offset >= (isVertical ? rect.height : rect.width) / 2;
      }
      const targetIdx = isAfter ? index + 1 : index;

      if (data.type === 'dock-item') {
        const srcIdx = data.sourceIndex;
        const adjustedTarget = srcIdx < targetIdx ? targetIdx - 1 : targetIdx;
        if (srcIdx !== adjustedTarget) {
          reorderPinnedBookmark(srcIdx, adjustedTarget);
        }
      } else if (data.type === 'bookmark') {
        const res = pinBookmark(data.bookmarkId, targetIdx);
        if (res.success) {
          showToast(`Pinned "${data.bookmarkName || 'Bookmark'}" to dock`);
        } else {
          showToast(res.reason || 'Could not pin to dock');
        }
      }
    });

    container.appendChild(itemLink);
  });
}

/**
 * Initializes dock drop listeners and auto-hide interactions.
 * @param {HTMLElement} dockEl
 */
export function initDock(dockEl) {
  if (!dockEl) return;

  dockEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dockEl.classList.add('dock-drop-target');
  });

  dockEl.addEventListener('dragleave', (e) => {
    if (!dockEl.contains(/** @type {Node} */ (e.relatedTarget))) {
      dockEl.classList.remove('dock-drop-target');
    }
  });

  dockEl.addEventListener('drop', (e) => {
    dockEl.classList.remove('dock-drop-target');
    let data = null;
    try {
      const raw = e.dataTransfer?.getData('text/plain');
      if (raw) data = JSON.parse(raw);
    } catch {}

    if (data && data.type === 'bookmark') {
      e.preventDefault();
      const res = pinBookmark(data.bookmarkId);
      if (res.success) {
        showToast(`Pinned "${data.bookmarkName || 'Bookmark'}" to dock`);
      } else {
        showToast(res.reason || 'Could not pin to dock');
      }
    }
  });
}
