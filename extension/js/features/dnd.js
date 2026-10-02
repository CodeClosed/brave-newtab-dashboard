// @ts-check
import { store } from '../core/state.js';

let draggedData = null;
let currentDropTarget = null;

/**
 * Announces a reordering event to screen readers via aria-live.
 * @param {string} message
 */
export function announceReorder(message) {
  let announcer = document.getElementById('reorder-announcer');
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'reorder-announcer';
    announcer.className = 'sr-only';
    announcer.setAttribute('aria-live', 'assertive');
    announcer.setAttribute('aria-atomic', 'true');
    document.body.appendChild(announcer);
  }
  announcer.textContent = '';
  // Timeout ensures screen readers register the text change
  setTimeout(() => {
    if (announcer) announcer.textContent = message;
  }, 50);
}

/**
 * Initializes drag and drop handlers on a category card element.
 * @param {HTMLElement} cardEl
 * @param {import('../core/schema.js').Category} category
 * @param {number} categoryIndex
 */
export function attachCategoryDnD(cardEl, category, categoryIndex) {
  const header = cardEl.querySelector('.category-header');
  if (!header) return;

  // Make header the drag handle
  header.setAttribute('draggable', 'true');

  header.addEventListener('dragstart', (e) => {
    draggedData = {
      type: 'category',
      categoryId: category.id,
      sourceIndex: categoryIndex
    };
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(draggedData));
    }
    cardEl.classList.add('is-dragging');
  });

  header.addEventListener('dragend', () => {
    cardEl.classList.remove('is-dragging');
    cleanupDropIndicators();
    draggedData = null;
  });

  cardEl.addEventListener('dragover', (e) => {
    if (!draggedData || draggedData.type !== 'category') return;
    if (draggedData.categoryId === category.id) return;

    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    cleanupDropIndicators();
    cardEl.classList.add('drop-target-card');
    currentDropTarget = cardEl;
  });

  cardEl.addEventListener('dragleave', (e) => {
    // Only remove if leaving the card entirely
    if (!cardEl.contains(/** @type {Node} */ (e.relatedTarget))) {
      cardEl.classList.remove('drop-target-card');
    }
  });

  cardEl.addEventListener('drop', (e) => {
    if (!draggedData || draggedData.type !== 'category') return;
    e.preventDefault();
    e.stopPropagation();

    const sourceIdx = draggedData.sourceIndex;
    const targetIdx = categoryIndex;

    cleanupDropIndicators();

    if (sourceIdx !== targetIdx) {
      store.reorderCategories(sourceIdx, targetIdx);
      const total = store.get().categories.length;
      announceReorder(`Moved collection ${category.name} to position ${targetIdx + 1} of ${total}`);
    }
  });
}

/**
 * Initializes drag and drop handlers on a bookmark row.
 * @param {HTMLElement} itemEl
 * @param {import('../core/schema.js').Bookmark} bookmark
 * @param {string} categoryId
 * @param {number} bookmarkIndex
 */
export function attachBookmarkDnD(itemEl, bookmark, categoryId, bookmarkIndex) {
  itemEl.setAttribute('draggable', 'true');

  itemEl.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    draggedData = {
      type: 'bookmark',
      bookmarkId: bookmark.id,
      bookmarkName: bookmark.name,
      sourceCategoryId: categoryId,
      sourceIndex: bookmarkIndex
    };
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(draggedData));
    }
    itemEl.classList.add('is-dragging');
  });

  itemEl.addEventListener('dragend', (e) => {
    e.stopPropagation();
    itemEl.classList.remove('is-dragging');
    cleanupDropIndicators();
    draggedData = null;
  });

  itemEl.addEventListener('dragover', (e) => {
    if (!draggedData || draggedData.type !== 'bookmark') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    cleanupDropIndicators();

    const rect = itemEl.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (e.clientY < midY) {
      itemEl.classList.add('drop-indicator-top');
    } else {
      itemEl.classList.add('drop-indicator-bottom');
    }
    currentDropTarget = itemEl;
  });

  itemEl.addEventListener('dragleave', () => {
    itemEl.classList.remove('drop-indicator-top', 'drop-indicator-bottom');
  });

  itemEl.addEventListener('drop', (e) => {
    if (!draggedData || draggedData.type !== 'bookmark') return;
    e.preventDefault();
    e.stopPropagation();

    const rect = itemEl.getBoundingClientRect();
    const isAbove = e.clientY < (rect.top + rect.height / 2);

    let targetIdx = bookmarkIndex;
    if (!isAbove) targetIdx += 1;

    const sourceCatId = draggedData.sourceCategoryId;
    const sourceIdx = draggedData.sourceIndex;
    const bmId = draggedData.bookmarkId;
    const bmName = draggedData.bookmarkName;

    cleanupDropIndicators();

    const targetCat = store.get().categories.find(c => c.id === categoryId);
    const targetCatName = targetCat?.name || 'collection';

    if (sourceCatId === categoryId) {
      // Reorder within same category
      // If moving downwards, adjust index for the spliced position
      const adjustedTargetIdx = sourceIdx < targetIdx ? targetIdx - 1 : targetIdx;
      store.reorderBookmarks(categoryId, sourceIdx, adjustedTargetIdx);
      announceReorder(`Moved ${bmName} to position ${adjustedTargetIdx + 1} in ${targetCatName}`);
    } else {
      // Move across categories
      store.moveBookmark(sourceCatId, categoryId, bmId, targetIdx);
      announceReorder(`Moved ${bmName} to ${targetCatName} at position ${targetIdx + 1}`);
    }
  });
}

/**
 * Allows dropping a bookmark onto an empty category list or card footer.
 * @param {HTMLElement} listEl
 * @param {string} categoryId
 */
export function attachCategoryListDrop(listEl, categoryId) {
  listEl.addEventListener('dragover', (e) => {
    if (!draggedData || draggedData.type !== 'bookmark') return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    listEl.classList.add('list-drop-hover');
  });

  listEl.addEventListener('dragleave', (e) => {
    if (!listEl.contains(/** @type {Node} */ (e.relatedTarget))) {
      listEl.classList.remove('list-drop-hover');
    }
  });

  listEl.addEventListener('drop', (e) => {
    if (!draggedData || draggedData.type !== 'bookmark') return;
    // Handled if dropped on a bookmark item; otherwise append to end of category
    if (e.target !== listEl && listEl.contains(/** @type {Node} */ (e.target))) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    listEl.classList.remove('list-drop-hover');

    const sourceCatId = draggedData.sourceCategoryId;
    const bmId = draggedData.bookmarkId;
    const bmName = draggedData.bookmarkName;

    if (sourceCatId !== categoryId) {
      store.moveBookmark(sourceCatId, categoryId, bmId, -1);
      const targetCat = store.get().categories.find(c => c.id === categoryId);
      announceReorder(`Moved ${bmName} to ${targetCat?.name || 'collection'}`);
    }
  });
}

function cleanupDropIndicators() {
  document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
  document.querySelectorAll('.drop-target-card').forEach(el => el.classList.remove('drop-target-card'));
  document.querySelectorAll('.drop-indicator-top').forEach(el => el.classList.remove('drop-indicator-top'));
  document.querySelectorAll('.drop-indicator-bottom').forEach(el => el.classList.remove('drop-indicator-bottom'));
  document.querySelectorAll('.list-drop-hover').forEach(el => el.classList.remove('list-drop-hover'));
}
