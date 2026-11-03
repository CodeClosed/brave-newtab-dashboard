// @ts-check
import { store } from '../core/state.js';
import { el, clearChildren } from '../utils/dom.js';
import { showToast } from '../ui/toasts.js';
import { openConfirmDialog } from '../ui/dialogs.js';
import {
  DEFAULT_ICON_KEYS,
  ICON_LABELS,
  ICON_CLOSE,
  ICON_PLUS,
  ICON_EDIT,
  ICON_TRASH,
  ICON_ARROW_LEFT,
  ICON_ARROW_RIGHT,
  ICON_MORE_HORIZONTAL,
  getIconSvg,
  resolveIconKey
} from '../ui/icons.js';

let activeSpaceMenu = null;

/**
 * Closes any open space management dropdown.
 */
export function closeActiveSpaceMenu() {
  if (activeSpaceMenu && activeSpaceMenu.parentNode) {
    activeSpaceMenu.parentNode.removeChild(activeSpaceMenu);
  }
  activeSpaceMenu = null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (activeSpaceMenu && !activeSpaceMenu.contains(/** @type {Node} */ (e.target))) {
      closeActiveSpaceMenu();
    }
  });
}

/**
 * Cycles to the next or previous space.
 * @param {'next' | 'prev'} [direction='next']
 * @returns {import('../core/schema.js').Space | null}
 */
export function cycleSpace(direction = 'next') {
  const state = store.getState();
  if (!state.spaces || state.spaces.length <= 1) {
    return null;
  }

  const sortedSpaces = [...state.spaces].sort((a, b) => a.order - b.order);
  const currentIndex = sortedSpaces.findIndex(s => s.id === state.activeSpaceId);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;

  let nextIndex;
  if (direction === 'next') {
    nextIndex = (safeIndex + 1) % sortedSpaces.length;
  } else {
    nextIndex = (safeIndex - 1 + sortedSpaces.length) % sortedSpaces.length;
  }

  const targetSpace = sortedSpaces[nextIndex];
  store.setActiveSpace(targetSpace.id);
  showToast(`Switched to space "${targetSpace.name}"`);
  return targetSpace;
}

/**
 * Opens dialog to add a new space.
 */
export function openAddSpaceDialog() {
  let dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('space-dialog'));
  if (!dialog) {
    dialog = /** @type {HTMLDialogElement} */ (el('dialog', {
      id: 'space-dialog',
      className: 'modal-content',
      'aria-labelledby': 'space-dialog-title'
    }));
    document.body.appendChild(dialog);
  }

  clearChildren(dialog);

  let selectedIcon = 'folder';

  const title = el('h2', { id: 'space-dialog-title', className: 'modal-title' }, ['New Space']);
  const closeBtn = el('button', {
    type: 'button',
    className: 'btn-icon modal-close-btn',
    'aria-label': 'Close dialog',
    html: ICON_CLOSE,
    onclick: () => dialog?.close()
  });

  const header = el('div', { className: 'modal-header' }, [title, closeBtn]);

  const nameInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'form-input',
    placeholder: 'Space name (e.g. Work, Study, Projects)',
    required: true,
    maxLength: 60
  }));

  const iconContainer = el('div', { className: 'emoji-selector' });
  for (const iconKey of DEFAULT_ICON_KEYS.slice(0, 12)) {
    const label = ICON_LABELS[iconKey] || iconKey;
    const pill = el('button', {
      className: `emoji-pill${selectedIcon === iconKey ? ' selected' : ''}`,
      type: 'button',
      title: label,
      'aria-label': `Icon ${label}`,
      dataset: { icon: iconKey },
      html: getIconSvg(iconKey, 16),
      onclick: () => {
        selectedIcon = iconKey;
        iconContainer.querySelectorAll('.emoji-pill').forEach(btn => {
          btn.classList.toggle('selected', /** @type {HTMLElement} */ (btn).dataset.icon === iconKey);
        });
      }
    });
    iconContainer.appendChild(pill);
  }

  const nameGroup = el('div', { className: 'form-group' }, [
    el('label', { className: 'form-label' }, ['Name']),
    nameInput
  ]);

  const iconGroup = el('div', { className: 'form-group' }, [
    el('label', { className: 'form-label' }, ['Space Icon']),
    iconContainer
  ]);

  const cancelBtn = el('button', {
    type: 'button',
    className: 'btn-secondary',
    onclick: () => dialog?.close()
  }, ['Cancel']);

  const saveBtn = el('button', {
    type: 'submit',
    className: 'btn-primary'
  }, ['Create Space']);

  const actions = el('div', { className: 'modal-actions' }, [cancelBtn, saveBtn]);

  const form = el('form', { className: 'modal-body' }, [nameGroup, iconGroup, actions]);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameVal = nameInput.value.trim();
    if (!nameVal) return;
    const newSpace = store.addSpace({ name: nameVal, icon: selectedIcon });
    store.setActiveSpace(newSpace.id);
    showToast(`Created space "${newSpace.name}"`);
    dialog?.close();
  });

  dialog.appendChild(header);
  dialog.appendChild(form);

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  nameInput.focus();
}

