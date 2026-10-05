// @ts-check

let active = false;
let idle = false;
let idleTimer = null;
let boundPointerMove = null;
let boundKeyDown = null;

const IDLE_TIMEOUT_MS = 4000;

/**
 * Returns whether auto-hide mode is enabled.
 * @returns {boolean}
 */
export function isAutoHideActive() {
  return active;
}

/**
 * Returns whether auto-hide is currently in idle state (hidden).
 * @returns {boolean}
 */
export function isAutoHideIdle() {
  return idle;
}

/**
 * Schedules transition to idle (hidden) mode after user inactivity.
 */
function scheduleIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  if (!active) return;

  idleTimer = setTimeout(() => {
    if (typeof document === 'undefined') return;

    // Do not hide if user is focused on an input or if dialog/drawer is open
    const activeEl = document.activeElement;
    const activeTag = activeEl?.tagName || '';
    const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) ||
      Boolean(activeEl && /** @type {HTMLElement} */ (activeEl).isContentEditable);
    const isDialogOpen = Boolean(document.querySelector?.('dialog[open], .settings-drawer.open'));

    if (!isInputFocused && !isDialogOpen) {
      idle = true;
      if (document.body) {
        document.body.classList.add('auto-hide-idle');
      }
    } else {
      scheduleIdle();
    }
  }, IDLE_TIMEOUT_MS);

  if (idleTimer && typeof idleTimer.unref === 'function') {
    idleTimer.unref();
  }
}

/**
 * Handler for user activity (pointer move or key press).
 */
function handleActivity() {
  if (!active) return;
  if (idle) {
    idle = false;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('auto-hide-idle');
    }
  }
  scheduleIdle();
}

/**
 * Cleans up all auto-hide event listeners and timers.
 */
export function destroyAutoHide() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  if (typeof window !== 'undefined') {
    if (boundPointerMove) window.removeEventListener('pointermove', boundPointerMove);
    if (boundKeyDown) window.removeEventListener('keydown', boundKeyDown);
  }

  boundPointerMove = null;
  boundKeyDown = null;

  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.remove('auto-hide-enabled');
    document.body.classList.remove('auto-hide-idle');
  }

  active = false;
  idle = false;
}

/**
 * Initializes or updates auto-hide mode based on dashboard settings.
 * @param {import('../core/schema.js').DashboardData['settings']} settings
 */
export function initAutoHide(settings) {
  destroyAutoHide();

  const isEnabled = Boolean(settings?.behavior?.autoHide);
  if (!isEnabled) return;

  active = true;
  idle = true;

  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.add('auto-hide-enabled');
    document.body.classList.add('auto-hide-idle');
  }

  boundPointerMove = () => handleActivity();
  boundKeyDown = () => handleActivity();

  if (typeof window !== 'undefined') {
    window.addEventListener('pointermove', boundPointerMove, { passive: true });
    window.addEventListener('keydown', boundKeyDown, { passive: true });
  }

  scheduleIdle();
}
