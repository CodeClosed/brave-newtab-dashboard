// @ts-check
import { el } from '../utils/dom.js';
import { showToast } from '../ui/toasts.js';
import { ICON_CLOCK, ICON_PLAY, ICON_PAUSE, ICON_REFRESH } from '../ui/icons.js';

let timerInterval = null;
let remainingSeconds = 25 * 60;
let isRunning = false;
let currentMode = 'focus'; // 'focus' | 'break'

/**
 * Resets timer state (for tests and teardown).
 */
export function _resetTimerForTests() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  remainingSeconds = 25 * 60;
  isRunning = false;
  currentMode = 'focus';
}

/**
 * Formats seconds into MM:SS.
 * @param {number} sec
 * @returns {string}
 */
export function formatTimer(sec) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Renders or updates the Focus / Pomodoro timer widget.
 *
 * @param {HTMLElement | null} container
 * @param {import('../core/schema.js').DashboardData} state
 */
export function renderTimerWidget(container, state) {
  if (!container) return;

  const isEnabled = Boolean(state?.settings?.widgets?.timer);
  const heroConf = state?.settings?.hero?.widgets?.timer;
  const isHiddenByHero = Boolean(heroConf?.hidden);

  if (!isEnabled || isHiddenByHero) {
    container.hidden = true;
    container.style.display = 'none';
    return;
  }

  container.hidden = false;
  if (!container.dataset.freeDrag) {
    container.style.display = '';
  }

  let card = container.querySelector('.widget-timer');
  if (card) {
    updateTimerDisplay(card);
    return;
  }

  card = el('div', { className: 'widget-card widget-timer' });

  // Header
  const titleGroup = el('div', { className: 'widget-title-group' }, [
    el('span', { className: 'widget-title', text: 'Focus Timer', html: `${ICON_CLOCK}<span>Focus Timer</span>` }),
    el('span', { className: 'widget-space-badge timer-mode-badge', text: currentMode === 'focus' ? 'Focus (25m)' : 'Break (5m)' })
  ]);

  const modeToggleBtn = el('button', {
    className: 'btn-quiet btn-sm timer-mode-btn',
    type: 'button',
    text: currentMode === 'focus' ? 'Switch to Break' : 'Switch to Focus',
    onclick: () => {
      toggleMode(card);
    }
  });

  const header = el('div', { className: 'widget-header' }, [titleGroup, modeToggleBtn]);

  // Digits display
  const digits = el('div', { className: 'timer-digits-display', 'aria-live': 'off', text: formatTimer(remainingSeconds) });

  // Progress bar
  const totalSeconds = currentMode === 'focus' ? 25 * 60 : 5 * 60;
  const pct = Math.max(0, Math.min(100, Math.round((remainingSeconds / totalSeconds) * 100)));
  const progressFill = el('div', {
    className: `timer-progress-fill${currentMode === 'break' ? ' is-break' : ''}`,
    style: { width: `${pct}%` }
  });
  const progressTrack = el('div', { className: 'timer-progress-track', 'aria-hidden': 'true' }, [progressFill]);

  // Controls row
  const playBtn = el('button', {
    className: 'btn-primary btn-sm timer-play-btn',
    type: 'button',
    text: isRunning ? 'Pause' : 'Start',
    html: isRunning ? `${ICON_PAUSE}<span>Pause</span>` : `${ICON_PLAY}<span>Start</span>`,
    onclick: () => {
      toggleRunning(card);
    }
  });

  const resetBtn = el('button', {
    className: 'btn-quiet btn-sm timer-reset-btn',
    type: 'button',
    text: 'Reset',
    html: `${ICON_REFRESH}<span>Reset</span>`,
    onclick: () => {
      resetTimer(card);
    }
  });

  const controls = el('div', { className: 'timer-controls-row' }, [playBtn, resetBtn]);

  card.appendChild(header);
  card.appendChild(digits);
  card.appendChild(progressTrack);
  card.appendChild(controls);

  const existingFrame = container.querySelector ? container.querySelector('.widget-drag-frame') : null;
  if (typeof container.replaceChildren === 'function') {
    container.replaceChildren(card);
  } else {
    container.textContent = '';
    container.appendChild(card);
  }
  if (existingFrame) {
    container.appendChild(existingFrame);
  }
}

function updateTimerDisplay(card) {
  if (!card) return;
  const digits = card.querySelector('.timer-digits-display');
  if (digits) digits.textContent = formatTimer(remainingSeconds);

  const playBtn = card.querySelector('.timer-play-btn');
  if (playBtn) {
    playBtn.textContent = isRunning ? 'Pause' : 'Start';
    playBtn.innerHTML = isRunning ? `${ICON_PAUSE}<span>Pause</span>` : `${ICON_PLAY}<span>Start</span>`;
  }

  const modeBadge = card.querySelector('.timer-mode-badge');
  if (modeBadge) modeBadge.textContent = currentMode === 'focus' ? 'Focus (25m)' : 'Break (5m)';

  const modeBtn = card.querySelector('.timer-mode-btn');
  if (modeBtn) modeBtn.textContent = currentMode === 'focus' ? 'Switch to Break' : 'Switch to Focus';

  const progressFill = card.querySelector('.timer-progress-fill');
  if (progressFill) {
    const totalSeconds = currentMode === 'focus' ? 25 * 60 : 5 * 60;
    const pct = Math.max(0, Math.min(100, Math.round((remainingSeconds / totalSeconds) * 100)));
    progressFill.style.width = `${pct}%`;
    if (progressFill.classList) {
      progressFill.classList.toggle('is-break', currentMode === 'break');
    }
  }
}

function toggleRunning(card) {
  isRunning = !isRunning;
  if (isRunning) {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (remainingSeconds > 0) {
        remainingSeconds--;
        updateTimerDisplay(card);
      } else {
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;
        try {
          showToast(currentMode === 'focus' ? 'Focus session complete! Time for a short break.' : 'Break is over! Ready to focus again?');
        } catch (_) {}
        updateTimerDisplay(card);
      }
    }, 1000);
  } else {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  updateTimerDisplay(card);
}

function resetTimer(card) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isRunning = false;
  remainingSeconds = currentMode === 'focus' ? 25 * 60 : 5 * 60;
  updateTimerDisplay(card);
}

function toggleMode(card) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isRunning = false;
  currentMode = currentMode === 'focus' ? 'break' : 'focus';
  remainingSeconds = currentMode === 'focus' ? 25 * 60 : 5 * 60;
  updateTimerDisplay(card);
}
