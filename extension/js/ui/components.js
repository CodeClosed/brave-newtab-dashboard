// @ts-check
import { el, clearChildren } from '../utils/dom.js';
import { createFaviconElement } from './favicons.js';
import { getDomainFromUrl } from '../utils/url.js';
import { store } from '../core/state.js';
import { openCategoryDialog, openBookmarkDialog, openConfirmDialog } from './dialogs.js';
import { showToast } from './toasts.js';
import { attachCategoryDnD, attachBookmarkDnD, attachCategoryListDrop, announceReorder } from '../features/dnd.js';
import { startInlineRename, handleInlineAddBookmark } from '../features/edit-mode.js';
import { isBookmarkPinned, togglePinBookmark, openAllCollectionLinks } from '../features/pinned.js';
import { openMoveCategoryToSpaceDialog } from '../features/spaces.js';
import { openAddManyDialog } from '../features/bulk-ops.js';

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
  const favicon = createFaviconElement(bookmark.url, bookmark.name);

  // Edit mode drag handle & checkbox
  const dragHandle = el('span', {
    className: 'drag-handle bookmark-drag-handle',
    'aria-hidden': 'true',
    title: 'Drag to reorder',
    text: '⋮⋮'
  });

  const selectCheckbox = el('input', {
    type: 'checkbox',
    className: 'bookmark-select-checkbox',
    'aria-label': `Select ${bookmark.name}`
  });

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
    text: '↑',
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
    text: '↓',
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      store.reorderBookmarks(categoryId, bmIndex, bmIndex + 1);
      announceReorder(`Moved ${bookmark.name} to position ${bmIndex + 2} of ${totalBookmarks}`);
    }
  }) : null;

  // Edit Bookmark button
  const editBtn = el('button', {
    className: 'bookmark-action-btn',
    type: 'button',
    'aria-label': `Edit bookmark ${bookmark.name}`,
    title: 'Edit bookmark',
    text: '✎',
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
    text: '✕',
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
    'aria-label': isPinned ? `Unpin ${bookmark.name} from top` : `Pin ${bookmark.name} to top`,
    title: isPinned ? 'Unpin from top' : 'Pin to top',
    text: '📌',
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const res = togglePinBookmark(bookmark.id);
      if (res.success) {
        showToast(res.pinned ? `Pinned "${bookmark.name}"` : `Unpinned "${bookmark.name}"`);
      } else {
        showToast(res.reason || 'Could not pin');
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
      text: '↑ Move earlier',
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
      text: '↓ Move later',
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
    text: '✎ Edit collection',
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
    text: '+ Add bookmark',
    onclick: () => {
      closeActiveMenu();
      openBookmarkDialog({
        mode: 'add',
        categoryId: category.id,
        onSave: (data) => {
          store.addBookmark(category.id, data);
          showToast(`Added "${data.name}" to ${category.name}`);
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
    text: '+ Add many…',
    onclick: () => {
      closeActiveMenu();
      openAddManyDialog(category.id);
    }
  });
  menu.appendChild(addManyItem);

  // Sort A-Z (one-shot, undoable)
  if (Array.isArray(category.bookmarks) && category.bookmarks.length > 1) {
    const sortItem = el('button', {
      className: 'menu-item',
      type: 'button',
      role: 'menuitem',
      text: '🔤 Sort A–Z',
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
      text: '⇄ Move to space…',
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
      text: `↗ Open all links (${category.bookmarks.length})`,
      onclick: () => {
        closeActiveMenu();
        openAllCollectionLinks(category.bookmarks);
      }
    });
    menu.appendChild(openAllItem);
  }

  // Delete Category
  const deleteItem = el('button', {
    className: 'menu-item danger',
    type: 'button',
    role: 'menuitem',
    text: '✕ Delete collection',
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
    text: '⋮⋮'
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

  const titleGroup = el('div', { className: 'category-title-group' },
    catDragHandle,
    el('span', { className: 'category-icon', text: category.icon || '📁' }),
    catNameEl,
    el('span', { className: 'category-count', text: `(${bookmarkCount})` })
  );

  // Card Menu Trigger
  const menuBtn = el('button', {
    className: 'icon-action-btn',
    type: 'button',
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
    'aria-label': `Options for ${category.name}`,
    title: 'Collection options',
    text: '⋮',
    onclick: (e) => {
      e.stopPropagation();
      openCategoryMenu(menuBtn, category, categoryIndex, totalCategories);
    }
  });

  const listId = `bookmarks-list-${category.id}`;

  // Collapse / Expand trigger
  const collapseBtn = el('button', {
    className: 'icon-action-btn',
    type: 'button',
    'aria-label': `Toggle ${category.name}`,
    'aria-expanded': isCollapsed ? 'false' : 'true',
    'aria-controls': listId,
    title: isCollapsed ? 'Expand' : 'Collapse',
    text: isCollapsed ? '▸' : '▾',
    onclick: () => {
      store.toggleCategoryCollapse(category.id);
    }
  });

  const header = el('header', { className: 'category-header', title: 'Drag to reorder collection' },
    titleGroup,
    el('div', { className: 'category-actions' }, menuBtn, collapseBtn)
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
  const list = el('ul', { className: 'bookmarks-list', id: listId });
  if (Array.isArray(category.bookmarks)) {
    const sorted = [...category.bookmarks].sort((a, b) => a.order - b.order);
    sorted.forEach((bm, bIdx) => {
      list.appendChild(renderBookmarkItem(bm, category.id, bIdx, sorted.length));
    });
  }

  // Trailing "paste URL" inline add row
  const inlineAddInput = el('input', {
    className: 'inline-add-input',
    type: 'text',
    placeholder: 'Paste URL and press Enter...',
    'aria-label': `Add bookmark by URL to ${category.name}`
  });
  inlineAddInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const rawVal = inlineAddInput.value ? inlineAddInput.value.trim() : '';
      if (rawVal) {
        const res = handleInlineAddBookmark(category.id, rawVal, store);
        if (res.success) {
          showToast(`Added "${res.name}"`);
          inlineAddInput.value = '';
        } else {
          showToast(res.error || 'Invalid URL');
        }
      }
    } else if (e.key === 'Escape') {
      inlineAddInput.value = '';
      inlineAddInput.blur();
    }
  });
  const inlineAddRow = el('li', { className: 'inline-add-row' }, inlineAddInput);
  list.appendChild(inlineAddRow);

  // Attach drop listener to empty space on category list
  attachCategoryListDrop(list, category.id);

  // Footer with Add Bookmark trigger
  const addBookmarkBtn = el('button', {
    className: 'add-bookmark-btn',
    type: 'button',
    text: '+ Add',
    onclick: () => {
      openBookmarkDialog({
        mode: 'add',
        categoryId: category.id,
        onSave: (data) => {
          store.addBookmark(category.id, data);
          showToast(`Added "${data.name}"`);
        }
      });
    }
  });

  const footer = el('footer', { className: 'card-footer' }, addBookmarkBtn);

  const card = el('article', {
    className: `category-card${isCollapsed ? ' collapsed' : ''}`,
    dataset: { id: category.id }
  }, header, list, footer);

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
    text: '+ Create collection',
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