/**
 * Opens dialog to rename a space.
 * @param {import('../core/schema.js').Space} space
 */
export function openRenameSpaceDialog(space) {
  let dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('space-dialog'));
  if (!dialog) {
    dialog = /** @type {HTMLDialogElement} */ (el('dialog', {
      id: 'space-dialog',
      className: 'modal-content',
      'aria-labelledby': 'space-dialog-title'
    }));
    document.body.appendChild(dialog);
  }

  clearChildren(dialog);

  let selectedIcon = resolveIconKey(space.icon || 'folder', 'folder');

  const title = el('h2', { id: 'space-dialog-title', className: 'modal-title' }, ['Rename Space']);
  const closeBtn = el('button', {
    type: 'button',
    className: 'btn-icon modal-close-btn',
    'aria-label': 'Close dialog',
    html: ICON_CLOSE,
    onclick: () => dialog?.close()
  });

  const header = el('div', { className: 'modal-header' }, [title, closeBtn]);

  const nameInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'form-input',
    value: space.name,
    required: true,
    maxLength: 60
  }));

  const iconContainer = el('div', { className: 'emoji-selector' });
  for (const iconKey of DEFAULT_ICON_KEYS.slice(0, 12)) {
    const label = ICON_LABELS[iconKey] || iconKey;
    const pill = el('button', {
      className: `emoji-pill${selectedIcon === iconKey ? ' selected' : ''}`,
      type: 'button',
      title: label,
      'aria-label': `Icon ${label}`,
      dataset: { icon: iconKey },
      html: getIconSvg(iconKey, 16),
      onclick: () => {
        selectedIcon = iconKey;
        iconContainer.querySelectorAll('.emoji-pill').forEach(btn => {
          btn.classList.toggle('selected', /** @type {HTMLElement} */ (btn).dataset.icon === iconKey);
        });
      }
    });
    iconContainer.appendChild(pill);
  }

  const nameGroup = el('div', { className: 'form-group' }, [
    el('label', { className: 'form-label' }, ['Name']),
    nameInput
  ]);

  const iconGroup = el('div', { className: 'form-group' }, [
    el('label', { className: 'form-label' }, ['Space Icon']),
    iconContainer
  ]);

  const cancelBtn = el('button', {
    type: 'button',
    className: 'btn-secondary',
    onclick: () => dialog?.close()
  }, ['Cancel']);

  const saveBtn = el('button', {
    type: 'submit',
    className: 'btn-primary'
  }, ['Save']);

  const actions = el('div', { className: 'modal-actions' }, [cancelBtn, saveBtn]);

  const form = el('form', { className: 'modal-body' }, [nameGroup, iconGroup, actions]);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameVal = nameInput.value.trim();
    if (!nameVal) return;
    store.updateSpace(space.id, { name: nameVal, icon: selectedIcon });
    showToast(`Updated space "${nameVal}"`);
    dialog?.close();
  });

  dialog.appendChild(header);
  dialog.appendChild(form);

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  nameInput.focus();
}

