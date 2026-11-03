// @ts-check
import { el, clearChildren } from '../utils/dom.js';
import { createFaviconElement } from './favicons.js';
import { getDomainFromUrl } from '../utils/url.js';
import { store } from '../core/state.js';
import { openCategoryDialog, openBookmarkDialog, openConfirmDialog } from './dialogs.js';
import { showToast } from './toasts.js';
import { attachCategoryDnD, attachBookmarkDnD, attachCategoryListDrop, announceReorder } from '../features/dnd.js';
import { startInlineRename } from '../features/edit-mode.js';
import { isBookmarkPinned, togglePinBookmark, pinBookmark, openAllCollectionLinks } from '../features/pinned.js';
import { openMoveCategoryToSpaceDialog } from '../features/spaces.js';
import { openAddManyDialog, getSelectedBookmarkIds } from '../features/bulk-ops.js';
import { renderBookmarkIcon } from '../features/custom-icons.js';
import { resolveCategoryDisplayMode } from '../features/display.js';
import { openCollectionAsGroup, saveCurrentTabs, formatSavedBadgeDate } from '../features/tab-groups.js';
import {
  ICON_MORE_VERTICAL,
  ICON_GRIP_VERTICAL,
  ICON_PIN,
  ICON_PLUS,
  ICON_CHEVRON_DOWN,
  ICON_CHEVRON_RIGHT,
  ICON_EDIT,
  ICON_TRASH,
  ICON_TABS_GROUP,
  ICON_SAVE_TABS,
  ICON_EXTERNAL_LINK,
  ICON_SORT_AZ,
  ICON_MOVE,
  ICON_ARROW_UP,
  ICON_ARROW_DOWN,
  ICON_CHECK,
  ICON_REFRESH,
  getIconSvg
} from './icons.js';

let activeMenu = null;
let activeMenuTrigger = null;

// Close active menu when clicking outside
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (activeMenu && !activeMenu.contains(e.target)) {
      closeActiveMenu(false);
    }
  });
}

/**
 * Closes the active contextual menu and syncs trigger aria-expanded.
 * @param {boolean} [returnFocus=false]
 */
export function closeActiveMenu(returnFocus = false) {
  if (activeMenuTrigger) {
    activeMenuTrigger.setAttribute('aria-expanded', 'false');
    if (returnFocus && typeof activeMenuTrigger.focus === 'function') {
      activeMenuTrigger.focus();
    }
  }
  if (activeMenu && activeMenu.parentNode) {
    activeMenu.parentNode.removeChild(activeMenu);
  }
  activeMenu = null;
  activeMenuTrigger = null;
}

/**
 * Renders a single bookmark row.
 * @param {import('../core/schema.js').Bookmark} bookmark
 * @param {string} categoryId
 * @param {number} bmIndex
 * @param {number} totalBookmarks
 * @returns {HTMLElement}
 */
