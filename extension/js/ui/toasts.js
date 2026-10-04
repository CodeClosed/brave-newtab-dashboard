// @ts-check
import { el } from '../utils/dom.js';

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = el('div', {
      className: 'toast-container',
      'aria-live': 'polite',
      'aria-atomic': 'true'
    });
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Shows a lightweight floating toast notification.
 *
 * @param {string} message
 * @param {(() => void) | null} [onUndo=null]
 * @param {number} [durationMs=5000]
 */
export function showToast(message, onUndo = null, durationMs = 5000) {
  if (typeof document === 'undefined') return;
  const container = ensureToastContainer();

  const msgSpan = el('span', { className: 'toast-message', text: message });
  /** @type {HTMLElement[]} */
  const children = [msgSpan];

  let dismissTimeout = null;
  let isPaused = false;

  const toast = el('div', { className: 'toast', role: 'status' });

  function scheduleDismiss(ms = durationMs) {
    if (dismissTimeout) clearTimeout(dismissTimeout);
    dismissTimeout = setTimeout(() => {
      dismissToast(toast);
    }, ms);
  }

  function pauseDismiss() {
    isPaused = true;
    if (dismissTimeout) {
      clearTimeout(dismissTimeout);
      dismissTimeout = null;
    }
  }

  function resumeDismiss() {
    isPaused = false;
    scheduleDismiss(durationMs);
  }

  toast.addEventListener('focusin', () => pauseDismiss());
  toast.addEventListener('focusout', (e) => {
    const related = /** @type {Node} */ (e?.relatedTarget);
    if (related && toast.contains(related)) return;
    resumeDismiss();
  });
  toast.addEventListener('mouseenter', () => pauseDismiss());
  toast.addEventListener('mouseleave', () => {
    if (typeof document !== 'undefined' && document.activeElement && toast.contains(document.activeElement)) return;
    resumeDismiss();
  });

  if (typeof onUndo === 'function') {
    const undoBtn = el('button', {
      className: 'toast-undo-btn',
      type: 'button',
      text: 'Undo',
      onclick: () => {
        if (dismissTimeout) clearTimeout(dismissTimeout);
        onUndo();
        dismissToast(toast);
      }
    });
    children.push(undoBtn);
  }

  for (const child of children) {
    toast.appendChild(child);
  }

  container.appendChild(toast);
  scheduleDismiss(durationMs);
}

/**
 * Gracefully animates out and removes a toast element.
 * @param {HTMLElement} toast
 */
function dismissToast(toast) {
  toast.classList.add('toast-hiding');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 200);
}
