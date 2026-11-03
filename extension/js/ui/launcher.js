// @ts-check
import { el, clearChildren } from '../utils/dom.js';
import { store } from '../core/state.js';
import { createFaviconElement } from './favicons.js';
import { showToast } from './toasts.js';
import { openCategoryDialog, openBookmarkDialog, openConfirmDialog } from './dialogs.js';
import { saveCurrentTabs, openCollectionAsGroup } from '../features/tab-groups.js';
import { openDrawer } from './drawer.js';
import { isBookmarkPinned, togglePinBookmark, pinBookmark } from '../features/pinned.js';
import {
  ICON_MORE_VERTICAL,
  ICON_PIN,
  ICON_PLUS,
  ICON_EDIT,
  ICON_TRASH,
  ICON_TABS_GROUP,
  ICON_SAVE_TABS,
  ICON_SETTINGS,
  ICON_TIP,
  ICON_CLOSE,
  ICON_ARROW_LEFT,
  ICON_EXTERNAL_LINK,
  ICON_FOLDER,
  ICON_CHEVRON_RIGHT,
  ICON_CHECK,
  getIconSvg
} from './icons.js';

let launcherModal = null;
let currentSearchQuery = '';
let activeFolderCategory = null;

// Drag-and-drop transfer state across folders and apps
let draggedItemInfo = null; // { type: 'bookmark', bookmarkId, sourceCategoryId }

export const UNCATEGORIZED_FOLDER_NAME = 'Quick Apps';

/**
 * Ensures the default "Quick Apps" individual apps collection exists in the active space.
 * @param {import('../core/schema.js').DashboardData} state
 * @param {string} activeSpaceId
 * @returns {import('../core/schema.js').Category}
 */
export function ensureUncategorizedCategory(state, activeSpaceId) {
  let quickAppsCat = (state.categories || []).find(
    c => (!c.spaceId || c.spaceId === activeSpaceId) && (c.name === UNCATEGORIZED_FOLDER_NAME || c.id === 'quick-apps-category')
  );

  if (!quickAppsCat) {
    quickAppsCat = store.addCategory({
      name: UNCATEGORIZED_FOLDER_NAME,
      icon: 'zap',
      spaceId: activeSpaceId
    });
  }
  return quickAppsCat;
}

/**
 * Ensures the App Launcher dialog DOM element exists.
 * @returns {HTMLDialogElement}
 */
export function ensureLauncherDOM() {
  if (launcherModal && document.body.contains(launcherModal)) {
    return launcherModal;
  }

  const dialog = /** @type {HTMLDialogElement} */ (el('dialog', {
    className: 'app-launcher-modal',
    id: 'app-launcher-modal',
    'aria-label': 'Applications and Collections'
  }));

  // Close on backdrop click
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      const isInside = (
        rect.top <= e.clientY && e.clientY <= rect.bottom &&
        rect.left <= e.clientX && e.clientX <= rect.right
      );
      if (!isInside) {
        closeAppLauncher();
      }
    }
  });

  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeAppLauncher();
  });

  document.body.appendChild(dialog);
  launcherModal = dialog;
  return dialog;
}

/**
 * Opens the App Launcher modal.
 * @param {string | null} [initialCategoryId=null]
 */
export function openAppLauncher(initialCategoryId = null) {
  const dialog = ensureLauncherDOM();
  currentSearchQuery = '';
  activeFolderCategory = initialCategoryId;
  renderLauncherContent();

  if (!dialog.open && typeof dialog.showModal === 'function') {
    dialog.showModal();
  }
  dialog.classList.add('open');

  const searchInput = dialog.querySelector('.launcher-search-input');
  if (searchInput && typeof /** @type {HTMLElement} */ (searchInput).focus === 'function') {
    /** @type {HTMLElement} */ (searchInput).focus();
  }
}

/**
 * Closes the App Launcher modal.
 */
export function closeAppLauncher() {
  closeContextMenu();
  if (!launcherModal) return;
  launcherModal.classList.remove('open');
  if (launcherModal.open && typeof launcherModal.close === 'function') {
    launcherModal.close();
  }
  draggedItemInfo = null;
}

/**
 * Toggles the App Launcher modal open/closed.
 */
export function toggleAppLauncher() {
  if (launcherModal && launcherModal.open) {
    closeAppLauncher();
  } else {
    openAppLauncher();
  }
}

/**
 * Renders the contents of the App Launcher modal.
 */
