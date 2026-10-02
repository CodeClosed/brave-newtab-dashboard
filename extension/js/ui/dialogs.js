// @ts-check
import { el, clearChildren } from '../utils/dom.js';
import { normalizeUrl } from '../utils/url.js';
import { store } from '../core/state.js';

let activeDialog = null;
let lastActiveElement = null;

const DEFAULT_EMOJIS = ['💻', '💼', '📚', '🎓', '🎬', '🛠️', '🛒', '🎮', '✈️', '🎵', '💡', '📌'];

/**
 * Ensures or creates the global <dialog> modal in the document body.
 * @returns {HTMLDialogElement}
 */
function getDialogElement() {
  let dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('app-modal-dialog'));
  if (!dialog) {
    dialog = /** @type {HTMLDialogElement} */ (el('dialog', { id: 'app-modal-dialog' }));
    dialog.addEventListener('close', () => {
      activeDialog = null;
      if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
        lastActiveElement.focus();
      }
    });
    // Close on backdrop click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.close();
      }
    });
    document.body.appendChild(dialog);
  }
  return dialog;
}

/**
 * Closes the currently active modal.
 */
export function closeModal() {
  const dialog = getDialogElement();
  if (dialog.open) {
    dialog.close();
  }
}

/**
 * Opens dialog for Adding or Editing a Category.
 *
 * @param {object} options
 * @param {'add' | 'edit'} options.mode
 * @param {import('../core/schema.js').Category} [options.category]
 * @param {(categoryData: { name: string, icon: string }) => void} options.onSave
 */
export function openCategoryDialog({ mode, category, onSave }) {
  lastActiveElement = /** @type {HTMLElement} */ (document.activeElement);
  const dialog = getDialogElement();
  clearChildren(dialog);

  let selectedEmoji = category?.icon || '📁';

  const title = el('h2', {
    className: 'modal-title',
    text: mode === 'add' ? 'Create Collection' : 'Edit Collection'
  });

  const closeBtn = el('button', {
    className: 'modal-close-btn',
    type: 'button',
    'aria-label': 'Close dialog',
    text: '✕',
    onclick: () => dialog.close()
  });

  const header = el('header', { className: 'modal-header' }, title, closeBtn);

  const nameInput = /** @type {HTMLInputElement} */ (el('input', {
    className: 'form-input',
    type: 'text',
    placeholder: 'e.g. Development, Entertainment, College',
    value: category?.name || '',
    required: true,
    autocomplete: 'off'
  }));

  const nameError = el('span', { className: 'field-error', text: 'Collection name is required' });

  const nameGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-label', text: 'Collection Name' }),
    nameInput,
    nameError
  );

  const emojiContainer = el('div', { className: 'emoji-selector' });
  const customEmojiInput = /** @type {HTMLInputElement} */ (el('input', {
    className: 'form-input',
    style: { width: '60px', textAlign: 'center', height: '32px' },
    type: 'text',
    value: selectedEmoji,
    maxLength: 4,
    title: 'Custom icon or emoji'
  }));

  function updateEmojiSelection(emoji) {
    selectedEmoji = emoji;
    customEmojiInput.value = emoji;
    emojiContainer.querySelectorAll('.emoji-pill').forEach(btn => {
      btn.classList.toggle('selected', btn.textContent === emoji);
    });
  }

  for (const emoji of DEFAULT_EMOJIS) {
    const pill = el('button', {
      className: `emoji-pill${selectedEmoji === emoji ? ' selected' : ''}`,
      type: 'button',
      text: emoji,
      onclick: () => updateEmojiSelection(emoji)
    });
    emojiContainer.appendChild(pill);
  }

  customEmojiInput.addEventListener('input', () => {
    if (customEmojiInput.value.trim()) {
      selectedEmoji = customEmojiInput.value.trim();
      emojiContainer.querySelectorAll('.emoji-pill').forEach(btn => {
        btn.classList.toggle('selected', btn.textContent === selectedEmoji);
      });
    }
  });

  const iconGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-label', text: 'Icon / Emoji' }),
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      customEmojiInput,
      emojiContainer
    )
  );

  const body = el('div', { className: 'modal-body' }, nameGroup, iconGroup);

  const cancelBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    text: 'Cancel',
    onclick: () => dialog.close()
  });

  const submitBtn = el('button', {
    className: 'btn-submit',
    type: 'submit',
    text: mode === 'add' ? 'Create Collection' : 'Save Changes'
  });

  const footer = el('footer', { className: 'modal-footer' }, cancelBtn, submitBtn);

  const form = el('form', { className: 'modal-content' }, header, body, footer);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = nameInput.value.trim();
    if (!val) {
      nameError.classList.add('visible');
      nameInput.focus();
      return;
    }
    nameError.classList.remove('visible');
    dialog.close();
    onSave({ name: val, icon: selectedEmoji });
  });

  dialog.appendChild(form);
  dialog.showModal();
  nameInput.focus();
}

