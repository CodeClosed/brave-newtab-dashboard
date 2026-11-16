// @ts-check
import { el, clearChildren } from '../utils/dom.js';
import { createFaviconElement } from '../ui/favicons.js';
import { store } from '../core/state.js';
import { showToast } from '../ui/toasts.js';
import { announceReorder } from './dnd.js';
import { getPinnedBookmarks, reorderPinnedBookmark, togglePinBookmark, moveDockItem, pinBookmark } from './pinned.js';
import { toggleAppLauncher } from '../ui/launcher.js';
import { openBookmarkDialog } from '../ui/dialogs.js';
import { ICON_EXTERNAL_LINK, ICON_EDIT, ICON_PIN } from '../ui/icons.js';

export const VALID_DOCK_POSITIONS = ['top', 'left', 'bottom', 'right', 'off'];
const DOCK_AUTOHIDE_DELAY_MS = 1800;

let autoHideTimer = null;
let draggedDockIndex = null;
let activeDockContextMenu = null;

/**
 * Closes any currently open dock context menu.
 */
export function closeDockContextMenu() {
  if (activeDockContextMenu) {
    if (typeof activeDockContextMenu.remove === 'function') {
      activeDockContextMenu.remove();
    }
    activeDockContextMenu = null;
  }
}

/**
 * Displays a sleek glass context menu for a pinned dock app.
 * @param {MouseEvent} e
 * @param {import('../core/schema.js').Bookmark} bookmark
 * @param {HTMLElement} itemEl
 * @param {HTMLElement} container
 */
function showDockContextMenu(e, bookmark, itemEl, container) {
  closeDockContextMenu();

  if (typeof document === 'undefined' || !document.body) return;

  const menu = el('div', {
    className: 'dock-context-menu',
    role: 'menu',
    'aria-label': `${bookmark.name} actions`
  });

  const header = el('div', { className: 'dock-context-header' },
    createFaviconElement(bookmark.url, bookmark.name),
    el('span', { className: 'dock-context-title', text: bookmark.name })
  );
  menu.appendChild(header);
  menu.appendChild(el('div', { className: 'dock-context-divider' }));

  // 1. Open in new tab
  const openNewTabBtn = el('button', {
    type: 'button',
    className: 'dock-context-item',
    role: 'menuitem',
    html: `${ICON_EXTERNAL_LINK}<span>Open in New Tab</span>`,
    onclick: (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      closeDockContextMenu();
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(bookmark.url, '_blank', 'noopener,noreferrer');
      }
    }
  });
  menu.appendChild(openNewTabBtn);

  // 2. Edit Bookmark / App
  const editBtn = el('button', {
    type: 'button',
    className: 'dock-context-item',
    role: 'menuitem',
    html: `${ICON_EDIT}<span>Edit Shortcut</span>`,
    onclick: (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      closeDockContextMenu();
      const state = store.getState ? store.getState() : store.get();
      const cat = (state.categories || []).find((c) => c.bookmarks?.some((b) => b.id === bookmark.id));
      openBookmarkDialog({
        mode: 'edit',
        categoryId: cat ? cat.id : '',
        bookmark,
        onSave: (updated) => {
          store.updateBookmark(bookmark.id, updated);
          showToast(`Updated "${updated.name}"`);
        }
      });
    }
  });
  menu.appendChild(editBtn);

  menu.appendChild(el('div', { className: 'dock-context-divider' }));

  // 3. Unpin from Dock
  const unpinBtn = el('button', {
    type: 'button',
    className: 'dock-context-item dock-context-danger',
    role: 'menuitem',
    html: `${ICON_PIN}<span>Unpin from Dock</span>`,
    onclick: (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      closeDockContextMenu();
      const res = togglePinBookmark(bookmark.id);
      if (res.success && !res.pinned) {
        showToast(`Unpinned "${bookmark.name}" from dock`, () => {
          togglePinBookmark(bookmark.id);
        });
      }
    }
  });
  menu.appendChild(unpinBtn);

  document.body.appendChild(menu);
  activeDockContextMenu = menu;

  // Positioning relative to viewport and dock
  const itemRect = itemEl.getBoundingClientRect ? itemEl.getBoundingClientRect() : { top: 0, left: 0, width: 36, height: 36, bottom: 36, right: 36 };
  const menuWidth = 190;
  const menuHeight = 145;
  const pad = 10;
  const dockPos = container.dataset?.position || 'bottom';

  let top = itemRect.top - menuHeight - pad;
  let left = itemRect.left + (itemRect.width - menuWidth) / 2;

  if (dockPos === 'top') {
    top = itemRect.bottom + pad;
  } else if (dockPos === 'left') {
    top = itemRect.top;
    left = itemRect.right + pad;
  } else if (dockPos === 'right') {
    top = itemRect.top;
    left = itemRect.left - menuWidth - pad;
  }

  const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

  if (left < pad) left = pad;
  if (left + menuWidth > winW - pad) left = winW - menuWidth - pad;
  if (top < pad) top = pad;
  if (top + menuHeight > winH - pad) top = winH - menuHeight - pad;

  menu.style.position = 'fixed';
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
}

