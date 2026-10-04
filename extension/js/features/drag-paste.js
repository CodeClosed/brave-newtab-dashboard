// @ts-check
import { normalizeUrl } from '../utils/url.js';
import { store } from '../core/state.js';
import { openBookmarkDialog } from '../ui/dialogs.js';
import { showToast } from '../ui/toasts.js';

/**
 * Extracts and normalizes URL and title from a drag-and-drop or clipboard event DataTransfer.
 * Strictly uses DOMParser reading textContent only to prevent script injection.
 *
 * @param {DataTransfer | { getData: (type: string) => string }} dataTransfer
 * @returns {{ url: string, name: string, domain: string } | null}
 */
export function extractLinkFromDataTransfer(dataTransfer) {
  if (!dataTransfer || typeof dataTransfer.getData !== 'function') {
    return null;
  }

  // 1. Retrieve URL from text/uri-list or text/plain
  let rawUrl = '';
  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    const firstLine = uriList
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'));
    if (firstLine) rawUrl = firstLine;
  }

  if (!rawUrl) {
    const text = dataTransfer.getData('text/plain');
    if (text) rawUrl = text.trim();
  }

  if (!rawUrl) return null;

  const norm = normalizeUrl(rawUrl);
  if (!norm.valid) return null;

  // 2. Extract name from text/html <a> textContent only
  let name = '';
  const html = dataTransfer.getData('text/html');
  if (html) {
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const anchor = doc.querySelector('a');
        if (anchor && anchor.textContent && anchor.textContent.trim()) {
          name = anchor.textContent.trim().slice(0, 80);
        }
      } catch {
        // Fallback
      }
    }

    if (!name) {
      const match = html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
      if (match && match[1]) {
        name = match[1]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 80);
      }
    }
  }

  if (!name) {
    name = norm.domain || 'New Bookmark';
  }

  return {
    url: norm.url,
    name,
    domain: norm.domain
  };
}

/**
 * Checks whether pasted raw text represents a valid web URL candidate.
 * @param {string} text
 * @returns {boolean}
 */
export function isPastingUrlCandidate(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return false;
  }
  const norm = normalizeUrl(text.trim());
  return Boolean(norm.valid);
}

/**
 * Initializes global drag-and-drop link dropping and clipboard URL paste listeners.
 */
export function initDropAndPaste() {
  if (typeof window === 'undefined') return;

  // Allow external link drags over document
  window.addEventListener('dragover', (e) => {
    const types = e.dataTransfer?.types;
    if (types && (types.includes('text/uri-list') || types.includes('text/plain'))) {
      // If not internal drag reorder
      if (!document.querySelector('.is-dragging')) {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
      }
    }
  });

  // Handle drop on collection card vs page background
  window.addEventListener('drop', (e) => {
    // If internal reordering was active, let dnd.js handle it
    if (document.querySelector('.is-dragging')) return;

    if (!e.dataTransfer) return;
    const link = extractLinkFromDataTransfer(e.dataTransfer);
    if (!link) return;

    e.preventDefault();
    e.stopPropagation();

    const targetEl = /** @type {HTMLElement | null} */ (e.target);
    const cardEl = targetEl?.closest?.('.category-card');
    const categoryId = cardEl?.getAttribute('data-id');

    if (categoryId) {
      // Dropped onto a collection -> add directly to this collection
      store.addBookmark(categoryId, {
        name: link.name,
        url: link.url
      });
      showToast(`Added "${link.name}"`);
    } else {
      // Dropped onto page background -> open add dialog with collection picker
      openBookmarkDialog({
        mode: 'add',
        bookmark: {
          name: link.name,
          url: link.url
        },
        onSave: (data) => {
          const targetCatId = data.targetCategoryId || store.get().categories[0]?.id;
          if (targetCatId) {
            store.addBookmark(targetCatId, {
              name: data.name,
              url: data.url
            });
            showToast(`Added "${data.name}"`);
          }
        }
      });
    }
  });

  // Handle paste URL when no input is focused
  window.addEventListener('paste', (e) => {
    const active = document.activeElement;
    const activeTag = active?.tagName || '';
    const isInputFocused =
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) ||
      Boolean(active?.getAttribute('contenteditable') === 'true');
    const isDialogOpen = Boolean(document.querySelector('dialog[open], .settings-drawer.open'));

    if (isInputFocused || isDialogOpen) return;

    const pastedText = e.clipboardData?.getData('text/plain')?.trim();
    if (!pastedText || !isPastingUrlCandidate(pastedText)) return;

    e.preventDefault();
    const link = extractLinkFromDataTransfer(e.clipboardData) || {
      url: normalizeUrl(pastedText).url,
      name: normalizeUrl(pastedText).domain || 'New Bookmark',
      domain: normalizeUrl(pastedText).domain
    };

    openBookmarkDialog({
      mode: 'add',
      bookmark: {
        name: link.name,
        url: link.url
      },
      onSave: (data) => {
        const targetCatId = data.targetCategoryId || store.get().categories[0]?.id;
        if (targetCatId) {
          store.addBookmark(targetCatId, {
            name: data.name,
            url: data.url
          });
          showToast(`Added "${data.name}"`);
        }
      }
    });
  });
}
