// @ts-check
import { normalizeUrl } from '../utils/url.js';
import { el, clearChildren } from '../utils/dom.js';
import { showToast } from '../ui/toasts.js';
import { subscribeEditMode, getEditMode } from './edit-mode.js';
import { createSnapshot } from '../core/snapshots.js';

/**
 * Parses multi-line input into valid and invalid bookmarks.
 * Supports "url" or "name | url" per line.
 *
 * @param {string} text
 * @returns {{ valid: Array<{ name: string, url: string }>, invalid: Array<{ line: string, error: string }> }}
 */
export function parseAddManyInput(text) {
  if (!text || typeof text !== 'string') {
    return { valid: [], invalid: [] };
  }

  const lines = text.split(/\r?\n/);
  /** @type {Array<{ name: string, url: string }>} */
  const valid = [];
  /** @type {Array<{ line: string, error: string }>} */
  const invalid = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let name = '';
    let urlStr = line;

    if (line.includes('|')) {
      const parts = line.split('|');
      name = parts[0].trim();
      urlStr = parts.slice(1).join('|').trim();
    }

    const norm = normalizeUrl(urlStr);
    if (!norm.valid) {
      invalid.push({ line, error: norm.error || 'Invalid URL' });
    } else {
      valid.push({
        name: name || norm.domain,
        url: norm.url
      });
    }
  }

  return { valid, invalid };
}

/**
 * Computes an inclusive array of integer indices between start and end.
 * @param {number} start
 * @param {number} end
 * @returns {number[]}
 */
export function getRangeSelectionIndices(start, end) {
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  const res = [];
  for (let i = min; i <= max; i++) {
    res.push(i);
  }
  return res;
}

/**
 * Deletes multiple bookmarks across categories with undo support.
 * @param {string[]} bookmarkIds
 * @param {any} targetStore
 * @returns {() => void}
 */
export function bulkDeleteBookmarks(bookmarkIds, targetStore) {
  const idSet = new Set(bookmarkIds);
  createSnapshot('Before bulk delete bookmarks', targetStore.get()).catch(() => {});
  const snapshot = JSON.parse(JSON.stringify(targetStore.get()));

  const data = targetStore.get();
  for (const cat of data.categories || []) {
    if (Array.isArray(cat.bookmarks)) {
      cat.bookmarks = cat.bookmarks.filter(b => !idSet.has(b.id));
      cat.bookmarks.forEach((b, idx) => { b.order = idx; });
    }
  }

  if (Array.isArray(data.spaces)) {
    data.spaces.forEach(sp => {
      if (Array.isArray(sp.pinned)) {
        sp.pinned = sp.pinned.filter(id => !idSet.has(id));
      }
    });
  }

  targetStore.queueSaveDashboardData ? targetStore.queueSaveDashboardData(data) : targetStore._notify();
  targetStore._notify();

  return () => {
    targetStore.replaceData(snapshot);
  };
}

/**
 * Moves multiple bookmarks to a target category with undo support.
 * @param {string[]} bookmarkIds
 * @param {string} targetCategoryId
 * @param {any} targetStore
 * @returns {() => void}
 */
export function bulkMoveBookmarks(bookmarkIds, targetCategoryId, targetStore) {
  const idSet = new Set(bookmarkIds);
  createSnapshot('Before bulk move bookmarks', targetStore.get()).catch(() => {});
  const snapshot = JSON.parse(JSON.stringify(targetStore.get()));

  const data = targetStore.get();
  const targetCat = data.categories?.find(c => c.id === targetCategoryId);
  if (!targetCat) return () => {};

  /** @type {any[]} */
  const movedBookmarks = [];

  for (const cat of data.categories || []) {
    if (cat.id === targetCategoryId) continue;
    if (Array.isArray(cat.bookmarks)) {
      const remaining = [];
      for (const bm of cat.bookmarks) {
        if (idSet.has(bm.id)) {
          movedBookmarks.push(bm);
        } else {
          remaining.push(bm);
        }
      }
      cat.bookmarks = remaining;
      cat.bookmarks.forEach((b, idx) => { b.order = idx; });
    }
  }

  for (const bm of movedBookmarks) {
    bm.order = targetCat.bookmarks.length;
    targetCat.bookmarks.push(bm);
  }

  targetStore.queueSaveDashboardData ? targetStore.queueSaveDashboardData(data) : targetStore._notify();
  targetStore._notify();

  return () => {
    targetStore.replaceData(snapshot);
  };
}

