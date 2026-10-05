// @ts-check
import { normalizeUrl, getDomainFromUrl } from '../utils/url.js';
import { el } from '../utils/dom.js';

let isEditMode = false;
/** @type {Set<(state: boolean) => void>} */
const listeners = new Set();

/**
 * Returns current edit mode state.
 * @returns {boolean}
 */
export function getEditMode() {
  return isEditMode;
}

/**
 * Sets edit mode state and updates DOM.
 * @param {boolean} enabled
 */
export function setEditMode(enabled) {
  isEditMode = Boolean(enabled);
  if (typeof document !== 'undefined') {
    if (isEditMode) {
      document.body?.classList.add('is-edit-mode');
    } else {
      document.body?.classList.remove('is-edit-mode');
    }

    const toggleBtn = typeof document.getElementById === 'function' ? document.getElementById('edit-mode-toggle-btn') : null;
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', isEditMode ? 'true' : 'false');
      toggleBtn.classList.toggle('active', isEditMode);
      toggleBtn.title = isEditMode ? 'Exit edit mode (e)' : 'Enter edit mode (e)';
    }
  }

  listeners.forEach((fn) => {
    try {
      fn(isEditMode);
    } catch (err) {
      console.error(err);
    }
  });
}

/**
 * Toggles edit mode state.
 * @returns {boolean}
 */
export function toggleEditMode() {
  setEditMode(!isEditMode);
  return isEditMode;
}

/**
 * Subscribes to edit mode state changes.
 * @param {(state: boolean) => void} fn
 * @returns {() => void}
 */
export function subscribeEditMode(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export { subscribeEditMode as onEditModeChange };

/**
 * Normalizes input URL, derives bookmark name from domain if unspecified,
 * and adds to category in store.
 *
 * @param {string} categoryId
 * @param {string} rawUrl
 * @param {any} targetStore
 * @returns {{ success: boolean, bookmark?: any, name?: string, error?: string }}
 */
export function handleInlineAddBookmark(categoryId, rawUrl, targetStore) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { success: false, error: 'URL cannot be empty' };
  }

  const norm = normalizeUrl(rawUrl.trim());
  if (!norm.valid) {
    return { success: false, error: norm.error || 'Invalid URL' };
  }

  const name = norm.domain || 'New Bookmark';

  try {
    const bookmark = targetStore.addBookmark(categoryId, {
      name,
      url: norm.url
    });
    return { success: true, bookmark, name };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to add bookmark' };
  }
}

/**
 * Replaces element content with an inline input for quick renaming.
 * Pressing Enter commits with trimmed text; Escape cancels without committing.
 *
 * @param {HTMLElement} element
 * @param {{ initialValue: string, onSave: (newVal: string) => void, onCancel?: () => void }} options
 * @returns {{ input: HTMLInputElement, commit: () => void, cancel: () => void }}
 */
export function startInlineRename(element, options) {
  const { initialValue, onSave, onCancel } = options;
  const originalText = element.textContent || '';

  const input = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'inline-rename-input',
    value: initialValue,
    maxLength: 80,
    'aria-label': 'Edit name'
  }));

  let finished = false;

  function commit() {
    if (finished) return;
    finished = true;
    const newVal = (input.value || '').trim();
    if (newVal && newVal !== initialValue) {
      element.textContent = newVal;
      onSave(newVal);
    } else {
      element.textContent = originalText;
      if (onCancel) onCancel();
    }
  }

  function cancel() {
    if (finished) return;
    finished = true;
    element.textContent = originalText;
    if (onCancel) onCancel();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  });

  input.addEventListener('blur', () => {
    commit();
  });

  if (typeof element.replaceChildren === 'function') {
    element.replaceChildren(input);
  } else {
    element.textContent = '';
    element.appendChild(input);
  }

  if (typeof input.focus === 'function') {
    input.focus();
    if (typeof input.select === 'function') {
      input.select();
    }
  }

  return { input, commit, cancel };
}

/**
 * Initializes edit mode toggle button and 'e' keyboard shortcut.
 */
export function initEditMode() {
  if (typeof window === 'undefined') return;

  const toggleBtn = document.getElementById('edit-mode-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      toggleEditMode();
    });
  }

  window.addEventListener('keydown', (e) => {
    // Only toggle 'e' when no input/textarea is focused and no dialog or drawer is open
    const activeTag = document.activeElement?.tagName || '';
    const isDialogOpen = Boolean(document.querySelector('dialog[open], .settings-drawer.open'));

    if (e.key === 'e' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) && !isDialogOpen) {
      e.preventDefault();
      toggleEditMode();
    }
  });
}