/**
 * Opens dialog for Adding or Editing a Bookmark.
 *
 * @param {object} options
 * @param {'add' | 'edit'} options.mode
 * @param {string} [options.categoryId]
 * @param {import('../core/schema.js').Bookmark} [options.bookmark]
 * @param {(bookmarkData: { name: string, url: string, targetCategoryId?: string }) => void} options.onSave
 */
export function openBookmarkDialog({ mode, categoryId, bookmark, onSave }) {
  lastActiveElement = /** @type {HTMLElement} */ (document.activeElement);
  const dialog = getDialogElement();
  clearChildren(dialog);

  const categories = store.get().categories;
  const currentCatId = categoryId || categories[0]?.id || '';

  const title = el('h2', {
    className: 'modal-title',
    text: mode === 'add' ? 'Add Bookmark' : 'Edit Bookmark'
  });

  const closeBtn = el('button', {
    className: 'modal-close-btn',
    type: 'button',
    'aria-label': 'Close dialog',
    text: '✕',
    onclick: () => dialog.close()
  });

  const header = el('header', { className: 'modal-header' }, title, closeBtn);

  const urlInput = /** @type {HTMLInputElement} */ (el('input', {
    className: 'form-input',
    type: 'text',
    placeholder: 'e.g. github.com or https://news.ycombinator.com',
    value: bookmark?.url || '',
    required: true,
    autocomplete: 'off'
  }));

  const urlError = el('span', { className: 'field-error', text: 'Please enter a valid web URL' });

  const urlGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-label', text: 'Website URL' }),
    urlInput,
    urlError
  );

  const nameInput = /** @type {HTMLInputElement} */ (el('input', {
    className: 'form-input',
    type: 'text',
    placeholder: 'e.g. GitHub (leave empty to use domain)',
    value: bookmark?.name || '',
    autocomplete: 'off'
  }));

  const nameGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-label', text: 'Bookmark Name (Optional)' }),
    nameInput
  );

  const categorySelect = /** @type {HTMLSelectElement} */ (el('select', { className: 'form-select' }));
  for (const cat of categories) {
    const opt = /** @type {HTMLOptionElement} */ (el('option', {
      value: cat.id,
      text: `${cat.icon} ${cat.name}`
    }));
    if (cat.id === currentCatId) opt.selected = true;
    categorySelect.appendChild(opt);
  }

  const categoryGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-label', text: 'Collection' }),
    categorySelect
  );

  const body = el('div', { className: 'modal-body' }, urlGroup, nameGroup, categoryGroup);

  const cancelBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    text: 'Cancel',
    onclick: () => dialog.close()
  });

  const submitBtn = el('button', {
    className: 'btn-submit',
    type: 'submit',
    text: mode === 'add' ? 'Add Bookmark' : 'Save Changes'
  });

  const footer = el('footer', { className: 'modal-footer' }, cancelBtn, submitBtn);

  const form = el('form', { className: 'modal-content' }, header, body, footer);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawUrl = urlInput.value.trim();
    const norm = normalizeUrl(rawUrl);

    if (!norm.valid) {
      urlError.textContent = norm.error || 'Invalid URL format';
      urlError.classList.add('visible');
      urlInput.focus();
      return;
    }

    urlError.classList.remove('visible');
    const bookmarkName = nameInput.value.trim() || norm.domain;

    dialog.close();
    onSave({
      name: bookmarkName,
      url: norm.url,
      targetCategoryId: categorySelect.value
    });
  });

  dialog.appendChild(form);
  dialog.showModal();
  urlInput.focus();
}