/**
 * Pins multiple bookmarks to the active space, capping at 8.
 * @param {string[]} bookmarkIds
 * @param {any} targetStore
 * @returns {{ pinnedCount: number, capped: boolean }}
 */
export function bulkPinBookmarks(bookmarkIds, targetStore) {
  const data = targetStore.get();
  const space = data.spaces?.find(s => s.id === data.activeSpaceId) || data.spaces?.[0];
  if (!space) return { pinnedCount: 0, capped: false };

  if (!Array.isArray(space.pinned)) {
    space.pinned = [];
  }

  let count = 0;
  let capped = false;

  for (const id of bookmarkIds) {
    if (!space.pinned.includes(id)) {
      if (space.pinned.length >= 8) {
        capped = true;
        break;
      }
      space.pinned.push(id);
      count++;
    }
  }

  targetStore.queueSaveDashboardData ? targetStore.queueSaveDashboardData(data) : targetStore._notify();
  targetStore._notify();

  return { pinnedCount: count, capped };
}

// Global bulk selection state in browser UI
/** @type {Set<string>} */
let selectedBookmarkIds = new Set();
/** @type {HTMLInputElement | null} */
let lastCheckedCheckbox = null;
let bulkActionBarEl = null;

/**
 * Returns current set of selected bookmark IDs.
 */
export function getSelectedBookmarkIds() {
  return selectedBookmarkIds;
}

/**
 * Clears selection and removes bulk action bar.
 */
export function clearSelection() {
  selectedBookmarkIds.clear();
  lastCheckedCheckbox = null;
  if (typeof document !== 'undefined') {
    const checkboxes = document.querySelectorAll('.bookmark-select-checkbox');
    checkboxes.forEach(cb => {
      /** @type {HTMLInputElement} */ (cb).checked = false;
    });
  }
  updateBulkActionBar();
}

/**
 * Updates or removes the floating bulk action bar.
 */
export function updateBulkActionBar() {
  if (typeof document === 'undefined') return;

  const count = selectedBookmarkIds.size;
  if (count === 0 || !getEditMode()) {
    if (bulkActionBarEl && bulkActionBarEl.parentNode) {
      bulkActionBarEl.parentNode.removeChild(bulkActionBarEl);
    }
    bulkActionBarEl = null;
    return;
  }

  if (!bulkActionBarEl) {
    bulkActionBarEl = el('div', { className: 'bulk-action-bar', role: 'region', 'aria-label': 'Bulk actions' });
    document.body.appendChild(bulkActionBarEl);
  }

  clearChildren(bulkActionBarEl);

  const countBadge = el('span', { className: 'bulk-count-badge', text: `${count} selected` });

  // Move To button
  const moveBtn = el('button', {
    type: 'button',
    className: 'btn-secondary btn-sm',
    text: 'Move to…',
    onclick: () => {
      openBulkMoveDialog();
    }
  });

  // Pin button
  const pinBtn = el('button', {
    type: 'button',
    className: 'btn-secondary btn-sm',
    text: 'Pin',
    onclick: async () => {
      const { store } = await import('../core/state.js');
      const res = bulkPinBookmarks(Array.from(selectedBookmarkIds), store);
      showToast(res.capped ? `Pinned ${res.pinnedCount} items (capped at 8)` : `Pinned ${res.pinnedCount} items to top`);
      clearSelection();
    }
  });

  // Delete button
  const deleteBtn = el('button', {
    type: 'button',
    className: 'btn-danger btn-sm',
    text: 'Delete',
    onclick: async () => {
      const { store } = await import('../core/state.js');
      const countToDelete = selectedBookmarkIds.size;
      const undo = bulkDeleteBookmarks(Array.from(selectedBookmarkIds), store);
      showToast(`Deleted ${countToDelete} bookmarks`, undo);
      clearSelection();
    }
  });

  // Deselect / Cancel
  const cancelBtn = el('button', {
    type: 'button',
    className: 'btn-quiet btn-sm',
    text: 'Cancel',
    onclick: () => {
      clearSelection();
    }
  });

  bulkActionBarEl.appendChild(countBadge);
  bulkActionBarEl.appendChild(moveBtn);
  bulkActionBarEl.appendChild(pinBtn);
  bulkActionBarEl.appendChild(deleteBtn);
  bulkActionBarEl.appendChild(cancelBtn);
}