export function renderBookmarkItem(bookmark, categoryId, bmIndex, totalBookmarks) {
  const domain = getDomainFromUrl(bookmark.url);
  const favicon = renderBookmarkIcon(bookmark);

  // Edit mode drag handle & checkbox
  const dragHandle = el('span', {
    className: 'drag-handle bookmark-drag-handle',
    'aria-hidden': 'true',
    title: 'Drag to reorder',
    html: ICON_GRIP_VERTICAL
  });

  const isSelected = typeof getSelectedBookmarkIds === 'function' ? getSelectedBookmarkIds().has(bookmark.id) : false;
  const selectCheckbox = el('input', {
    type: 'checkbox',
    className: 'bookmark-select-checkbox',
    'aria-label': `Select ${bookmark.name}`
  });
  if (isSelected) {
    /** @type {HTMLInputElement} */ (selectCheckbox).checked = true;
  }

  const nameSpan = el('span', { className: 'bookmark-name', text: bookmark.name });

  // Double-click inline rename
  nameSpan.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startInlineRename(nameSpan, {
      initialValue: bookmark.name,
      onSave: (newName) => {
        store.updateBookmark(categoryId, bookmark.id, { name: newName });
        showToast(`Renamed to "${newName}"`);
      }
    });
  });

  const state = store.getState ? store.getState() : store.get();
  const openIn = state?.settings?.behavior?.openIn || 'same';

  const link = el('a', {
    className: 'bookmark-link',
    href: bookmark.url,
    target: openIn === 'new' ? '_blank' : '_self',
    rel: openIn === 'new' ? 'noopener noreferrer' : undefined,
    title: bookmark.url,
    dataset: { tooltip: bookmark.url },
    'aria-label': `${bookmark.name} (${bookmark.url})`
  },
    favicon,
    el('div', { className: 'bookmark-details' },
      nameSpan,
      domain ? el('span', { className: 'bookmark-domain', text: domain }) : null
    )
  );

  // Keyboard reorder: Move Up button (accessible)
  const moveUpBtn = bmIndex > 0 ? el('button', {
    className: 'bookmark-action-btn reorder-btn',
    type: 'button',
    'aria-label': `Move ${bookmark.name} up`,
    title: 'Move up',
    html: ICON_ARROW_UP,
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      store.reorderBookmarks(categoryId, bmIndex, bmIndex - 1);
      announceReorder(`Moved ${bookmark.name} to position ${bmIndex} of ${totalBookmarks}`);
    }
  }) : null;

  // Keyboard reorder: Move Down button (accessible)
  const moveDownBtn = bmIndex < totalBookmarks - 1 ? el('button', {
    className: 'bookmark-action-btn reorder-btn',
    type: 'button',
    'aria-label': `Move ${bookmark.name} down`,
    title: 'Move down',
    html: ICON_ARROW_DOWN,
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      store.reorderBookmarks(categoryId, bmIndex, bmIndex + 1);
      announceReorder(`Moved ${bookmark.name} to position ${bmIndex + 2} of ${totalBookmarks}`);
    }
  }) : null;

  // Edit Bookmark button
  const editBtn = el('button', {
    className: 'bookmark-action-btn edit-btn',
    type: 'button',
    'aria-label': `Edit bookmark ${bookmark.name}`,
    title: 'Edit bookmark',
    html: ICON_EDIT,
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      openBookmarkDialog({
        mode: 'edit',
        categoryId,
        bookmark,
        onSave: (data) => {
          store.updateBookmark(categoryId, bookmark.id, data);
          showToast(`Updated "${data.name}"`);
        }
      });
    }
  });

  // Delete Bookmark button
  const deleteBtn = el('button', {
    className: 'bookmark-action-btn delete',
    type: 'button',
    'aria-label': `Delete bookmark ${bookmark.name}`,
    title: 'Delete bookmark',
    html: ICON_TRASH,
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const undo = store.deleteBookmark(categoryId, bookmark.id);
      showToast(`Deleted "${bookmark.name}"`, undo);
    }
  });

  // Pin Bookmark button
  const isPinned = isBookmarkPinned(bookmark.id);
  const pinBtn = el('button', {
    className: `bookmark-action-btn pin-btn${isPinned ? ' is-pinned' : ''}`,
    type: 'button',
    'aria-label': isPinned ? `Unpin ${bookmark.name} from navbar` : `Pin ${bookmark.name} to navbar`,
    title: isPinned ? 'Unpin from navbar (dock)' : 'Pin to navbar (dock)',
    html: ICON_PIN,
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const res = togglePinBookmark(bookmark.id);
      if (res.success) {
        showToast(res.pinned ? `Pinned "${bookmark.name}" to navbar` : `Unpinned "${bookmark.name}" from navbar`);
      } else {
        showToast(res.reason || 'Could not pin to navbar');
      }
    }
  });

  const actions = el('div', { className: 'bookmark-actions' });
  if (moveUpBtn) actions.appendChild(moveUpBtn);
  if (moveDownBtn) actions.appendChild(moveDownBtn);
  actions.appendChild(pinBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  const item = el('li', {
    className: 'bookmark-item',
    dataset: { id: bookmark.id }
  }, dragHandle, selectCheckbox, link, actions);

  // F2 inline rename shortcut
  item.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      e.stopPropagation();
      startInlineRename(nameSpan, {
        initialValue: bookmark.name,
        onSave: (newName) => {
          store.updateBookmark(categoryId, bookmark.id, { name: newName });
          showToast(`Renamed to "${newName}"`);
        }
      });
    }
  });

  // Attach drag-and-drop handler
  attachBookmarkDnD(item, bookmark, categoryId, bmIndex);

  return item;
}

/**
 * Opens the contextual actions menu for a category card.
 * @param {HTMLElement} triggerBtn
 * @param {import('../core/schema.js').Category} category
 * @param {number} categoryIndex
 * @param {number} totalCategories
 */