/**
 * Opens a pre-import preview modal showing item counts and requiring confirmation.
 *
 * @param {object} options
 * @param {{ categoryCount: number, bookmarkCount: number }} options.summary
 * @param {() => void} options.onConfirm
 */
export function openImportPreviewDialog({ summary, onConfirm }) {
  lastActiveElement = /** @type {HTMLElement} */ (document.activeElement);
  const dialog = getDialogElement();
  clearChildren(dialog);

  const header = el('header', { className: 'modal-header' },
    el('h2', { className: 'modal-title', text: 'Restore Dashboard Backup' }),
    el('button', {
      className: 'modal-close-btn',
      type: 'button',
      text: '✕',
      onclick: () => dialog.close()
    })
  );

  const body = el('div', { className: 'modal-body', style: { gap: '12px' } },
    el('p', {
      text: 'Backup file verified successfully! Here is what will be imported:',
      style: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }
    }),
    el('div', {
      style: {
        background: 'var(--bg-surface-subtle)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-around',
        textAlign: 'center'
      }
    },
      el('div', {},
        el('div', { text: String(summary.categoryCount), style: { fontSize: '20px', fontWeight: '600' } }),
        el('div', { text: 'Collections', style: { fontSize: '11px', color: 'var(--text-muted)' } })
      ),
      el('div', {},
        el('div', { text: String(summary.bookmarkCount), style: { fontSize: '20px', fontWeight: '600' } }),
        el('div', { text: 'Bookmarks', style: { fontSize: '11px', color: 'var(--text-muted)' } })
      )
    ),
    el('p', {
      text: 'Note: Restoring will replace your current collections with the backup. You can click Undo if restored by accident.',
      style: { fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }
    })
  );

  const cancelBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    text: 'Cancel',
    onclick: () => dialog.close()
  });

  const confirmBtn = el('button', {
    className: 'btn-submit',
    type: 'button',
    text: 'Restore Backup',
    onclick: () => {
      dialog.close();
      onConfirm();
    }
  });

  const footer = el('footer', { className: 'modal-footer' }, cancelBtn, confirmBtn);

  const content = el('div', { className: 'modal-content' }, header, body, footer);
  dialog.appendChild(content);
  dialog.showModal();
  confirmBtn.focus();
}

/**
 * Opens a compact confirmation dialog for destructive actions.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmText='Delete']
 * @param {() => void} options.onConfirm
 */
export function openConfirmDialog({ title, message, confirmText = 'Delete', onConfirm }) {
  lastActiveElement = /** @type {HTMLElement} */ (document.activeElement);
  const dialog = getDialogElement();
  clearChildren(dialog);

  const header = el('header', { className: 'modal-header' },
    el('h2', { className: 'modal-title', text: title }),
    el('button', {
      className: 'modal-close-btn',
      type: 'button',
      text: '✕',
      onclick: () => dialog.close()
    })
  );

  const body = el('div', { className: 'modal-body' },
    el('p', { text: message, style: { fontSize: 'var(--text-base)', color: 'var(--text-secondary)' } })
  );

  const cancelBtn = el('button', {
    className: 'btn-secondary',
    type: 'button',
    text: 'Cancel',
    onclick: () => dialog.close()
  });

  const confirmBtn = el('button', {
    className: 'btn-submit btn-danger',
    type: 'button',
    text: confirmText,
    onclick: () => {
      dialog.close();
      onConfirm();
    }
  });

  const footer = el('footer', { className: 'modal-footer' }, cancelBtn, confirmBtn);

  const content = el('div', { className: 'modal-content' }, header, body, footer);
  dialog.appendChild(content);
  dialog.showModal();
  confirmBtn.focus();
}
