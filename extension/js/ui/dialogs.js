// @ts-check
import { el, clearChildren } from '../utils/dom.js';
import { normalizeUrl } from '../utils/url.js';
import { store } from '../core/state.js';
import { findDuplicateBookmark } from '../features/duplicates.js';
import { processCustomIconFile, validateCustomIcon } from '../features/custom-icons.js';
import { refreshFavicon } from './favicons.js';
import { showToast } from './toasts.js';
import { isBookmarkPinned, pinBookmark, togglePinBookmark } from '../features/pinned.js';
import {
  DEFAULT_ICON_KEYS,
  ICON_LABELS,
  ICON_CLOSE,
  ICON_REFRESH,
  getIconSvg,
  resolveIconKey
} from './icons.js';

let activeDialog = null;
let lastActiveElement = null;

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
 * @param {(categoryData: { name: string, icon: string, color?: string | null }) => void} options.onSave
 */
export function openCategoryDialog({ mode, category, onSave }) {
  lastActiveElement = /** @type {HTMLElement} */ (document.activeElement);
  const dialog = getDialogElement();
  clearChildren(dialog);

  let selectedIcon = resolveIconKey(category?.icon || 'folder', 'folder');

  const title = el('h2', {
    className: 'modal-title',
    text: mode === 'add' ? 'Create Collection' : 'Edit Collection'
  });

  const closeBtn = el('button', {
    className: 'modal-close-btn',
    type: 'button',
    'aria-label': 'Close dialog',
    html: ICON_CLOSE,
    onclick: () => dialog.close()
  });

  const header = el('header', { className: 'modal-header' }, title, closeBtn);

  const nameInput = /** @type {HTMLInputElement} */ (el('input', {
    className: 'form-input',
    type: 'text',
    placeholder: 'e.g. Development, Design, Reading',
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

  const iconContainer = el('div', { className: 'emoji-selector' });

  function updateIconSelection(iconKey) {
    selectedIcon = iconKey;
    iconContainer.querySelectorAll('.emoji-pill').forEach(btn => {
      const btnKey = /** @type {HTMLElement} */ (btn).dataset.icon;
      btn.classList.toggle('selected', btnKey === iconKey);
    });
  }

  for (const iconKey of DEFAULT_ICON_KEYS) {
    const label = ICON_LABELS[iconKey] || iconKey;
    const pill = el('button', {
      className: `emoji-pill${selectedIcon === iconKey ? ' selected' : ''}`,
      type: 'button',
      title: label,
      'aria-label': `Icon ${label}`,
      dataset: { icon: iconKey },
      html: getIconSvg(iconKey, 16),
      onclick: () => updateIconSelection(iconKey)
    });
    iconContainer.appendChild(pill);
  }

  const iconGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-label', text: 'Collection Icon' }),
    iconContainer
  );

  // 12.3 Chrome Group Color Picker
  const COLOR_OPTIONS = [
    { id: null, label: 'None', hex: 'transparent' },
    { id: 'grey', label: 'Grey', hex: '#5f6368' },
    { id: 'blue', label: 'Blue', hex: '#1a73e8' },
    { id: 'red', label: 'Red', hex: '#d93025' },
    { id: 'yellow', label: 'Yellow', hex: '#f9ab00' },
    { id: 'green', label: 'Green', hex: '#1e8e3e' },
    { id: 'pink', label: 'Pink', hex: '#e52592' },
    { id: 'purple', label: 'Purple', hex: '#9334e6' },
    { id: 'cyan', label: 'Cyan', hex: '#12b5cb' },
    { id: 'orange', label: 'Orange', hex: '#e8710a' }
  ];

  let selectedColor = category?.color || null;
  const colorContainer = el('div', { className: 'color-selector', style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' } });

  COLOR_OPTIONS.forEach((col) => {
    const isSelected = selectedColor === col.id;
    const swatch = el('button', {
      className: `color-swatch-btn${isSelected ? ' selected' : ''}`,
      type: 'button',
      title: col.label,
      'aria-label': `Color ${col.label}`,
      dataset: { color: col.id || 'none' },
      style: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        border: col.id ? '2px solid rgba(255,255,255,0.2)' : '1px dashed var(--border-default)',
        backgroundColor: col.hex,
        cursor: 'pointer',
        boxShadow: isSelected ? '0 0 0 2px var(--accent, #6366f1)' : 'none'
      },
      onclick: () => {
        selectedColor = col.id;
        colorContainer.querySelectorAll('.color-swatch-btn').forEach((btn) => {
          /** @type {HTMLElement} */ (btn).style.boxShadow = 'none';
        });
        swatch.style.boxShadow = '0 0 0 2px var(--accent, #6366f1)';
      }
    });
    colorContainer.appendChild(swatch);
  });

  const colorGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-label', text: 'Tab Group Color' }),
    colorContainer
  );

  const body = el('div', { className: 'modal-body' }, nameGroup, iconGroup, colorGroup);

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
    onSave({ name: val, icon: selectedIcon, color: selectedColor });
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
 * @param {(bookmarkData: { name: string, url: string, targetCategoryId?: string, icon?: any, pinned?: boolean }) => any} options.onSave
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
    html: ICON_CLOSE,
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
  const duplicateWarning = el('div', { className: 'duplicate-warning-banner', role: 'status', style: { display: 'none' } });

  function checkDuplicate() {
    const raw = urlInput.value.trim();
    if (!raw) {
      duplicateWarning.style.display = 'none';
      duplicateWarning.textContent = '';
      return;
    }
    const duplicate = findDuplicateBookmark(raw, categories, bookmark?.id);
    if (duplicate) {
      duplicateWarning.textContent = `Note: Already saved in "${duplicate.category.name}" as "${duplicate.bookmark.name}". You can still save if desired.`;
      duplicateWarning.style.display = 'block';
    } else {
      duplicateWarning.style.display = 'none';
      duplicateWarning.textContent = '';
    }
  }

  urlInput.addEventListener('input', checkDuplicate);
  if (urlInput.value) checkDuplicate();

  const urlGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-label', text: 'Website URL' }),
    urlInput,
    urlError,
    duplicateWarning
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
      text: cat.name
    }));
    if (cat.id === currentCatId) opt.selected = true;
    categorySelect.appendChild(opt);
  }

  const categoryGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-label', text: 'Collection' }),
    categorySelect
  );

  // Icon choice: website (null), custom Lucide icon ('emoji' type for schema compatibility), or image
  let chosenIcon = bookmark?.icon ? { ...bookmark.icon } : null;
  let currentLucideKey = chosenIcon?.type === 'emoji' ? resolveIconKey(chosenIcon.value, 'star') : 'star';

  const iconTypeSelect = /** @type {HTMLSelectElement} */ (el('select', { className: 'form-select' }, [
    el('option', { value: 'website', selected: !chosenIcon }, ['Use website favicon']),
    el('option', { value: 'emoji', selected: chosenIcon?.type === 'emoji' }, ['Choose vector icon']),
    el('option', { value: 'image', selected: chosenIcon?.type === 'image' }, ['Upload custom image'])
  ]));

  const bookmarkIconPicker = el('div', {
    className: 'emoji-selector',
    style: {
      display: chosenIcon?.type === 'emoji' ? 'flex' : 'none',
      marginTop: '6px'
    }
  });

  for (const iconKey of DEFAULT_ICON_KEYS.slice(0, 12)) {
    const label = ICON_LABELS[iconKey] || iconKey;
    const pill = el('button', {
      className: `emoji-pill${currentLucideKey === iconKey ? ' selected' : ''}`,
      type: 'button',
      title: label,
      'aria-label': `Icon ${label}`,
      dataset: { icon: iconKey },
      html: getIconSvg(iconKey, 15),
      onclick: () => {
        currentLucideKey = iconKey;
        chosenIcon = { type: 'emoji', value: iconKey };
        bookmarkIconPicker.querySelectorAll('.emoji-pill').forEach(btn => {
          btn.classList.toggle('selected', /** @type {HTMLElement} */ (btn).dataset.icon === iconKey);
        });
      }
    });
    bookmarkIconPicker.appendChild(pill);
  }

  const fileInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'file',
    accept: 'image/*',
    className: 'form-input',
    style: { display: chosenIcon?.type === 'image' ? 'block' : 'none', fontSize: 'var(--text-xs)' }
  }));

  const imagePreview = /** @type {HTMLImageElement} */ (el('img', {
    className: 'custom-icon-preview',
    src: chosenIcon?.type === 'image' ? chosenIcon.value : '',
    style: {
      width: '24px',
      height: '24px',
      objectFit: 'contain',
      display: chosenIcon?.type === 'image' ? 'block' : 'none',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-xs)'
    }
  }));

  const refreshIconBtn = mode === 'edit' ? el('button', {
    type: 'button',
    className: 'btn-quiet btn-sm',
    html: `${ICON_REFRESH}<span>Refresh icon</span>`,
    title: 'Retry fetching website favicon',
    onclick: () => {
      if (bookmark?.url) {
        refreshFavicon(bookmark.url);
        chosenIcon = null;
        iconTypeSelect.value = 'website';
        bookmarkIconPicker.style.display = 'none';
        fileInput.style.display = 'none';
        imagePreview.style.display = 'none';
        showToast('Refreshed website icon');
      }
    }
  }) : null;

  iconTypeSelect.addEventListener('change', () => {
    const val = iconTypeSelect.value;
    if (val === 'website') {
      chosenIcon = null;
      bookmarkIconPicker.style.display = 'none';
      fileInput.style.display = 'none';
      imagePreview.style.display = 'none';
    } else if (val === 'emoji') {
      chosenIcon = { type: 'emoji', value: currentLucideKey };
      bookmarkIconPicker.style.display = 'flex';
      fileInput.style.display = 'none';
      imagePreview.style.display = 'none';
    } else if (val === 'image') {
      bookmarkIconPicker.style.display = 'none';
      fileInput.style.display = 'block';
      imagePreview.style.display = chosenIcon?.type === 'image' ? 'block' : 'none';
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (file) {
      try {
        const dataUrl = await processCustomIconFile(file);
        chosenIcon = { type: 'image', value: dataUrl };
        imagePreview.src = dataUrl;
        imagePreview.style.display = 'block';
      } catch (err) {
        showToast(err.message || 'Failed to process image');
      }
    }
  });

  const iconControls = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, [
    iconTypeSelect,
    fileInput,
    imagePreview,
    refreshIconBtn
  ].filter(Boolean));

  const iconGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-label', text: 'Bookmark Icon' }),
    iconControls,
    bookmarkIconPicker
  );

  const isCurrentlyPinned = bookmark?.id ? isBookmarkPinned(bookmark.id) : false;
  const pinCheckbox = /** @type {HTMLInputElement} */ (el('input', {
    type: 'checkbox',
    className: 'form-checkbox',
    id: 'bookmark-pin-dock-checkbox'
  }));
  if (isCurrentlyPinned) {
    pinCheckbox.checked = true;
  }

  const pinLabel = el('label', {
    className: 'form-checkbox-label',
    htmlFor: 'bookmark-pin-dock-checkbox'
  }, pinCheckbox, el('span', { text: 'Pin to Navbar (App Dock)' }));

  const pinGroup = el('div', { className: 'form-group form-group-checkbox' }, pinLabel);

  const body = el('div', { className: 'modal-body' }, urlGroup, nameGroup, categoryGroup, iconGroup, pinGroup);

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

    const iconValidation = validateCustomIcon(chosenIcon);
    if (!iconValidation.valid) {
      showToast(iconValidation.error || 'Invalid icon');
      return;
    }

    dialog.close();
    const shouldPin = Boolean(pinCheckbox.checked);
    const savedResult = onSave({
      name: bookmarkName,
      url: norm.url,
      targetCategoryId: categorySelect.value,
      icon: chosenIcon,
      pinned: shouldPin
    });

    if (mode === 'edit' && bookmark?.id) {
      if (shouldPin && !isCurrentlyPinned) {
        pinBookmark(bookmark.id);
      } else if (!shouldPin && isCurrentlyPinned) {
        togglePinBookmark(bookmark.id);
      }
    } else if (mode === 'add' && shouldPin && savedResult && savedResult.id) {
      pinBookmark(savedResult.id);
    }
  });

  dialog.appendChild(form);
  dialog.showModal();
  urlInput.focus();
}

/**
 * Opens a pre-import preview modal showing item counts and requiring confirmation.
 *
 * @param {object} options
 * @param {{ categoryCount: number, bookmarkCount: number, skippedBookmarksCount?: number }} options.summary
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
      'aria-label': 'Close dialog',
      html: ICON_CLOSE,
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
      ),
      summary.skippedBookmarksCount ? el('div', {},
        el('div', { text: String(summary.skippedBookmarksCount), style: { fontSize: '20px', fontWeight: '600', color: 'var(--color-warning, #f59e0b)' } }),
        el('div', { text: 'Skipped', style: { fontSize: '11px', color: 'var(--text-muted)' } })
      ) : null
    ),
    summary.skippedBookmarksCount ? el('p', {
      text: `${summary.skippedBookmarksCount} bookmark(s) will be skipped due to invalid or dangerous URLs.`,
      style: { fontSize: 'var(--text-xs)', color: 'var(--color-warning, #f59e0b)' }
    }) : null,
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
      'aria-label': 'Close dialog',
      html: ICON_CLOSE,
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