export function renderLauncherContent() {
  const dialog = ensureLauncherDOM();
  clearChildren(dialog);

  const state = store.getState ? store.getState() : store.get();
  const activeSpaceId = state.activeSpaceId || state.spaces?.[0]?.id;
  const categories = (state.categories || []).filter(c => !c.spaceId || c.spaceId === activeSpaceId);

  // Top Glass Header Bar
  const searchInput = el('input', {
    type: 'search',
    className: 'launcher-search-input',
    placeholder: 'Search apps, bookmarks & folders...',
    value: currentSearchQuery,
    autocomplete: 'off'
  });

  searchInput.addEventListener('input', () => {
    currentSearchQuery = /** @type {HTMLInputElement} */ (searchInput).value.trim().toLowerCase();
    activeFolderCategory = null;
    renderBodyContent(bodyContainer, categories, state, activeSpaceId);
  });

  const searchSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
  const searchBox = el('div', { className: 'launcher-search-box' },
    el('span', { className: 'launcher-search-icon', 'aria-hidden': 'true', html: searchSvg }),
    searchInput
  );

  // New Bookmark / App Button
  const newAppBtn = el('button', {
    className: 'launcher-btn-subtle',
    type: 'button',
    html: `${ICON_PLUS}<span>Add App</span>`,
    title: 'Add a new app or bookmark',
    onclick: () => {
      const quickCat = ensureUncategorizedCategory(state, activeSpaceId);
      openBookmarkDialog({
        mode: 'add',
        categoryId: activeFolderCategory || quickCat.id,
        onSave: (bmData) => {
          const added = store.addBookmark(bmData.targetCategoryId || activeFolderCategory || quickCat.id, bmData);
          if (bmData.pinned && added?.id) {
            pinBookmark(added.id);
          }
          showToast(`Added "${bmData.name}"`);
          renderLauncherContent();
          return added;
        }
      });
    }
  });

  // New Folder Collection Button
  const newFolderBtn = el('button', {
    className: 'launcher-btn-subtle',
    type: 'button',
    html: `${ICON_PLUS}<span>New Folder</span>`,
    title: 'Create a new folder collection',
    onclick: () => {
      openCategoryDialog({
        mode: 'add',
        onSave: (catData) => {
          store.addCategory(catData);
          showToast(`Created folder "${catData.name}"`);
          renderLauncherContent();
        }
      });
    }
  });

  // Save Current Tabs Action
  const saveTabsBtn = el('button', {
    className: 'launcher-btn-accent',
    type: 'button',
    title: 'Save all open browser tabs as a folder',
    html: `${ICON_SAVE_TABS}<span>Save Tabs</span>`,
    onclick: () => {
      saveCurrentTabs();
      renderLauncherContent();
    }
  });

  // Open Dashboard Settings Button
  const settingsBtn = el('button', {
    className: 'launcher-btn-subtle',
    type: 'button',
    title: 'Open Settings (Appearance, Layout, Dock, Clock)',
    html: `${ICON_SETTINGS}<span>Settings</span>`,
    onclick: () => {
      closeAppLauncher();
      openDrawer();
    }
  });

  const closeBtn = el('button', {
    className: 'launcher-close-btn',
    type: 'button',
    'aria-label': 'Close App Launcher',
    title: 'Close launcher (Esc)',
    html: ICON_CLOSE,
    onclick: () => closeAppLauncher()
  });

  const header = el('header', { className: 'launcher-header' },
    el('div', { className: 'launcher-header-left' },
      searchBox
    ),
    el('div', { className: 'launcher-header-actions' },
      newAppBtn,
      newFolderBtn,
      saveTabsBtn,
      settingsBtn,
      closeBtn
    )
  );

  // Content Body Container
  const bodyContainer = el('div', { className: 'launcher-body' });
  renderBodyContent(bodyContainer, categories, state, activeSpaceId);

  dialog.appendChild(header);
  dialog.appendChild(bodyContainer);
}

/**
 * Renders the body of the launcher: overview, expanded folder, or search results.
 * @param {HTMLElement} container
 * @param {import('../core/schema.js').Category[]} categories
 * @param {import('../core/schema.js').DashboardData} state
 * @param {string} activeSpaceId
 */