/**
 * Opens dialog to delete a space.
 * @param {import('../core/schema.js').Space} space
 */
export function openDeleteSpaceDialog(space) {
  const state = store.getState();
  if (!state.spaces || state.spaces.length <= 1) {
    showToast('Cannot delete the only remaining space');
    return;
  }

  const collectionsInSpace = (state.categories || []).filter(c => c.spaceId === space.id);
  const otherSpaces = state.spaces.filter(s => s.id !== space.id);

  if (collectionsInSpace.length === 0) {
    openConfirmDialog({
      title: `Delete Space "${space.name}"?`,
      message: `Are you sure you want to delete the space "${space.name}"?`,
      confirmText: 'Delete Space',
      onConfirm: () => {
        const undo = store.deleteSpace(space.id, { transferToSpaceId: null });
        showToast(`Deleted space "${space.name}"`, undo);
      }
    });
    return;
  }

  // If collections exist in this space, prompt how to handle them
  let dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('space-delete-dialog'));
  if (!dialog) {
    dialog = /** @type {HTMLDialogElement} */ (el('dialog', {
      id: 'space-delete-dialog',
      className: 'modal-content',
      'aria-labelledby': 'space-delete-title'
    }));
    document.body.appendChild(dialog);
  }

  clearChildren(dialog);

  const title = el('h2', { id: 'space-delete-title', className: 'modal-title' }, [`Delete "${space.name}"`]);
  const closeBtn = el('button', {
    type: 'button',
    className: 'btn-icon modal-close-btn',
    'aria-label': 'Close dialog',
    html: ICON_CLOSE,
    onclick: () => dialog?.close()
  });

  const header = el('div', { className: 'modal-header' }, [title, closeBtn]);

  const p = el('p', { className: 'modal-desc' }, [
    `This space contains ${collectionsInSpace.length} collection(s). What would you like to do with them?`
  ]);

  const radioTransfer = /** @type {HTMLInputElement} */ (el('input', {
    type: 'radio',
    name: 'deleteAction',
    value: 'transfer',
    id: 'delete-action-transfer',
    checked: true
  }));

  const selectTargetSpace = /** @type {HTMLSelectElement} */ (el('select', { className: 'form-select', style: { marginTop: '6px' } },
    otherSpaces.map(s => el('option', { value: s.id }, [s.name]))
  ));

  const transferLabel = el('label', { htmlFor: 'delete-action-transfer', style: { display: 'block', fontWeight: '500' } }, [
    radioTransfer,
    el('span', { style: { marginLeft: '6px' } }, ['Move collections to another space:'])
  ]);

  const radioDelete = el('input', {
    type: 'radio',
    name: 'deleteAction',
    value: 'delete',
    id: 'delete-action-delete'
  });

  const deleteLabel = el('label', { htmlFor: 'delete-action-delete', style: { display: 'block', fontWeight: '500', marginTop: '12px' } }, [
    radioDelete,
    el('span', { style: { marginLeft: '6px' } }, ['Delete all collections and bookmarks in this space'])
  ]);

  const cancelBtn = el('button', {
    type: 'button',
    className: 'btn-secondary',
    onclick: () => dialog?.close()
  }, ['Cancel']);

  const confirmBtn = el('button', {
    type: 'button',
    className: 'btn-danger',
    onclick: () => {
      dialog?.close();
      const transfer = radioTransfer.checked;
      const transferToSpaceId = transfer ? selectTargetSpace.value : null;
      const undo = store.deleteSpace(space.id, { transferToSpaceId });
      showToast(`Deleted space "${space.name}"`, undo);
    }
  }, ['Delete Space']);

  const actions = el('div', { className: 'modal-actions' }, [cancelBtn, confirmBtn]);

  const body = el('div', { className: 'modal-body' }, [
    p,
    el('div', { className: 'form-group', style: { marginTop: '12px' } }, [
      transferLabel,
      selectTargetSpace,
      deleteLabel
    ]),
    actions
  ]);

  dialog.appendChild(header);
  dialog.appendChild(body);

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

