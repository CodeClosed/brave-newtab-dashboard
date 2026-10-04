// @ts-check
import { el, clearChildren } from '../utils/dom.js';

/**
 * @typedef {object} JumpState
 * @property {boolean} active
 * @property {number | null} collectionIndex
 */

/** @type {JumpState} */
let jumpState = {
  active: false,
  collectionIndex: null
};

let lastActiveElementBeforeDialog = null;

/**
 * Returns current jump state (for testing and UI state reflection).
 * @returns {JumpState}
 */
export function getJumpState() {
  return jumpState;
}

/**
 * Removes all active jump badges from DOM.
 */
export function clearJumpBadges() {
  if (typeof document === 'undefined') return;
  const badges = document.querySelectorAll('.jump-badge');
  for (const b of badges) {
    if (b.parentNode) {
      b.parentNode.removeChild(b);
    }
  }
}

/**
 * Cancels collection jump navigation mode and removes badges.
 */
export function cancelJumpMode() {
  jumpState.active = false;
  jumpState.collectionIndex = null;
  clearJumpBadges();
}

/**
 * Renders jump badges for collections.
 */
function renderCollectionBadges() {
  clearJumpBadges();
  const collections = document.querySelectorAll('#categories-grid .category-card');
  collections.forEach((card, idx) => {
    if (idx >= 9) return;
    const badge = el('span', { className: 'jump-badge', 'aria-hidden': 'true' }, [String(idx + 1)]);
    const header = card.querySelector('.category-name') || card.querySelector('.category-header') || card;
    header.appendChild(badge);
  });
}

/**
 * Renders jump badges for bookmarks inside a specific collection.
 * @param {Element} collectionCard
 */
function renderBookmarkBadges(collectionCard) {
  clearJumpBadges();
  const bookmarkLinks = collectionCard.querySelectorAll('.bookmark-link');
  bookmarkLinks.forEach((link, idx) => {
    if (idx >= 9) return;
    const badge = el('span', { className: 'jump-badge', 'aria-hidden': 'true' }, [String(idx + 1)]);
    link.appendChild(badge);
  });
}

/**
 * Opens keyboard shortcuts help modal dialog.
 */
export function openShortcutsHelpDialog() {
  lastActiveElementBeforeDialog = /** @type {HTMLElement} */ (document.activeElement);

  let dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('shortcuts-dialog'));
  if (!dialog) {
    dialog = /** @type {HTMLDialogElement} */ (el('dialog', {
      id: 'shortcuts-dialog',
      className: 'shortcuts-dialog modal-content',
      'aria-labelledby': 'shortcuts-dialog-title'
    }));

    dialog.addEventListener('close', () => {
      if (lastActiveElementBeforeDialog && typeof lastActiveElementBeforeDialog.focus === 'function') {
        lastActiveElementBeforeDialog.focus();
      }
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog?.close();
      }
    });

    document.body.appendChild(dialog);
  }

  clearChildren(dialog);

  const header = el('div', { className: 'modal-header' }, [
    el('h2', { id: 'shortcuts-dialog-title', className: 'modal-title' }, ['Keyboard Shortcuts']),
    el('button', {
      type: 'button',
      className: 'btn-icon modal-close-btn',
      'aria-label': 'Close keyboard shortcuts',
      onclick: () => dialog?.close()
    }, ['✕'])
  ]);

  const shortcutsList = [
    { key: '/', desc: 'Focus search bar' },
    { key: 'g + [1-9]', desc: 'Jump to collection, then [1-9] to open link' },
    { key: 'e', desc: 'Toggle edit mode (reorder & inline editing)' },
    { key: '[ / ]', desc: 'Cycle spaces' },
    { key: '?', desc: 'Show keyboard shortcuts' },
    { key: 'Esc', desc: 'Close dialog, menu, or cancel jump mode' }
  ];

  const tbody = el('tbody', {}, shortcutsList.map((item) =>
    el('tr', { className: 'shortcut-row' }, [
      el('td', { className: 'shortcut-key-col' }, [
        el('kbd', { className: 'shortcut-kbd' }, [item.key])
      ]),
      el('td', { className: 'shortcut-desc-col' }, [item.desc])
    ])
  ));

  const table = el('table', { className: 'shortcuts-table' }, [tbody]);
  const body = el('div', { className: 'modal-body' }, [table]);

  dialog.appendChild(header);
  dialog.appendChild(body);

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