/**
 * Opens dialog to move selected bookmarks to another collection.
 */
async function openBulkMoveDialog() {
  const { store } = await import('../core/state.js');
  const state = store.getState();
  const categories = state.categories || [];

  let dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('bulk-move-dialog'));
  if (!dialog) {
    dialog = /** @type {HTMLDialogElement} */ (el('dialog', {
      id: 'bulk-move-dialog',
      className: 'modal-content',
      'aria-labelledby': 'bulk-move-title'
    }));
    document.body.appendChild(dialog);
  }

  clearChildren(dialog);

  const title = el('h2', { id: 'bulk-move-title', className: 'modal-title' }, ['Move bookmarks to…']);
  const closeBtn = el('button', {
    type: 'button',
    className: 'btn-icon modal-close-btn',
    'aria-label': 'Close dialog',
    onclick: () => dialog?.close()
  }, ['✕']);

  const header = el('div', { className: 'modal-header' }, [title, closeBtn]);

  const list = el('div', { className: 'cat-picker-list', style: { display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0' } },
    categories.map(cat => el('button', {
      type: 'button',
      className: 'btn-secondary',
      style: { justifyContent: 'flex-start', padding: '8px 12px', gap: '8px' },
      onclick: () => {
        dialog?.close();
        const countMoved = selectedBookmarkIds.size;
        const undo = bulkMoveBookmarks(Array.from(selectedBookmarkIds), cat.id, store);
        showToast(`Moved ${countMoved} bookmarks to "${cat.name}"`, undo);
        clearSelection();
      }
    }, [
      el('span', { text: cat.icon || '📁' }),
      el('span', { text: cat.name })
    ]))
  );

  const cancelBtn = el('button', {
    type: 'button',
    className: 'btn-secondary',
    onclick: () => dialog?.close()
  }, ['Cancel']);

  const actions = el('div', { className: 'modal-actions' }, [cancelBtn]);
  const body = el('div', { className: 'modal-body' }, [list, actions]);

  dialog.appendChild(header);
  dialog.appendChild(body);

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

/**
 * Opens "Add many" dialog for a category.
 * @param {string} categoryId
 */
export async function openAddManyDialog(categoryId) {
  const { store } = await import('../core/state.js');
  const cat = store.getState().categories?.find(c => c.id === categoryId);
  const catName = cat?.name || 'Collection';

  let dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('add-many-dialog'));
  if (!dialog) {
    dialog = /** @type {HTMLDialogElement} */ (el('dialog', {
      id: 'add-many-dialog',
      className: 'modal-content add-many-modal',
      'aria-labelledby': 'add-many-title'
    }));
    document.body.appendChild(dialog);
  }

  clearChildren(dialog);

  const title = el('h2', { id: 'add-many-title', className: 'modal-title' }, [`Add many to "${catName}"`]);
  const closeBtn = el('button', {
    type: 'button',
    className: 'btn-icon modal-close-btn',
    'aria-label': 'Close dialog',
    onclick: () => dialog?.close()
  }, ['✕']);

  const header = el('div', { className: 'modal-header' }, [title, closeBtn]);

  const instructions = el('p', { className: 'modal-desc' }, [
    'Paste one URL per line. Optionally prefix with a name separated by "|": (e.g. ',
    el('code', { text: 'GitHub | https://github.com' }),
    ')'
  ]);

  const textarea = /** @type {HTMLTextAreaElement} */ (el('textarea', {
    className: 'form-textarea add-many-textarea',
    rows: 6,
    placeholder: 'https://example.com\nMy Docs | https://docs.google.com\nhttps://developer.mozilla.org',
    style: { width: '100%', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', resize: 'vertical' }
  }));

  const previewBox = el('div', { className: 'add-many-preview-box', style: { margin: '12px 0', fontSize: 'var(--text-xs)' } });

  function updatePreview() {
    clearChildren(previewBox);
    const { valid, invalid } = parseAddManyInput(textarea.value);

    const validHeading = el('div', {
      style: { color: 'var(--accent-text)', fontWeight: '600', marginBottom: '4px' },
      text: `✓ Valid bookmarks (${valid.length})`
    });
    previewBox.appendChild(validHeading);

    if (valid.length > 0) {
      const validList = el('ul', { style: { maxHeight: '100px', overflowY: 'auto', margin: '0 0 8px 16px', color: 'var(--text-secondary)' } },
        valid.slice(0, 10).map(v => el('li', { text: `${v.name} (${v.url})` }))
      );
      if (valid.length > 10) {
        validList.appendChild(el('li', { text: `...and ${valid.length - 10} more` }));
      }
      previewBox.appendChild(validList);
    }

    if (invalid.length > 0) {
      const invalidHeading = el('div', {
        style: { color: 'var(--color-danger, #ef4444)', fontWeight: '600', marginBottom: '4px' },
        text: `⚠ Skipped / Invalid lines (${invalid.length})`
      });
      const invalidList = el('ul', { style: { maxHeight: '80px', overflowY: 'auto', margin: '0 0 8px 16px', color: 'var(--text-muted)' } },
        invalid.slice(0, 5).map(inv => el('li', { text: `"${inv.line}" — ${inv.error}` }))
      );
      if (invalid.length > 5) {
        invalidList.appendChild(el('li', { text: `...and ${invalid.length - 5} more` }));
      }
      previewBox.appendChild(invalidHeading);
      previewBox.appendChild(invalidList);
    }

    saveBtn.disabled = valid.length === 0;
    saveBtn.textContent = valid.length > 0 ? `Add ${valid.length} Bookmarks` : 'Add Bookmarks';
  }

  textarea.addEventListener('input', updatePreview);

  const cancelBtn = el('button', {
    type: 'button',
    className: 'btn-secondary',
    onclick: () => dialog?.close()
  }, ['Cancel']);

  const saveBtn = /** @type {HTMLButtonElement} */ (el('button', {
    type: 'button',
    className: 'btn-primary',
    disabled: true,
    text: 'Add Bookmarks',
    onclick: () => {
      const { valid } = parseAddManyInput(textarea.value);
      if (valid.length === 0) return;

      createSnapshot('Before Add Many bookmarks', store.get()).catch(() => {});
      const snapshot = JSON.parse(JSON.stringify(store.get()));

      valid.forEach(item => {
        store.addBookmark(categoryId, { name: item.name, url: item.url });
      });

      showToast(`Added ${valid.length} bookmarks to "${catName}"`, () => {
        store.replaceData(snapshot);
      });
      dialog?.close();
    }
  }));

  const actions = el('div', { className: 'modal-actions' }, [cancelBtn, saveBtn]);
  const body = el('div', { className: 'modal-body' }, [instructions, textarea, previewBox, actions]);

  dialog.appendChild(header);
  dialog.appendChild(body);

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }

  textarea.focus();
}

/**
 * Initializes listeners for bookmark checkbox selections and Shift-click range selections.
 */
export function initBulkOperations() {
  if (typeof document === 'undefined') return;

  // Clear selection when exiting edit mode
  subscribeEditMode((active) => {
    if (!active) {
      clearSelection();
    }
  });

  // Delegate change/click on .bookmark-select-checkbox
  document.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (!target || !target.classList.contains('bookmark-select-checkbox')) {
      return;
    }

    const currentCheckbox = /** @type {HTMLInputElement} */ (target);
    const itemEl = currentCheckbox.closest('.bookmark-item');
    const bookmarkId = itemEl?.getAttribute('data-id');
    if (!bookmarkId) return;

    const allCheckboxes = Array.from(document.querySelectorAll('.bookmark-select-checkbox'));
    const currentIndex = allCheckboxes.indexOf(currentCheckbox);

    if (e.shiftKey && lastCheckedCheckbox && lastCheckedCheckbox !== currentCheckbox) {
      const lastIndex = allCheckboxes.indexOf(lastCheckedCheckbox);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const range = getRangeSelectionIndices(lastIndex, currentIndex);
        const shouldCheck = currentCheckbox.checked;

        range.forEach(idx => {
          const cb = /** @type {HTMLInputElement} */ (allCheckboxes[idx]);
          cb.checked = shouldCheck;
          const bId = cb.closest('.bookmark-item')?.getAttribute('data-id');
          if (bId) {
            if (shouldCheck) {
              selectedBookmarkIds.add(bId);
            } else {
              selectedBookmarkIds.delete(bId);
            }
          }
        });
      }
    } else {
      if (currentCheckbox.checked) {
        selectedBookmarkIds.add(bookmarkId);
      } else {
        selectedBookmarkIds.delete(bookmarkId);
      }
    }

    lastCheckedCheckbox = currentCheckbox;
    updateBulkActionBar();
  });
}