// Global click & Escape dismissal for dock context menu
if (typeof document !== 'undefined' && !document.__dockContextMenuWired) {
  document.__dockContextMenuWired = true;
  document.addEventListener('click', (e) => {
    if (!e.target || typeof e.target.closest !== 'function' || !e.target.closest('.dock-context-menu')) {
      closeDockContextMenu();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDockContextMenu();
    }
  });
}

/**
 * Applies the dock position attribute to the dock element and document.body.
 * @param {HTMLElement | null} dockEl
 * @param {'top' | 'left' | 'bottom' | 'right' | 'off'} [position='bottom']
 */
export function applyDockPosition(dockEl, position = 'bottom') {
  const safePos = VALID_DOCK_POSITIONS.includes(position) ? position : 'bottom';

  if (typeof document !== 'undefined' && document.body) {
    document.body.dataset.dockPosition = safePos;
    document.body.setAttribute('data-dock-position', safePos);
  }

  if (!dockEl) return;

  dockEl.dataset.position = safePos;
  dockEl.setAttribute('data-position', safePos);

  if (safePos === 'off') {
    dockEl.hidden = true;
    dockEl.style.display = 'none';
  } else {
    dockEl.hidden = false;
    dockEl.style.display = '';
  }
}

/**
 * Renders the floating App Dock.
 * Always remains visible (when position !== 'off') so the App Launcher button is accessible.
 *
 * @param {HTMLElement | null} container
 * @param {import('../core/schema.js').DashboardData} [state]
 */
export function renderDock(container, state) {
  if (!container) return;

  const currentState = state || (store.getState ? store.getState() : store.get());
  const dockConf = currentState?.settings?.dock || { position: 'bottom', autoHide: false, maxItems: 12 };
  const position = VALID_DOCK_POSITIONS.includes(dockConf.position) ? dockConf.position : 'bottom';

  clearChildren(container);

  if (position === 'off') {
    applyDockPosition(container, 'off');
    return;
  }

  const maxItems = typeof dockConf.maxItems === 'number' ? dockConf.maxItems : 12;
  const pinnedList = getPinnedBookmarks(currentState).slice(0, maxItems);

  applyDockPosition(container, position);

  const isAutoHide = Boolean(dockConf.autoHide);
  container.dataset.autohide = isAutoHide ? 'true' : 'false';
  container.setAttribute('data-autohide', isAutoHide ? 'true' : 'false');

  // 1. Unified Platform Launcher Button (Lucide layout-grid / 9-dot launcher icon)
  const launcherSvg = `<svg class="app-dock-launcher-svg svg-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1.5"></rect><rect width="7" height="7" x="14" y="3" rx="1.5"></rect><rect width="7" height="7" x="14" y="14" rx="1.5"></rect><rect width="7" height="7" x="3" y="14" rx="1.5"></rect></svg>`;
  const launcherBtn = el('button', {
    type: 'button',
    className: 'app-dock-launcher-btn',
    id: 'dock-launcher-btn',
    title: 'Unified Platform: Apps, Widgets & Settings (\\)',
    'aria-label': 'Open Unified Platform (Applications, Widgets and Settings)',
    dataset: { tooltip: 'Unified Platform (\\)' },
    html: launcherSvg,
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAppLauncher();
    }
  });

  container.appendChild(launcherBtn);

  // Divider between launcher button and pinned apps
  if (pinnedList.length > 0) {
    container.appendChild(el('span', { className: 'app-dock-divider', 'aria-hidden': 'true' }));
  }

  const openIn = currentState?.settings?.behavior?.openIn || 'same';

  pinnedList.forEach(({ bookmark }, index) => {
    const favicon = createFaviconElement(bookmark.url, bookmark.name);

    const item = el('a', {
      className: 'app-dock-item',
      href: bookmark.url,
      target: openIn === 'new' ? '_blank' : '_self',
      rel: openIn === 'new' ? 'noopener noreferrer' : undefined,
      title: `${bookmark.name} (Right-click for options)`,
      'aria-label': `${bookmark.name} (pinned in dock)`,
      draggable: 'true',
      tabIndex: 0,
      dataset: {
        id: bookmark.id,
        index: String(index),
        tooltip: bookmark.name
      }
    }, favicon);

    // Right-click context menu (Open in new tab, Edit, Unpin)
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showDockContextMenu(e, bookmark, item, container);
    });

    // Keyboard accessibility: Shift+Arrow reorders, Delete/Backspace unpins
    item.addEventListener('keydown', (e) => {
      const isVertical = position === 'left' || position === 'right';
      const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';
      const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';

      if (e.shiftKey && (e.key === prevKey || e.key === nextKey)) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.key === prevKey ? -1 : 1;
        const nextIdx = moveDockItem(bookmark.id, delta);
        if (nextIdx !== -1 && nextIdx !== index) {
          announceReorder(`Moved ${bookmark.name} to dock position ${nextIdx + 1} of ${pinnedList.length}`);
          setTimeout(() => {
            const updatedItems = container.querySelectorAll('.app-dock-item');
            const targetEl = updatedItems[nextIdx];
            if (targetEl && typeof /** @type {HTMLElement} */ (targetEl).focus === 'function') {
              /** @type {HTMLElement} */ (targetEl).focus();
            }
          }, 0);
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        const res = togglePinBookmark(bookmark.id);
        if (res.success && !res.pinned) {
          showToast(`Unpinned "${bookmark.name}" from dock`, () => {
            togglePinBookmark(bookmark.id);
          });
        }
      }
    });

    // Drag-and-drop reorder within dock
    item.addEventListener('dragstart', (e) => {
      draggedDockIndex = index;
      item.classList.add('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
          type: 'dock-item',
          bookmarkId: bookmark.id,
          index
        }));
      }
    });

    item.addEventListener('dragend', () => {
      draggedDockIndex = null;
      item.classList.remove('is-dragging');
      container.querySelectorAll('.app-dock-item').forEach((node) => {
        node.classList.remove('drag-over');
      });
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.classList.remove('drag-over');

      if (draggedDockIndex !== null && draggedDockIndex !== index) {
        reorderPinnedBookmark(draggedDockIndex, index);
        announceReorder(`Moved ${bookmark.name} in dock`);
        draggedDockIndex = null;
        return;
      }

      // Support dropping a bookmark row from a collection card onto a dock slot
      if (e.dataTransfer) {
        try {
          const raw = e.dataTransfer.getData('text/plain');
          if (raw) {
            const payload = JSON.parse(raw);
            if (payload && payload.type === 'bookmark' && payload.bookmarkId) {
              const res = pinBookmark(payload.bookmarkId, index);
              if (res.success && !res.alreadyPinned) {
                showToast(`Pinned "${payload.bookmarkName || 'bookmark'}" to dock`);
              } else if (!res.success && res.reason) {
                showToast(res.reason);
              }
            }
          }
        } catch (_) {}
      }
    });

    container.appendChild(item);
  });

  // Also allow dropping a bookmark directly onto the dock container
  if (!container.dataset.dropBound) {
    container.dataset.dropBound = 'true';
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    container.addEventListener('drop', (e) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      if (e.dataTransfer) {
        try {
          const raw = e.dataTransfer.getData('text/plain');
          if (raw) {
            const payload = JSON.parse(raw);
            if (payload && payload.type === 'bookmark' && payload.bookmarkId) {
              const res = pinBookmark(payload.bookmarkId);
              if (res.success && !res.alreadyPinned) {
                showToast(`Pinned "${payload.bookmarkName || 'bookmark'}" to dock`);
              } else if (!res.success && res.reason) {
                showToast(res.reason);
              }
            }
          }
        } catch (_) {}
      }
    });
  }
}

