// @ts-check
import { el, clearChildren } from '../utils/dom.js';
import { createFaviconElement } from './favicons.js';
import { getDomainFromUrl } from '../utils/url.js';
import { store } from '../core/state.js';
import { openCategoryDialog, openBookmarkDialog, openConfirmDialog } from './dialogs.js';
import { showToast } from './toasts.js';
import { attachCategoryDnD, attachBookmarkDnD, attachCategoryListDrop, announceReorder } from '../features/dnd.js';

let activeMenu = null;

// Close active menu when clicking outside
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (activeMenu && !activeMenu.contains(e.target)) {
      closeActiveMenu();
    }
  });
}

function closeActiveMenu() {
  if (activeMenu && activeMenu.parentNode) {
    activeMenu.parentNode.removeChild(activeMenu);
  }
  activeMenu = null;
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

  const link = el('a', {
    className: 'bookmark-link',
    href: bookmark.url,
    title: `${bookmark.name} (${bookmark.url})`
  },
    favicon,
    el('div', { className: 'bookmark-details' },
      el('span', { className: 'bookmark-name', text: bookmark.name }),
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

  const actions = el('div', { className: 'bookmark-actions' });
  if (moveUpBtn) actions.appendChild(moveUpBtn);
  if (moveDownBtn) actions.appendChild(moveDownBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  const item = el('li', {
    className: 'bookmark-item',
    dataset: { id: bookmark.id }
  }, link, actions);

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

  const menu = el('div', { className: 'menu-dropdown' });

  // Keyboard reorder: Move left / up
  if (categoryIndex > 0) {
    const moveLeftItem = el('button', {
      className: 'menu-item',
      type: 'button',
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

  // Delete Category
  const deleteItem = el('button', {
    className: 'menu-item danger',
    type: 'button',
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

  const rect = triggerBtn.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  menu.style.left = `${Math.max(10, rect.right + window.scrollX - 150)}px`;

  document.body.appendChild(menu);
  activeMenu = menu;
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
  const titleGroup = el('div', { className: 'category-title-group' },
    el('span', { className: 'category-icon', text: category.icon || '📁' }),
    el('h3', { className: 'category-name', text: category.name }),
    el('span', { className: 'category-count', text: `(${bookmarkCount})` })
  );

  // Card Menu Trigger
  const menuBtn = el('button', {
    className: 'icon-action-btn',
    type: 'button',
    'aria-label': `Options for ${category.name}`,
    title: 'Collection options',
    text: '⋮',
    onclick: (e) => {
      e.stopPropagation();
      openCategoryMenu(menuBtn, category, categoryIndex, totalCategories);
    }
  });

  // Collapse / Expand trigger
  const collapseBtn = el('button', {
    className: 'icon-action-btn',
    type: 'button',
    'aria-label': isCollapsed ? `Expand ${category.name}` : `Collapse ${category.name}`,
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

  // Bookmarks List
  const list = el('ul', { className: 'bookmarks-list' });
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