function renderBodyContent(container, categories, state, activeSpaceId) {
  clearChildren(container);

  // If a specific folder is open
  if (activeFolderCategory) {
    const category = categories.find(c => c.id === activeFolderCategory);
    if (category) {
      renderExpandedFolderView(container, category, categories, state, activeSpaceId);
      return;
    }
  }

  // Filter mode
  if (currentSearchQuery) {
    renderFilteredResults(container, categories, state);
    return;
  }

  // Split categories:
  // Quick Apps (standalone apps) vs Folders (collections)
  const quickCat = categories.find(c => c.name === UNCATEGORIZED_FOLDER_NAME);
  const standaloneApps = quickCat && Array.isArray(quickCat.bookmarks) ? quickCat.bookmarks : [];
  const folders = categories.filter(c => c.name !== UNCATEGORIZED_FOLDER_NAME);

  const totalAppCount = categories.reduce((sum, c) => sum + (c.bookmarks?.length || 0), 0);

  // 1. Standalone Apps Section (Top grid: individual apps)
  const appsSection = el('section', { className: 'launcher-section' });
  const appsHeader = el('div', { className: 'launcher-section-title' },
    el('span', { className: 'launcher-section-label', text: 'Standalone Apps' }),
    el('span', { className: 'launcher-section-count', text: `${standaloneApps.length} apps` })
  );

  const appsGrid = el('div', { className: 'launcher-grid launcher-apps-grid' });

  // Drop target zone on standalone grid to move an app OUT of a folder into Standalone Apps
  appsGrid.addEventListener('dragover', (e) => {
    e.preventDefault();
    appsGrid.classList.add('drag-over-zone');
  });
  appsGrid.addEventListener('dragleave', (e) => {
    if (!appsGrid.contains(/** @type {Node} */ (e.relatedTarget))) {
      appsGrid.classList.remove('drag-over-zone');
    }
  });
  appsGrid.addEventListener('drop', (e) => {
    e.preventDefault();
    appsGrid.classList.remove('drag-over-zone');
    if (draggedItemInfo && draggedItemInfo.bookmarkId) {
      const targetCat = ensureUncategorizedCategory(state, activeSpaceId);
      if (draggedItemInfo.sourceCategoryId !== targetCat.id) {
        store.moveBookmark(draggedItemInfo.sourceCategoryId, targetCat.id, draggedItemInfo.bookmarkId);
        showToast('Moved app outside to Standalone Apps');
        renderLauncherContent();
      }
    }
    draggedItemInfo = null;
  });

  if (standaloneApps.length === 0) {
    const emptyAppPrompt = el('button', {
      type: 'button',
      className: 'launcher-empty-tile-prompt',
      onclick: () => {
        const qCat = ensureUncategorizedCategory(state, activeSpaceId);
        openBookmarkDialog({
          mode: 'add',
          categoryId: qCat.id,
          onSave: (bmData) => {
            const added = store.addBookmark(qCat.id, bmData);
            if (bmData.pinned && added?.id) {
              pinBookmark(added.id);
            }
            showToast(`Added "${bmData.name}"`);
            renderLauncherContent();
            return added;
          }
        });
      }
    },
      el('span', { className: 'launcher-empty-prompt-icon', html: ICON_PLUS }),
      el('span', { className: 'launcher-empty-prompt-text', text: 'Add Individual App or Drag items here' })
    );
    appsGrid.appendChild(emptyAppPrompt);
  } else {
    standaloneApps.forEach((bm) => {
      const tile = createDraggableAppTile(bm, quickCat.id, state, categories);
      appsGrid.appendChild(tile);
    });
  }

  appsSection.appendChild(appsHeader);
  appsSection.appendChild(appsGrid);

  // 2. Folders & Collections Section (Bottom grid: iOS / Android / Ubuntu style folder tiles)
  const foldersSection = el('section', { className: 'launcher-section' });
  const foldersHeader = el('div', { className: 'launcher-section-title' },
    el('span', { className: 'launcher-section-label', text: 'Folders & Groups' }),
    el('span', { className: 'launcher-section-count', text: `${folders.length} folders · ${totalAppCount} total items` })
  );

  const foldersGrid = el('div', { className: 'launcher-grid launcher-folders-grid' });

  folders.forEach((cat) => {
    const bookmarks = Array.isArray(cat.bookmarks) ? cat.bookmarks : [];
    const previewIcons = bookmarks.slice(0, 4);

    const iconBox = el('div', { className: 'launcher-folder-icon-box' });
    if (previewIcons.length === 0) {
      iconBox.appendChild(el('span', { className: 'launcher-mini-folder-empty', html: getIconSvg(cat.icon || 'folder', 22) }));
    } else {
      previewIcons.forEach((bm) => {
        const mini = createFaviconElement(bm.url, bm.name);
        mini.classList.add('launcher-mini-favicon');
        iconBox.appendChild(mini);
      });
      // Pad empty slots in 2x2 grid with subtle dots
      for (let i = previewIcons.length; i < 4; i++) {
        iconBox.appendChild(el('span', { className: 'launcher-mini-slot-empty' }));
      }
    }

    const folderTile = el('div', {
      className: 'launcher-folder-tile-wrapper',
      title: `${cat.name} (${bookmarks.length} apps)\nClick to open · Drag app here to add to folder`
    });

    const folderBtn = el('button', {
      type: 'button',
      className: 'launcher-folder-tile',
      onclick: () => {
        activeFolderCategory = cat.id;
        renderLauncherContent();
      }
    },
      iconBox,
      el('span', { className: 'launcher-folder-name', text: cat.name }),
      el('span', { className: 'launcher-folder-count', text: `${bookmarks.length} items` })
    );

    // Drop target: Drop an app INTO this folder
    folderTile.addEventListener('dragover', (e) => {
      e.preventDefault();
      folderTile.classList.add('folder-drag-over');
    });
    folderTile.addEventListener('dragleave', (e) => {
      if (!folderTile.contains(/** @type {Node} */ (e.relatedTarget))) {
        folderTile.classList.remove('folder-drag-over');
      }
    });
    folderTile.addEventListener('drop', (e) => {
      e.preventDefault();
      folderTile.classList.remove('folder-drag-over');
      if (draggedItemInfo && draggedItemInfo.bookmarkId) {
        if (draggedItemInfo.sourceCategoryId !== cat.id) {
          store.moveBookmark(draggedItemInfo.sourceCategoryId, cat.id, draggedItemInfo.bookmarkId);
          showToast(`Moved to folder "${cat.name}"`);
          renderLauncherContent();
        }
      }
      draggedItemInfo = null;
    });

    // Three-dot options menu for folder
    const menuBtn = el('button', {
      type: 'button',
      className: 'launcher-item-menu-btn',
      'aria-label': `Options for folder ${cat.name}`,
      title: 'Folder options',
      html: ICON_MORE_VERTICAL,
      onclick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        openFolderContextMenu(e, cat);
      }
    });

    folderTile.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openFolderContextMenu(e, cat);
    });

    folderTile.appendChild(folderBtn);
    folderTile.appendChild(menuBtn);
    foldersGrid.appendChild(folderTile);
  });

  foldersSection.appendChild(foldersHeader);
  foldersSection.appendChild(foldersGrid);

  container.appendChild(appsSection);
  container.appendChild(foldersSection);
}