/**
 * Sets up auto-hide edge hover detection and state subscription for the App Dock.
 * @param {HTMLElement | null} dockEl
 */
export function initDock(dockEl) {
  if (!dockEl) return;

  renderDock(dockEl);

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const revealDock = () => {
    dockEl.classList.add('dock-revealed');
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
  };

  const scheduleHideDock = () => {
    if (dockEl.dataset.autohide !== 'true') return;
    if (autoHideTimer) clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(() => {
      if (!dockEl.matches(':hover') && !dockEl.matches(':focus-within')) {
        dockEl.classList.remove('dock-revealed');
      }
    }, DOCK_AUTOHIDE_DELAY_MS);
  };

  dockEl.addEventListener('mouseenter', revealDock);
  dockEl.addEventListener('mouseleave', scheduleHideDock);
  dockEl.addEventListener('focusin', revealDock);
  dockEl.addEventListener('focusout', scheduleHideDock);

  // Edge proximity sensor for auto-hide
  window.addEventListener('mousemove', (e) => {
    if (dockEl.dataset.autohide !== 'true' || dockEl.hidden) return;
    const pos = dockEl.dataset.position || 'bottom';
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const threshold = 28;

    let nearEdge = false;
    if (pos === 'bottom' && e.clientY >= vh - threshold) nearEdge = true;
    else if (pos === 'top' && e.clientY <= threshold) nearEdge = true;
    else if (pos === 'left' && e.clientX <= threshold) nearEdge = true;
    else if (pos === 'right' && e.clientX >= vw - threshold) nearEdge = true;

    if (nearEdge) {
      revealDock();
    } else if (dockEl.classList.contains('dock-revealed') && !dockEl.matches(':hover')) {
      scheduleHideDock();
    }
  }, { passive: true });
}