function openCategoryMenu(triggerBtn, category, categoryIndex, totalCategories) {
  closeActiveMenu();

  activeMenuTrigger = triggerBtn;
  triggerBtn.setAttribute('aria-expanded', 'true');

  const menu = el('div', {
    className: 'menu-dropdown',
    role: 'menu',
    'aria-label': `${category.name} options`
  });

  // Keyboard reorder: Move left / up
  if (categoryIndex > 0) {
    const moveLeftItem = el('button', {
      className: 'menu-item',
      type: 'button',
      role: 'menuitem',
      html: `${ICON_ARROW_UP}<span>Move earlier</span>`,
      onclick: () => {
        closeActiveMenu();
        store.reorderCategories(categoryIndex, categoryIndex - 1);
        announceReorder(`Moved collection ${category.name} to position ${categoryIndex} of ${totalCategories}`);
      }
    });
    menu.appendChild(moveLeftItem);
  }

  // Keyboard reorder: Move right / down
  if (categoryIndex < totalCategories - 1) {
    const moveRightItem = el('button', {
      className: 'menu-item',
      type: 'button',
      role: 'menuitem',
      html: `${ICON_ARROW_DOWN}<span>Move later</span>`,
      onclick: () => {
        closeActiveMenu();
        store.reorderCategories(categoryIndex, categoryIndex + 1);
        announceReorder(`Moved collection ${category.name} to position ${categoryIndex + 2} of ${totalCategories}`);
      }
    });
    menu.appendChild(moveRightItem);
  }

  // Edit Category
  const editItem = el('button', {
    className: 'menu-item',
    type: 'button',
    role: 'menuitem',
    html: `${ICON_EDIT}<span>Edit collection</span>`,
    onclick: () => {
      closeActiveMenu();
      openCategoryDialog({
        mode: 'edit',
        category,
        onSave: (data) => {
          store.updateCategory(category.id, data);
          showToast(`Updated collection "${data.name}"`);
        }
      });
    }
  });
  menu.appendChild(editItem);

  // Add Bookmark
  const addItem = el('button', {
    className: 'menu-item',
    type: 'button',
    role: 'menuitem',
    html: `${ICON_PLUS}<span>Add bookmark</span>`,
    onclick: () => {
      closeActiveMenu();
      openBookmarkDialog({
        mode: 'add',
        categoryId: category.id,
        onSave: (data) => {
          const added = store.addBookmark(category.id, data);
          if (data.pinned && added?.id && !isBookmarkPinned(added.id)) {
            pinBookmark(added.id);
          }
          showToast(`Added "${data.name}" to ${category.name}`);
          return added;
        }
      });
    }
  });
  menu.appendChild(addItem);

  // Add Many Bookmarks
  const addManyItem = el('button', {
    className: 'menu-item',
    type: 'button',
    role: 'menuitem',
    html: `${ICON_PLUS}<span>Add many…</span>`,
    onclick: () => {
      closeActiveMenu();
      openAddManyDialog(category.id);
    }
  });
  menu.appendChild(addManyItem);

  // Pin all to navbar
  if (Array.isArray(category.bookmarks) && category.bookmarks.length > 0) {
    const pinAllItem = el('button', {
      className: 'menu-item',
      type: 'button',
      role: 'menuitem',
      html: `${ICON_PIN}<span>Pin all to navbar</span>`,
      onclick: () => {
        closeActiveMenu();
        let count = 0;
        for (const bm of category.bookmarks) {
          if (!isBookmarkPinned(bm.id)) {
            const res = pinBookmark(bm.id);
            if (res.success && !res.alreadyPinned) count++;
          }
        }
        if (count > 0) {
          showToast(`Pinned ${count} items to navbar`);
        } else {
          showToast('All items are already on navbar or limit reached');
        }
      }
    });
    menu.appendChild(pinAllItem);
  }

  // Sort A-Z (one-shot, undoable)
  if (Array.isArray(category.bookmarks) && category.bookmarks.length > 1) {
    const sortItem = el('button', {
      className: 'menu-item',
      type: 'button',
      role: 'menuitem',
      html: `${ICON_SORT_AZ}<span>Sort A–Z</span>`,
      onclick: () => {
        closeActiveMenu();
        const undo = store.sortCategoryBookmarks(category.id);
        showToast(`Sorted "${category.name}" A–Z`, undo);
      }
    });
    menu.appendChild(sortItem);
  }

  // Move to space (if > 1 spaces)
  const menuState = store.getState ? store.getState() : store.get();
  if (Array.isArray(menuState?.spaces) && menuState.spaces.length > 1) {
    const moveToSpaceItem = el('button', {
      className: 'menu-item',
      type: 'button',
      role: 'menuitem',
      html: `${ICON_MOVE}<span>Move to space…</span>`,
      onclick: () => {
        closeActiveMenu();
        openMoveCategoryToSpaceDialog(category);
      }
    });
    menu.appendChild(moveToSpaceItem);
  }

  // Open All Links
  if (Array.isArray(category.bookmarks) && category.bookmarks.length > 0) {
    const openAllItem = el('button', {
      className: 'menu-item',
      type: 'button',
      role: 'menuitem',
      html: `${ICON_EXTERNAL_LINK}<span>Open all links (${category.bookmarks.length})</span>`,
      onclick: () => {
        closeActiveMenu();
        openAllCollectionLinks(category.bookmarks);
      }
    });
    menu.appendChild(openAllItem);

    // Open as native Tab Group
    const openGroupItem = el('button', {
      className: 'menu-item',
      type: 'button',
      role: 'menuitem',
      html: `${ICON_TABS_GROUP}<span>Open as tab group</span>`,
      onclick: () => {
        closeActiveMenu();
        openCollectionAsGroup(category);
      }
    });
    menu.appendChild(openGroupItem);
  }

  // Save tabs here
  const saveTabsHereItem = el('button', {
    className: 'menu-item',
    type: 'button',
    role: 'menuitem',
    html: `${ICON_SAVE_TABS}<span>Save tabs here</span>`,
    onclick: () => {
      closeActiveMenu();
      saveCurrentTabs({ targetCategoryId: category.id });
    }
  });
  menu.appendChild(saveTabsHereItem);

  // 4.3 Display mode per-collection override
  const displayModes = [
    { id: 'list', label: 'View: List' },
    { id: 'grid', label: 'View: Grid' },
    { id: 'icons', label: 'View: Icons' }
  ];
  displayModes.forEach(m => {
    const isCurrent = category.displayMode === m.id;
    const item = el('button', {
      className: `menu-item${isCurrent ? ' is-active' : ''}`,
      type: 'button',
      role: 'menuitem',
      html: `${isCurrent ? ICON_CHECK : '<span style="width:14px;display:inline-block"></span>'}<span>${m.label}</span>`,
      onclick: () => {
        closeActiveMenu();
        store.updateCategory(category.id, { displayMode: m.id });
        showToast(`Switched "${category.name}" to ${m.id} view`);
      }
    });
    menu.appendChild(item);
  });
  if (category.displayMode) {
    const resetDisplayItem = el('button', {
      className: 'menu-item',
      type: 'button',
      role: 'menuitem',
      html: `${ICON_REFRESH}<span>Reset view to default</span>`,
      onclick: () => {
        closeActiveMenu();
        store.updateCategory(category.id, { displayMode: null });
        showToast(`Reset "${category.name}" to default view`);
      }
    });
    menu.appendChild(resetDisplayItem);
  }

  // Delete Category
  const deleteItem = el('button', {
    className: 'menu-item danger',
    type: 'button',
    role: 'menuitem',
    html: `${ICON_TRASH}<span>Delete collection</span>`,
    onclick: () => {
      closeActiveMenu();
      openConfirmDialog({
        title: 'Delete Collection?',
        message: `Are you sure you want to delete "${category.name}" and its ${category.bookmarks.length} bookmark(s)?`,
        confirmText: 'Delete Collection',
        onConfirm: () => {
          const undo = store.deleteCategory(category.id);
          showToast(`Deleted collection "${category.name}"`, undo);
        }
      });
    }
  });
  menu.appendChild(deleteItem);

  // Keys: ArrowUp/ArrowDown/Home/End move focus; Escape closes and returns focus to trigger; Tab closes it
  menu.addEventListener('keydown', (e) => {
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      const nextIndex = (currentIndex + 1) % items.length;
      items[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      const prevIndex = (currentIndex - 1 + items.length) % items.length;
      items[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      closeActiveMenu(true);
    } else if (e.key === 'Tab') {
      closeActiveMenu(false);
    }
  });

  document.body.appendChild(menu);
  activeMenu = menu;

  const rect = triggerBtn.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const viewportWidth = (typeof window !== 'undefined' ? window.innerWidth : 1024) || 1024;
  const viewportHeight = (typeof window !== 'undefined' ? window.innerHeight : 768) || 768;
  const scrollY = (typeof window !== 'undefined' ? window.scrollY : 0) || 0;
  const scrollX = (typeof window !== 'undefined' ? window.scrollX : 0) || 0;

  let top = rect.bottom + 4;
  if (top + (menuRect.height || 180) > viewportHeight - 8) {
    top = Math.max(8, rect.top - (menuRect.height || 180) - 4);
  }

  let left = rect.right - (menuRect.width || 160);
  left = Math.max(8, Math.min(left, viewportWidth - (menuRect.width || 160) - 8));

  menu.style.top = `${top + scrollY}px`;
  menu.style.left = `${left + scrollX}px`;

  // Focus the first item on open
  const firstItem = menu.querySelector('[role="menuitem"]');
  firstItem?.focus();
}

/**
 * Renders a category card.
 * @param {import('../core/schema.js').Category} category
 * @param {number} categoryIndex
 * @param {number} totalCategories
 * @returns {HTMLElement}
 */
export function renderCategoryCard(category, categoryIndex, totalCategories) {
  const isCollapsed = Boolean(category.collapsed);
  const bookmarkCount = Array.isArray(category.bookmarks) ? category.bookmarks.length : 0;

  // Header Title Group
  const catDragHandle = el('span', {
    className: 'drag-handle category-drag-handle',
    'aria-hidden': 'true',
    title: 'Drag collection',
    html: ICON_GRIP_VERTICAL
  });

  const catNameEl = el('h3', { className: 'category-name', text: category.name });
  catNameEl.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startInlineRename(catNameEl, {
      initialValue: category.name,
      onSave: (newName) => {
        store.updateCategory(category.id, { name: newName });
        showToast(`Renamed collection "${newName}"`);
      }
    });
  });

  let colorDot = null;
  if (category.color) {
    colorDot = el('span', {
      className: `category-color-dot color-${category.color}`,
      'aria-hidden': 'true',
      title: `Color: ${category.color}`,
      dataset: { color: category.color }
    });
  }

  const titleChildren = [
    catDragHandle,
    el('span', { className: 'category-icon', html: getIconSvg(category.icon || 'folder', 15) }),
    catNameEl
  ];
  if (colorDot) titleChildren.push(colorDot);
  titleChildren.push(el('span', { className: 'category-count', text: `(${bookmarkCount})` }));

  if (category.source === 'tabs') {
    const dateStr = formatSavedBadgeDate(category.savedAt);
    const badgeText = dateStr ? `Saved from tabs · ${dateStr}` : 'Saved from tabs';
    titleChildren.push(el('span', {
      className: 'saved-from-tabs-badge',
      title: category.savedAt ? `Saved from browser tabs on ${new Date(category.savedAt).toLocaleString()}` : 'Saved from browser tabs',
      text: badgeText
    }));
  }

  const titleGroup = el('div', { className: 'category-title-group' }, ...titleChildren);

  // Quick Add Bookmark Button
  const quickAddBtn = el('button', {
    className: 'icon-action-btn quick-add-btn',
    type: 'button',
    'aria-label': `Add bookmark to ${category.name}`,
    title: 'Add bookmark',
    text: '+',
    html: ICON_PLUS,
    onclick: (e) => {
      e.stopPropagation();
      openBookmarkDialog({
        mode: 'add',
        categoryId: category.id,
        onSave: (data) => {
          const added = store.addBookmark(category.id, data);
          if (data.pinned && added?.id && !isBookmarkPinned(added.id)) {
            pinBookmark(added.id);
          }
          showToast(`Added "${data.name}" to ${category.name}`);
          return added;
        }
      });
    }
  });

  // Card Menu Trigger
  const menuBtn = el('button', {
    className: 'icon-action-btn',
    type: 'button',
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
    'aria-label': `Options for ${category.name}`,
    title: 'Collection options',
    html: ICON_MORE_VERTICAL,
    onclick: (e) => {
      e.stopPropagation();
      openCategoryMenu(menuBtn, category, categoryIndex, totalCategories);
    }
  });

  const listId = `bookmarks-list-${category.id}`;

  // Collapse / Expand trigger
  const collapseBtn = el('button', {
    className: 'icon-action-btn card-collapse-btn',
    type: 'button',
    'aria-label': `Toggle ${category.name}`,
    'aria-expanded': isCollapsed ? 'false' : 'true',
    'aria-controls': listId,
    title: isCollapsed ? 'Expand' : 'Collapse',
    html: isCollapsed ? ICON_CHEVRON_RIGHT : ICON_CHEVRON_DOWN,
    onclick: () => {
      store.toggleCategoryCollapse(category.id);
    }
  });

  const header = el('header', { className: 'category-header', title: 'Drag to reorder collection' },
    titleGroup,
    el('div', { className: 'category-actions' }, quickAddBtn, menuBtn, collapseBtn)
  );

  header.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      e.stopPropagation();
      startInlineRename(catNameEl, {
        initialValue: category.name,
        onSave: (newName) => {
          store.updateCategory(category.id, { name: newName });
          showToast(`Renamed collection "${newName}"`);
        }
      });
    }
  });

  // Bookmarks List
  const appState = store.getState ? store.getState() : (store.get ? store.get() : null);
  const displayMode = resolveCategoryDisplayMode(category, appState?.settings);
  const list = el('ul', {
    className: 'bookmarks-list',
    id: listId,
    dataset: { displayMode }
  });
  list.setAttribute('data-display-mode', displayMode);
  if (Array.isArray(category.bookmarks)) {
    const sorted = [...category.bookmarks].sort((a, b) => a.order - b.order);
    sorted.forEach((bm, bIdx) => {
      list.appendChild(renderBookmarkItem(bm, category.id, bIdx, sorted.length));
    });
  }

  // Attach drop listener to empty space on category list
  attachCategoryListDrop(list, category.id);

  // Footer with Add Bookmark trigger
  const addBookmarkBtn = el('button', {
    className: 'add-bookmark-btn',
    type: 'button',
    html: `${ICON_PLUS}<span>Add</span>`,
    onclick: () => {
      openBookmarkDialog({
        mode: 'add',
        categoryId: category.id,
        onSave: (data) => {
          const added = store.addBookmark(category.id, data);
          if (data.pinned && added?.id && !isBookmarkPinned(added.id)) {
            pinBookmark(added.id);
          }
          showToast(`Added "${data.name}"`);
          return added;
        }
      });
    }
  });

  const footer = el('footer', { className: 'card-footer' }, addBookmarkBtn);

  const bodyInner = el('div', { className: 'card-collapsible-inner' }, list, footer);
  const bodyWrapper = el('div', { className: 'card-collapsible-wrapper' }, bodyInner);

  const card = el('article', {
    className: `category-card${isCollapsed ? ' collapsed' : ''}`,
    dataset: {
      id: category.id,
      color: category.color || undefined
    }
  }, header, bodyWrapper);

  // Attach category drag and drop
  attachCategoryDnD(card, category, categoryIndex);

  return card;
}

/**
 * Renders an empty dashboard state when no categories exist.
 * @returns {HTMLElement}
 */
export function renderEmptyState() {
  const addBtn = el('button', {
    className: 'btn-primary',
    type: 'button',
    html: `${ICON_PLUS}<span>Create collection</span>`,
    onclick: () => {
      openCategoryDialog({
        mode: 'add',
        onSave: (data) => {
          store.addCategory(data);
          showToast(`Created collection "${data.name}"`);
        }
      });
    }
  });

  return el('div', { className: 'dashboard-empty' },
    el('h2', { text: 'Your dashboard is empty' }),
    el('p', { text: 'Create your first collection to organize your bookmarks into a clean personal view.' }),
    addBtn
  );
}

/**
 * Mounts all categories into the target container.
 * @param {import('../core/schema.js').Category[]} categories
 * @param {HTMLElement} container
 */
export function renderCategoriesGrid(categories, container) {
  clearChildren(container);

  if (!categories || categories.length === 0) {
    container.appendChild(renderEmptyState());
    return;
  }

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);
  sortedCategories.forEach((cat, cIdx) => {
    container.appendChild(renderCategoryCard(cat, cIdx, sortedCategories.length));
  });
}

export const createBookmarkElement = renderBookmarkItem;