/**
 * Opens dialog to move a category to a different space.
 * @param {import('../core/schema.js').Category} category
 */
export function openMoveCategoryToSpaceDialog(category) {
  const state = store.getState();
  const spaces = state.spaces || [];
  const otherSpaces = spaces.filter(s => s.id !== category.spaceId);

  if (otherSpaces.length === 0) {
    showToast('No other spaces available to move this collection to');
    return;
  }

  let dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('move-category-space-dialog'));
  if (!dialog) {
    dialog = /** @type {HTMLDialogElement} */ (el('dialog', {
      id: 'move-category-space-dialog',
      className: 'modal-content',
      'aria-labelledby': 'move-category-space-title'
    }));
    document.body.appendChild(dialog);
  }

  clearChildren(dialog);

  const title = el('h2', { id: 'move-category-space-title', className: 'modal-title' }, ['Move to space']);
  const closeBtn = el('button', {
    type: 'button',
    className: 'btn-icon modal-close-btn',
    'aria-label': 'Close dialog',
    html: ICON_CLOSE,
    onclick: () => dialog?.close()
  });

  const header = el('div', { className: 'modal-header' }, [title, closeBtn]);

  const desc = el('p', { className: 'modal-desc' }, [
    `Select which space to move collection "${category.name}" to:`
  ]);

  const list = el('div', { className: 'space-selection-list', style: { display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0' } },
    otherSpaces.map(sp => {
      const btn = el('button', {
        type: 'button',
        className: 'btn-secondary',
        style: { justifyContent: 'flex-start', padding: '8px 12px', gap: '8px' },
        onclick: () => {
          dialog?.close();
          const prevSpaceId = category.spaceId;
          store.moveCategoryToSpace(category.id, sp.id);
          showToast(`Moved "${category.name}" to "${sp.name}"`, () => {
            if (prevSpaceId) {
              store.moveCategoryToSpace(category.id, prevSpaceId);
            }
          });
        }
      }, [
        el('span', { html: getIconSvg(sp.icon || 'folder', 15) }),
        el('span', { text: sp.name })
      ]);
      return btn;
    })
  );

  const cancelBtn = el('button', {
    type: 'button',
    className: 'btn-secondary',
    onclick: () => dialog?.close()
  }, ['Cancel']);

  const actions = el('div', { className: 'modal-actions' }, [cancelBtn]);
  const body = el('div', { className: 'modal-body' }, [desc, list, actions]);

  dialog.appendChild(header);
  dialog.appendChild(body);

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

/**
 * Opens space options dropdown menu.
 * @param {HTMLElement} triggerBtn
 * @param {import('../core/schema.js').Space} currentSpace
 * @param {number} spaceIndex
 * @param {number} totalSpaces
 */
function openSpaceOptionsMenu(triggerBtn, currentSpace, spaceIndex, totalSpaces) {
  closeActiveSpaceMenu();

  const menu = el('div', {
    className: 'menu-dropdown space-menu-dropdown',
    role: 'menu',
    'aria-label': 'Space options'
  });

  // Add space
  const addBtn = el('button', {
    type: 'button',
    className: 'menu-item',
    role: 'menuitem',
    html: `${ICON_PLUS}<span>New Space</span>`,
    onclick: () => {
      closeActiveSpaceMenu();
      openAddSpaceDialog();
    }
  });
  menu.appendChild(addBtn);

  // Rename space
  const renameBtn = el('button', {
    type: 'button',
    className: 'menu-item',
    role: 'menuitem',
    html: `${ICON_EDIT}<span>Rename space</span>`,
    onclick: () => {
      closeActiveSpaceMenu();
      openRenameSpaceDialog(currentSpace);
    }
  });
  menu.appendChild(renameBtn);

  // Move earlier
  if (spaceIndex > 0) {
    const moveEarlierBtn = el('button', {
      type: 'button',
      className: 'menu-item',
      role: 'menuitem',
      html: `${ICON_ARROW_LEFT}<span>Move earlier</span>`,
      onclick: () => {
        closeActiveSpaceMenu();
        store.reorderSpaces(spaceIndex, spaceIndex - 1);
      }
    });
    menu.appendChild(moveEarlierBtn);
  }

  // Move later
  if (spaceIndex < totalSpaces - 1) {
    const moveLaterBtn = el('button', {
      type: 'button',
      className: 'menu-item',
      role: 'menuitem',
      html: `${ICON_ARROW_RIGHT}<span>Move later</span>`,
      onclick: () => {
        closeActiveSpaceMenu();
        store.reorderSpaces(spaceIndex, spaceIndex + 1);
      }
    });
    menu.appendChild(moveLaterBtn);
  }

  // Delete space (if > 1 spaces)
  if (totalSpaces > 1) {
    const deleteBtn = el('button', {
      type: 'button',
      className: 'menu-item danger',
      role: 'menuitem',
      html: `${ICON_TRASH}<span>Delete space</span>`,
      onclick: () => {
        closeActiveSpaceMenu();
        openDeleteSpaceDialog(currentSpace);
      }
    });
    menu.appendChild(deleteBtn);
  }

  document.body.appendChild(menu);
  activeSpaceMenu = menu;

  const rect = triggerBtn.getBoundingClientRect();
  const top = rect.bottom + 4;
  const left = Math.max(8, rect.left);

  menu.style.top = `${top + (window.scrollY || 0)}px`;
  menu.style.left = `${left + (window.scrollX || 0)}px`;

  const firstItem = menu.querySelector('[role="menuitem"]');
  /** @type {HTMLElement | null} */ (firstItem)?.focus();
}

/**
 * Renders the space switcher component in the header.
 * Hidden until a second space exists.
 * @param {HTMLElement} container
 */
export function renderSpaceSwitcher(container) {
  if (!container) return;
  clearChildren(container);

  const state = store.getState();
  const spaces = state.spaces || [];

  // Hidden until a second space exists
  if (spaces.length <= 1) {
    container.hidden = true;
    container.style.display = 'none';
    return;
  }

  container.hidden = false;
  container.style.display = 'flex';

  const sortedSpaces = [...spaces].sort((a, b) => a.order - b.order);
  const activeSpaceId = state.activeSpaceId || sortedSpaces[0]?.id;

  const tabsGroup = el('div', { className: 'space-tabs-group', role: 'tablist', 'aria-label': 'Spaces' });

  sortedSpaces.forEach((sp) => {
    const isActive = sp.id === activeSpaceId;
    const tabBtn = el('button', {
      type: 'button',
      role: 'tab',
      className: `space-tab-btn${isActive ? ' is-active' : ''}`,
      'aria-selected': isActive ? 'true' : 'false',
      title: `${sp.name} ([ / ] to cycle)`,
      onclick: () => {
        if (!isActive) {
          store.setActiveSpace(sp.id);
        }
      }
    }, [
      el('span', { className: 'space-tab-icon', html: getIconSvg(sp.icon || 'folder', 14) }),
      el('span', { className: 'space-tab-name', text: sp.name })
    ]);

    tabsGroup.appendChild(tabBtn);
  });

  // Space management menu button
  const currentSpace = sortedSpaces.find(s => s.id === activeSpaceId) || sortedSpaces[0];
  const currentSpaceIndex = sortedSpaces.findIndex(s => s.id === activeSpaceId);

  const menuTrigger = el('button', {
    type: 'button',
    className: 'space-manage-btn nav-icon-btn',
    'aria-label': 'Space options',
    title: 'Manage spaces',
    html: ICON_MORE_HORIZONTAL,
    onclick: (e) => {
      e.stopPropagation();
      openSpaceOptionsMenu(menuTrigger, currentSpace, currentSpaceIndex >= 0 ? currentSpaceIndex : 0, sortedSpaces.length);
    }
  });

  container.appendChild(tabsGroup);
  container.appendChild(menuTrigger);
}