/**
 * Creates an interactive draggable app / bookmark tile.
 * @param {import('../core/schema.js').Bookmark} bm
 * @param {string} sourceCategoryId
 * @param {import('../core/schema.js').DashboardData} state
 * @param {import('../core/schema.js').Category[]} categories
 * @returns {HTMLElement}
 */
function createDraggableAppTile(bm, sourceCategoryId, state, categories) {
  const openIn = state.settings?.behavior?.openIn || 'same';

  const wrapper = el('div', {
    className: 'launcher-app-tile-wrapper',
    draggable: 'true'
  });

  // Dragstart
  wrapper.addEventListener('dragstart', (e) => {
    draggedItemInfo = {
      type: 'bookmark',
      bookmarkId: bm.id,
      sourceCategoryId
    };
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'bookmark',
        bookmarkId: bm.id,
        bookmarkName: bm.name,
        sourceCategoryId
      }));
      e.dataTransfer.setData('text/uri-list', bm.url);
    }
    wrapper.classList.add('is-dragging');
    launcherModal?.classList.add('is-dragging-item');
  });

  wrapper.addEventListener('dragend', () => {
    wrapper.classList.remove('is-dragging');
    launcherModal?.classList.remove('is-dragging-item');
  });

  const favicon = createFaviconElement(bm.url, bm.name);
  const link = el('a', {
    className: 'launcher-app-tile',
    href: bm.url,
    target: openIn === 'new' ? '_blank' : '_self',
    rel: openIn === 'new' ? 'noopener noreferrer' : undefined,
    title: `${bm.name}\n${bm.url}`,
    onclick: () => {
      closeAppLauncher();
    }
  },
    el('div', { className: 'launcher-app-icon' }, favicon),
    el('span', { className: 'launcher-app-name', text: bm.name })
  );

  // Quick Action menu button (Move, Pin, Edit, Delete)
  const menuBtn = el('button', {
    type: 'button',
    className: 'launcher-item-menu-btn',
    'aria-label': `Options for ${bm.name}`,
    title: 'Options (Move, Pin, Edit, Delete)',
    html: ICON_MORE_VERTICAL,
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAppContextMenu(e, bm, sourceCategoryId, categories);
    }
  });

  // Visual pinned badge if already in navbar / app dock
  const isPinned = isBookmarkPinned(bm.id);
  if (isPinned) {
    wrapper.classList.add('is-pinned');
    const pinBadge = el('span', {
      className: 'launcher-pin-indicator',
      title: 'Pinned to Navbar / App Dock',
      'aria-label': 'Pinned to Navbar',
      html: ICON_PIN
    });
    wrapper.appendChild(pinBadge);
  }

  wrapper.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openAppContextMenu(e, bm, sourceCategoryId, categories);
  });

  wrapper.appendChild(link);
  wrapper.appendChild(menuBtn);
  return wrapper;
}

