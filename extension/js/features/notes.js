// @ts-check
import { el } from '../utils/dom.js';
import { t } from '../utils/i18n.js';

let saveTimeout = null;

/**
 * Resets internal timer for tests.
 */
export function _resetNotesTimerForTests() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}

/**
 * Renders or updates the Notes widget.
 * @param {any} container
 * @param {import('../core/schema.js').DashboardData} state
 * @param {(note: string) => void} [onSave]
 */
export function renderNotesWidget(container, state, onSave) {
  if (!container) return;

  const isEnabled = Boolean(state?.settings?.widgets?.notes);
  if (!isEnabled) {
    container.hidden = true;
    if (typeof container.replaceChildren === 'function') {
      container.replaceChildren();
    }
    return;
  }

  container.hidden = false;

  const activeSpace = state?.spaces?.find(s => s.id === state.activeSpaceId) || state?.spaces?.[0];
  const currentNote = activeSpace?.note || '';
  const spaceName = activeSpace?.name || 'Space';
  const spaceIcon = activeSpace?.icon || '📁';

  // Check if existing card and textarea already exist
  const existingCard = container.querySelector ? container.querySelector('.widget-notes') : null;
  const existingTextarea = container.querySelector ? container.querySelector('.widget-notes-textarea') : null;

  if (existingCard && existingTextarea) {
    // If textarea is currently focused by user, do not overwrite typing
    if (typeof document !== 'undefined' && document.activeElement === existingTextarea) {
      const spaceBadge = existingCard.querySelector ? existingCard.querySelector('.widget-space-badge') : null;
      if (spaceBadge) {
        spaceBadge.textContent = `${spaceIcon} ${spaceName}`;
      }
      return;
    }
    // Update textarea value to match active space
    existingTextarea.value = currentNote;
    if (existingTextarea.dataset) {
      existingTextarea.dataset.spaceId = activeSpace?.id || '';
    }
    const spaceBadge = existingCard.querySelector ? existingCard.querySelector('.widget-space-badge') : null;
    if (spaceBadge) {
      spaceBadge.textContent = `${spaceIcon} ${spaceName}`;
    }
    return;
  }

  // Build card
  const titleText = t('notesTitle', 'Notes');
  const placeholderText = t('notesPlaceholder', 'Write notes for this space...');

  const statusEl = el('span', { className: 'widget-status', text: 'Saved' });

  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', text: titleText }),
      el('span', { className: 'widget-space-badge', text: `${spaceIcon} ${spaceName}` })
    ]),
    statusEl
  ]);

  const textarea = /** @type {HTMLTextAreaElement} */ (el('textarea', {
    className: 'widget-notes-textarea',
    placeholder: placeholderText,
    ariaLabel: `${titleText} (${spaceName})`,
    dataset: { spaceId: activeSpace?.id || '' }
  }));
  textarea.value = currentNote;

  const flushSave = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    const val = textarea.value;
    if (onSave) {
      onSave(val);
    }
    statusEl.textContent = 'Saved';
  };

  textarea.addEventListener('input', () => {
    statusEl.textContent = 'Saving...';
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      flushSave();
    }, 400);
    // Unref timer in Node environment so test runner doesn't hang
    if (saveTimeout && typeof saveTimeout.unref === 'function') {
      saveTimeout.unref();
    }
  });

  textarea.addEventListener('blur', () => {
    flushSave();
  });

  const card = el('div', { className: 'widget-card widget-notes' }, [
    header,
    textarea
  ]);

  if (typeof container.replaceChildren === 'function') {
    container.replaceChildren(card);
  } else {
    container.appendChild(card);
  }
}