/**
 * Initializes global keyboard navigation shortcuts.
 * @param {object} [options]
 * @param {(url: string) => void} [options.onOpenUrl]
 */
export function initKeyboardNavigation(options = {}) {
  window.addEventListener('keydown', (e) => {
    // Escape always cancels jump mode if active
    if (e.key === 'Escape' && jumpState.active) {
      e.preventDefault();
      cancelJumpMode();
      return;
    }

    // Do not trigger single-key actions when typing in inputs or when dialog is open
    const activeEl = document.activeElement;
    const activeTag = activeEl?.tagName || '';
    const isEditing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) ||
      Boolean(activeEl && /** @type {HTMLElement} */ (activeEl).isContentEditable);

    const isDialogOpen = Boolean(document.querySelector('dialog[open], .settings-drawer.open'));

    if (isEditing || (isDialogOpen && e.key !== 'Escape')) {
      if (jumpState.active) cancelJumpMode();
      return;
    }

    // Disallow shortcuts when modifier keys are pressed (except Shift for '?')
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    // Active jump navigation state
    if (jumpState.active) {
      // Step 1: choosing a collection (1-9)
      if (jumpState.collectionIndex === null) {
        if (/^[1-9]$/.test(e.key)) {
          const colIdx = parseInt(e.key, 10) - 1;
          const collections = document.querySelectorAll('#categories-grid .category-card');
          if (colIdx < collections.length) {
            e.preventDefault();
            jumpState.collectionIndex = colIdx;
            const targetCard = collections[colIdx];
            if (typeof /** @type {HTMLElement} */ (targetCard).focus === 'function') {
              /** @type {HTMLElement} */ (targetCard).focus();
            }
            renderBookmarkBadges(targetCard);
          } else {
            cancelJumpMode();
          }
        } else {
          cancelJumpMode();
        }
        return;
      }

      // Step 2: choosing a bookmark in the selected collection (1-9)
      if (/^[1-9]$/.test(e.key)) {
        const bIdx = parseInt(e.key, 10) - 1;
        const collections = document.querySelectorAll('#categories-grid .category-card');
        const targetCard = collections[jumpState.collectionIndex];
        const bookmarks = targetCard?.querySelectorAll('.bookmark-link');
        if (bookmarks && bIdx < bookmarks.length) {
          e.preventDefault();
          const targetBookmark = /** @type {HTMLAnchorElement} */ (bookmarks[bIdx]);
          const url = targetBookmark.getAttribute('href') || targetBookmark.href;
          cancelJumpMode();
          if (options.onOpenUrl) {
            options.onOpenUrl(url);
          } else {
            targetBookmark.click();
          }
        } else {
          cancelJumpMode();
        }
      } else {
        cancelJumpMode();
      }
      return;
    }

    // Default top-level shortcuts (when no dialog is open)
    if (e.key === 'g') {
      const collections = document.querySelectorAll('#categories-grid .category-card');
      if (collections.length > 0) {
        e.preventDefault();
        jumpState.active = true;
        jumpState.collectionIndex = null;
        renderCollectionBadges();
      }
      return;
    }

    if (e.key === '?') {
      e.preventDefault();
      openShortcutsHelpDialog();
      return;
    }
  });

  // Cancel jump badges if user clicks outside
  document.addEventListener('pointerdown', (e) => {
    if (jumpState.active) {
      cancelJumpMode();
    }
  });
}