/**
 * Context popover / modal for an individual app (macOS / Windows 11 Acrylic style).
 * @param {MouseEvent} e
 * @param {import('../core/schema.js').Bookmark} bm
 * @param {string} currentCategoryId
 * @param {import('../core/schema.js').Category[]} categories
 */
function openAppContextMenu(e, bm, currentCategoryId, categories) {
  const menu = el('div', { className: 'launcher-context-menu', role: 'menu' });

  // 1. Open in New Tab
  const openNewTabBtn = el('button', {
    type: 'button',
    role: 'menuitem',
    className: 'launcher-menu-item',
    html: `${ICON_EXTERNAL_LINK}<span class="launcher-menu-item-text">Open in New Tab</span>`,
    onclick: () => {
      closeContextMenu();
      window.open(bm.url, '_blank', 'noopener,noreferrer');
    }
  });

  // 2. Pin / Unpin option for dock
  const isPinned = isBookmarkPinned(bm.id);
  const pinBtn = el('button', {
    type: 'button',
    role: 'menuitem',
    className: `launcher-menu-item${isPinned ? ' is-active' : ''}`,
    html: `${ICON_PIN}<span class="launcher-menu-item-text">${isPinned ? 'Unpin from Dock' : 'Pin to Dock'}</span>`,
    title: isPinned ? 'Remove from floating dock' : 'Add to floating dock',
    onclick: () => {
      closeContextMenu();
      const res = togglePinBookmark(bm.id);
      if (res.success) {
        showToast(res.pinned ? `Pinned "${bm.name}" to dock` : `Unpinned "${bm.name}" from dock`);
        renderLauncherContent();
      } else {
        showToast(res.reason || 'Could not pin to dock');
      }
    }
  });

  // 3. Move to Folder (macOS / Windows 11 expandable submenu item)
  const moveSubmenuWrapper = el('div', { className: 'launcher-submenu-wrapper' });
  const moveSubmenuTrigger = el('button', {
    type: 'button',
    role: 'menuitem',
    className: 'launcher-menu-item launcher-submenu-trigger',
    'aria-expanded': 'false',
    html: `${ICON_FOLDER}<span class="launcher-menu-item-text">Move to Folder</span><span class="launcher-submenu-chevron">${ICON_CHEVRON_RIGHT}</span>`,
    onclick: (evt) => {
      evt.stopPropagation();
      const isOpen = moveSubmenuWrapper.classList.toggle('is-open');
      moveSubmenuTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  });

  const moveSubmenuList = el('div', { className: 'launcher-submenu-list', role: 'menu' });
  categories.forEach((cat) => {
    const isCurrent = cat.id === currentCategoryId;
    const displayName = cat.name === UNCATEGORIZED_FOLDER_NAME ? 'Standalone Apps' : cat.name;
    const iconSvg = getIconSvg(cat.icon || 'folder', 14);
    const folderOptBtn = el('button', {
      type: 'button',
      role: 'menuitemradio',
      'aria-checked': isCurrent ? 'true' : 'false',
      className: `launcher-menu-item launcher-submenu-option${isCurrent ? ' is-current' : ''}`,
      html: `${iconSvg}<span class="launcher-menu-item-text">${displayName}</span><span class="launcher-submenu-check">${isCurrent ? ICON_CHECK : ''}</span>`,
      onclick: () => {
        if (!isCurrent) {
          store.moveBookmark(currentCategoryId, cat.id, bm.id);
          showToast(`Moved to ${displayName}`);
          closeContextMenu();
          renderLauncherContent();
        } else {
          closeContextMenu();
        }
      }
    });
    moveSubmenuList.appendChild(folderOptBtn);
  });

  moveSubmenuWrapper.appendChild(moveSubmenuTrigger);
  moveSubmenuWrapper.appendChild(moveSubmenuList);

  // 4. Edit App
  const editBtn = el('button', {
    type: 'button',
    role: 'menuitem',
    className: 'launcher-menu-item',
    html: `${ICON_EDIT}<span class="launcher-menu-item-text">Edit App...</span>`,
    onclick: () => {
      closeContextMenu();
      openBookmarkDialog({
        mode: 'edit',
        categoryId: currentCategoryId,
        bookmark: bm,
        onSave: (bmData) => {
          store.updateBookmark(currentCategoryId, bm.id, bmData);
          showToast(`Updated "${bmData.name}"`);
          renderLauncherContent();
        }
      });
    }
  });

  // 5. Divider + Delete App
  const divider1 = el('div', { className: 'launcher-menu-divider', role: 'separator' });
  const divider2 = el('div', { className: 'launcher-menu-divider', role: 'separator' });

  const deleteBtn = el('button', {
    type: 'button',
    role: 'menuitem',
    className: 'launcher-menu-item launcher-menu-danger',
    html: `${ICON_TRASH}<span class="launcher-menu-item-text">Delete App</span>`,
    onclick: () => {
      closeContextMenu();
      const undo = store.deleteBookmark(currentCategoryId, bm.id);
      showToast(`Deleted "${bm.name}"`, undo);
      renderLauncherContent();
    }
  });

  menu.appendChild(openNewTabBtn);
  menu.appendChild(pinBtn);
  menu.appendChild(divider1);
  menu.appendChild(moveSubmenuWrapper);
  menu.appendChild(editBtn);
  menu.appendChild(divider2);
  menu.appendChild(deleteBtn);

  // Position relative to target
  positionAndMountContextMenu(menu, e);
}

/**
 * Context popover for a folder (macOS / Windows 11 Acrylic style).
 * @param {MouseEvent} e
 * @param {import('../core/schema.js').Category} cat
 */
function openFolderContextMenu(e, cat) {
  const menu = el('div', { className: 'launcher-context-menu', role: 'menu' });

  // Open as Tab Group
  const openTabsBtn = el('button', {
    type: 'button',
    role: 'menuitem',
    className: 'launcher-menu-item',
    html: `${ICON_TABS_GROUP}<span class="launcher-menu-item-text">Open as Tab Group</span>`,
    onclick: () => {
      closeContextMenu();
      openCollectionAsGroup(cat);
    }
  });

  // Pin Folder Apps to Dock
  const pinFolderBtn = el('button', {
    type: 'button',
    role: 'menuitem',
    className: 'launcher-menu-item',
    html: `${ICON_PIN}<span class="launcher-menu-item-text">Pin Apps to Dock</span>`,
    title: 'Pin all bookmarks in this folder to the floating dock',
    onclick: () => {
      closeContextMenu();
      const bms = Array.isArray(cat.bookmarks) ? cat.bookmarks : [];
      if (bms.length === 0) {
        showToast(`Folder "${cat.name}" has no apps to pin`);
        return;
      }
      let pinnedCount = 0;
      for (const b of bms) {
        if (!isBookmarkPinned(b.id)) {
          const res = pinBookmark(b.id);
          if (res.success && !res.alreadyPinned) {
            pinnedCount++;
          }
        }
      }
      if (pinnedCount > 0) {
        showToast(`Pinned ${pinnedCount} apps from "${cat.name}" to dock`);
        renderLauncherContent();
      } else {
        showToast(`All apps from "${cat.name}" are already on dock or limit reached`);
      }
    }
  });

  // Edit Folder
  const editBtn = el('button', {
    type: 'button',
    role: 'menuitem',
    className: 'launcher-menu-item',
    html: `${ICON_EDIT}<span class="launcher-menu-item-text">Edit Folder...</span>`,
    onclick: () => {
      closeContextMenu();
      openCategoryDialog({
        mode: 'edit',
        category: cat,
        onSave: (catData) => {
          store.updateCategory(cat.id, catData);
          showToast(`Updated folder "${catData.name}"`);
          renderLauncherContent();
        }
      });
    }
  });

  const divider = el('div', { className: 'launcher-menu-divider', role: 'separator' });

  // Delete Folder
  const deleteBtn = el('button', {
    type: 'button',
    role: 'menuitem',
    className: 'launcher-menu-item launcher-menu-danger',
    html: `${ICON_TRASH}<span class="launcher-menu-item-text">Delete Folder</span>`,
    onclick: () => {
      closeContextMenu();
      openConfirmDialog({
        title: `Delete Folder "${cat.name}"?`,
        message: `This will remove the folder and all ${cat.bookmarks?.length || 0} bookmarks inside it.`,
        confirmText: 'Delete Folder',
        onConfirm: () => {
          const undo = store.deleteCategory(cat.id);
          showToast(`Deleted "${cat.name}"`, undo);
          renderLauncherContent();
        }
      });
    }
  });

  menu.appendChild(openTabsBtn);
  menu.appendChild(pinFolderBtn);
  menu.appendChild(editBtn);
  menu.appendChild(divider);
  menu.appendChild(deleteBtn);

  positionAndMountContextMenu(menu, e);
}

let activeContextMenu = null;

export function closeContextMenu() {
  if (activeContextMenu && activeContextMenu.parentNode) {
    activeContextMenu.parentNode.removeChild(activeContextMenu);
  }
  activeContextMenu = null;
}

export function positionAndMountContextMenu(menu, e) {
  closeContextMenu();
  activeContextMenu = menu;

  const target = /** @type {HTMLElement} */ (e.currentTarget);
  const targetRect = target.getBoundingClientRect();

  // Target container: launcherModal dialog to be in the top-layer context
  const modal = launcherModal || document.body;
  const modalRect = modal.getBoundingClientRect();

  // Compute position relative to launcherModal dialog or viewport
  const offsetTop = targetRect.bottom - modalRect.top + 6;
  const offsetLeft = targetRect.left - modalRect.left - 60;

  menu.style.position = 'absolute';
  menu.style.top = `${Math.max(10, Math.min(modal.clientHeight - 240, offsetTop))}px`;
  menu.style.left = `${Math.max(10, Math.min(modal.clientWidth - 220, offsetLeft))}px`;
  menu.style.zIndex = '1200';

  // Prevent clicks inside context menu from bubbling and closing the menu
  menu.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  const backdropListener = (event) => {
    if (!menu.contains(event.target)) {
      closeContextMenu();
      document.removeEventListener('click', backdropListener, true);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', backdropListener, true);
  }, 10);

  modal.appendChild(menu);
}

/**
 * Renders an expanded view for a selected folder.
 * @param {HTMLElement} container
 * @param {import('../core/schema.js').Category} category
 * @param {import('../core/schema.js').Category[]} categories
 * @param {import('../core/schema.js').DashboardData} state
 * @param {string} activeSpaceId
 */
function renderExpandedFolderView(container, category, categories, state, activeSpaceId) {
  const bookmarks = Array.isArray(category.bookmarks) ? category.bookmarks : [];

  const moveAppOutsideToStandalone = () => {
    if (draggedItemInfo && draggedItemInfo.bookmarkId) {
      const quickCat = ensureUncategorizedCategory(state, activeSpaceId);
      store.moveBookmark(category.id, quickCat.id, draggedItemInfo.bookmarkId);
      showToast('Moved app outside to Standalone Apps');
      launcherModal?.classList.remove('is-dragging-item');
      renderLauncherContent();
    }
    draggedItemInfo = null;
  };

  const backBtn = el('button', {
    type: 'button',
    className: 'launcher-back-btn',
    title: 'Back to all folders and apps (or drop an app here to move outside)',
    onclick: () => {
      activeFolderCategory = null;
      renderLauncherContent();
    }
  },
    el('span', { className: 'launcher-back-arrow', html: ICON_ARROW_LEFT }),
    el('span', { text: 'Back' })
  );

  backBtn.addEventListener('dragover', (e) => {
    e.preventDefault();
    backBtn.classList.add('drop-target-active');
  });
  backBtn.addEventListener('dragleave', () => {
    backBtn.classList.remove('drop-target-active');
  });
  backBtn.addEventListener('drop', (e) => {
    e.preventDefault();
    backBtn.classList.remove('drop-target-active');
    moveAppOutsideToStandalone();
  });

  const openGroupBtn = el('button', {
    type: 'button',
    className: 'launcher-btn-subtle',
    title: 'Open all links in this folder as a browser tab group',
    html: `${ICON_TABS_GROUP}<span>Open Tab Group</span>`,
    onclick: () => {
      openCollectionAsGroup(category);
    }
  });

  const pinAllBtn = el('button', {
    type: 'button',
    className: 'launcher-btn-subtle',
    html: `${ICON_PIN}<span>Pin to Dock</span>`,
    title: 'Pin all apps in this folder to the floating dock',
    onclick: () => {
      if (bookmarks.length === 0) {
        showToast(`Folder "${category.name}" has no apps to pin`);
        return;
      }
      let pinnedCount = 0;
      for (const b of bookmarks) {
        if (!isBookmarkPinned(b.id)) {
          const res = pinBookmark(b.id);
          if (res.success && !res.alreadyPinned) {
            pinnedCount++;
          }
        }
      }
      if (pinnedCount > 0) {
        showToast(`Pinned ${pinnedCount} apps to dock`);
        renderLauncherContent();
      } else {
        showToast('All apps are already on dock or limit reached');
      }
    }
  });

  const editFolderBtn = el('button', {
    type: 'button',
    className: 'launcher-btn-subtle launcher-btn-icon-only',
    title: 'Edit folder name & icon',
    'aria-label': 'Edit folder',
    html: ICON_EDIT,
    onclick: () => {
      openCategoryDialog({
        mode: 'edit',
        category,
        onSave: (catData) => {
          store.updateCategory(category.id, catData);
          showToast(`Updated "${catData.name}"`);
          renderLauncherContent();
        }
      });
    }
  });

  const addBmBtn = el('button', {
    type: 'button',
    className: 'launcher-btn-accent',
    html: `${ICON_PLUS}<span>Add App</span>`,
    onclick: () => {
      openBookmarkDialog({
        mode: 'add',
        categoryId: category.id,
        onSave: (bmData) => {
          const added = store.addBookmark(category.id, bmData);
          if (bmData.pinned && added?.id) {
            pinBookmark(added.id);
          }
          showToast(`Added "${bmData.name}"`);
          renderLauncherContent();
          return added;
        }
      });
    }
  });

  // Drop bar: only shown while actively dragging an app tile
  const moveOutPrompt = el('div', {
    className: 'launcher-folder-drop-outside-bar',
    title: 'Drag an app here to remove it from this folder into Standalone Apps'
  },
    el('span', { className: 'launcher-drop-outside-text', html: `${ICON_TIP}<span>Drop here to move app outside of "${category.name}"</span>` })
  );

  moveOutPrompt.addEventListener('dragover', (e) => {
    e.preventDefault();
    moveOutPrompt.classList.add('drop-target-active');
  });
  moveOutPrompt.addEventListener('dragleave', (e) => {
    if (!moveOutPrompt.contains(/** @type {Node} */ (e.relatedTarget))) {
      moveOutPrompt.classList.remove('drop-target-active');
    }
  });
  moveOutPrompt.addEventListener('drop', (e) => {
    e.preventDefault();
    moveOutPrompt.classList.remove('drop-target-active');
    moveAppOutsideToStandalone();
  });

  const headerLeft = el('div', { className: 'launcher-folder-header-left' },
    backBtn,
    el('span', { className: 'launcher-breadcrumb-sep', 'aria-hidden': 'true' }),
    el('div', { className: 'launcher-folder-view-title' },
      el('span', { className: 'launcher-folder-title-icon', html: getIconSvg(category.icon || 'folder', 17) }),
      el('span', { className: 'launcher-folder-title-name', text: category.name }),
      el('span', { className: 'launcher-folder-title-badge', text: `${bookmarks.length} ${bookmarks.length === 1 ? 'app' : 'apps'}` })
    )
  );

  const header = el('div', { className: 'launcher-folder-view-header' },
    headerLeft,
    el('div', { className: 'launcher-folder-view-actions' }, openGroupBtn, pinAllBtn, editFolderBtn, addBmBtn)
  );

  const grid = el('div', { className: 'launcher-grid launcher-apps-grid' });

  if (bookmarks.length === 0) {
    const emptyPrompt = el('div', {
      className: 'launcher-empty-folder-box',
      text: 'This folder is empty. Drag apps here or click "+ Add App" above.'
    });
    grid.appendChild(emptyPrompt);
  } else {
    bookmarks.forEach((bm) => {
      const tile = createDraggableAppTile(bm, category.id, state, categories);
      grid.appendChild(tile);
    });
  }

  const view = el('div', { className: 'launcher-folder-view' },
    header,
    moveOutPrompt,
    grid
  );
  container.appendChild(view);
}

/**
 * Renders filtered search results across all collections and apps.
 * @param {HTMLElement} container
 * @param {import('../core/schema.js').Category[]} categories
 * @param {import('../core/schema.js').DashboardData} state
 */
function renderFilteredResults(container, categories, state) {
  const matches = [];
  categories.forEach((cat) => {
    (cat.bookmarks || []).forEach((bm) => {
      const matchName = (bm.name || '').toLowerCase().includes(currentSearchQuery);
      const matchUrl = (bm.url || '').toLowerCase().includes(currentSearchQuery);
      if (matchName || matchUrl) {
        matches.push({ bookmark: bm, category: cat });
      }
    });
  });

  const title = el('div', { className: 'launcher-section-title' },
    el('span', { className: 'launcher-section-label', text: `Search Results` }),
    el('span', { className: 'launcher-section-count', text: `${matches.length} matching apps` })
  );

  if (matches.length === 0) {
    container.appendChild(title);
    container.appendChild(el('div', {
      className: 'launcher-search-empty-state',
      text: `No apps or bookmarks matching "${currentSearchQuery}".`
    }));
    return;
  }

  const grid = el('div', { className: 'launcher-grid launcher-apps-grid' });

  matches.forEach(({ bookmark, category }) => {
    const tile = createDraggableAppTile(bookmark, category.id, state, categories);
    grid.appendChild(tile);
  });

  container.appendChild(title);
  container.appendChild(grid);
}
