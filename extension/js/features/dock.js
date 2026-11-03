// @ts-check
import { el, clearChildren } from '../utils/dom.js';
import { createFaviconElement } from '../ui/favicons.js';
import { store } from '../core/state.js';
import { showToast } from '../ui/toasts.js';
import { announceReorder } from './dnd.js';
import { getPinnedBookmarks, reorderPinnedBookmark, togglePinBookmark, moveDockItem, pinBookmark } from './pinned.js';
import { toggleAppLauncher } from '../ui/launcher.js';
import { openDrawer } from '../ui/drawer.js';
import { toggleEditMode } from './edit-mode.js';
import { toggleWallpaperTuner } from './wallpaper-tuner.js';
import { ICON_SLIDERS, ICON_EDIT, ICON_SETTINGS } from '../ui/icons.js';

export const VALID_DOCK_POSITIONS = ['top', 'left', 'bottom', 'right', 'off'];
const DOCK_AUTOHIDE_DELAY_MS = 1800;

let autoHideTimer = null;
let draggedDockIndex = null;

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

  // 1. App Launcher Trigger Button (Lucide layout-grid / 9-dot launcher icon)
  const launcherSvg = `<svg class="app-dock-launcher-svg svg-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1.5"></rect><rect width="7" height="7" x="14" y="3" rx="1.5"></rect><rect width="7" height="7" x="14" y="14" rx="1.5"></rect><rect width="7" height="7" x="3" y="14" rx="1.5"></rect></svg>`;
  const launcherBtn = el('button', {
    type: 'button',
    className: 'app-dock-launcher-btn',
    id: 'dock-launcher-btn',
    title: 'Show Applications & Collections (\\)',
    'aria-label': 'Show Applications and Collections',
    dataset: { tooltip: 'Apps & Folders (\\)' },
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
      title: `${bookmark.name} (Right-click to unpin)`,
      'aria-label': `${bookmark.name} (pinned in dock)`,
      draggable: 'true',
      tabIndex: 0,
      dataset: {
        id: bookmark.id,
        index: String(index),
        tooltip: bookmark.name
      }
    }, favicon);

    // Right-click context menu to unpin
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const res = togglePinBookmark(bookmark.id);
      if (res.success && !res.pinned) {
        showToast(`Unpinned "${bookmark.name}" from dock`, () => {
          togglePinBookmark(bookmark.id);
        });
      }
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

  // Divider before system utility actions
  container.appendChild(el('span', { className: 'app-dock-divider', 'aria-hidden': 'true' }));

  // 2. Wallpaper & Glass Tuner Trigger Button
  const tunerBtn = el('button', {
    type: 'button',
    className: 'app-dock-action-btn app-dock-tuner-btn',
    id: 'dock-tuner-btn',
    title: 'Wallpaper & Glass Tuner',
    'aria-label': 'Open Wallpaper and Glass Tuner',
    dataset: { tooltip: 'Wallpaper & Glass' },
    html: ICON_SLIDERS,
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleWallpaperTuner(tunerBtn, store);
    }
  });
  container.appendChild(tunerBtn);

  // 3. Edit Mode / Customize Widgets Trigger Button
  const isEditing = typeof document !== 'undefined' && document.body?.getAttribute('data-edit-mode') === 'true';
  const editWidgetsBtn = el('button', {
    type: 'button',
    className: `app-dock-action-btn app-dock-edit-btn${isEditing ? ' is-active' : ''}`,
    id: 'dock-edit-btn',
    title: 'Customize & Drag Widgets (E)',
    'aria-label': 'Toggle Edit and Drag Widgets Mode',
    dataset: { tooltip: isEditing ? 'Done Editing (E)' : 'Edit Widgets (E)' },
    html: ICON_EDIT,
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleEditMode();
      renderDock(container);
    }
  });
  container.appendChild(editWidgetsBtn);

  // 4. Settings Modal Trigger Button
  const settingsBtn = el('button', {
    type: 'button',
    className: 'app-dock-action-btn app-dock-settings-btn',
    id: 'dock-settings-btn',
    title: 'Dashboard Settings',
    'aria-label': 'Open Dashboard Settings',
    dataset: { tooltip: 'Settings' },
    html: ICON_SETTINGS,
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDrawer();
    }
  });
  container.appendChild(settingsBtn);

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
