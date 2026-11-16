// @ts-check
import { el } from '../utils/dom.js';
import { showToast } from '../ui/toasts.js';
import { ICON_CLOCK, ICON_PLAY, ICON_PAUSE, ICON_REFRESH } from '../ui/icons.js';

export const ICON_BELL = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>`;
export const ICON_BELL_OFF = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" aria-hidden="true"><path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"></path><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>`;

export const POMODORO_PRESETS = {
  classic: { label: '25/5', focus: 25, break: 5, longBreak: 15 },
  deep:    { label: '50/10', focus: 50, break: 10, longBreak: 20 },
  sprint:  { label: '15/3', focus: 15, break: 3, longBreak: 10 }
};

let timerInterval = null;
let currentPresetKey = 'classic';
let currentMode = 'focus'; // 'focus' | 'break' | 'long-break'
let remainingSeconds = POMODORO_PRESETS.classic.focus * 60;
let isRunning = false;
let completedPomodoros = 0;
let soundEnabled = true;
let originalDocumentTitle = '';

/**
 * Resets timer state (for tests and teardown).
 */
export function _resetTimerForTests() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  currentPresetKey = 'classic';
  currentMode = 'focus';
  remainingSeconds = POMODORO_PRESETS.classic.focus * 60;
  isRunning = false;
  completedPomodoros = 0;
  soundEnabled = true;
  if (typeof document !== 'undefined' && originalDocumentTitle) {
    document.title = originalDocumentTitle;
    originalDocumentTitle = '';
  }
}

/**
 * Gets the total seconds for the current mode and preset.
 * @returns {number}
 */
export function getTotalSecondsForMode() {
  const preset = POMODORO_PRESETS[currentPresetKey] || POMODORO_PRESETS.classic;
  if (currentMode === 'long-break') return preset.longBreak * 60;
  if (currentMode === 'break') return preset.break * 60;
  return preset.focus * 60;
}

/**
 * Synthesizes a gentle two-tone chime notification via Web Audio API.
 */
export function playNotificationChime() {
  if (!soundEnabled) return;
  try {
    const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window['webkitAudioContext']) : null;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.14); // A5
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc.start(now);
    osc.stop(now + 0.65);
  } catch (_) {}
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
 * Updates browser tab title with countdown when active.
 */
function updateDocumentTitle() {
  if (typeof document === 'undefined') return;
  if (!originalDocumentTitle) {
    originalDocumentTitle = document.title || 'New Tab';
  }
  if (isRunning) {
    document.title = `(${formatTimer(remainingSeconds)}) ${originalDocumentTitle}`;
  } else {
    document.title = originalDocumentTitle;
  }
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

  // Header Title Group
  const roundNum = (completedPomodoros % 4) + 1;
  const modeText = currentMode === 'focus'
    ? `Focus · Round ${roundNum}/4`
    : (currentMode === 'long-break' ? 'Long Break' : 'Short Break');

  const titleGroup = el('div', { className: 'widget-title-group' }, [
    el('span', { className: 'widget-title', html: `${ICON_CLOCK}<span>Focus Timer</span>` }),
    el('span', { className: 'widget-space-badge timer-mode-badge', text: modeText })
  ]);

  const soundBtn = el('button', {
    className: 'btn-quiet btn-icon-only timer-sound-btn',
    type: 'button',
    title: soundEnabled ? 'Mute notification chime' : 'Unmute notification chime',
    'aria-label': soundEnabled ? 'Mute chime' : 'Unmute chime',
    html: soundEnabled ? ICON_BELL : ICON_BELL_OFF,
    onclick: () => {
      soundEnabled = !soundEnabled;
      soundBtn.innerHTML = soundEnabled ? ICON_BELL : ICON_BELL_OFF;
      soundBtn.title = soundEnabled ? 'Mute notification chime' : 'Unmute notification chime';
      showToast(soundEnabled ? 'Timer chime enabled' : 'Timer chime muted');
    }
  });

  const headerActions = el('div', { className: 'timer-header-actions' }, [soundBtn]);
  const header = el('div', { className: 'widget-header' }, [titleGroup, headerActions]);

  // Preset Selector Bar (25/5 · 50/10 · 15/3)
  const presetPills = Object.entries(POMODORO_PRESETS).map(([key, p]) => {
    return el('button', {
      className: `timer-preset-pill${currentPresetKey === key ? ' is-active' : ''}`,
      type: 'button',
      text: p.label,
      onclick: () => {
        if (currentPresetKey === key) return;
        currentPresetKey = key;
        resetTimer(card);
      }
    });
  });
  const presetRow = el('div', { className: 'timer-preset-row' }, presetPills);

  // Digits display
  const digits = el('div', {
    className: 'timer-digits-display',
    'aria-live': 'off',
    text: formatTimer(remainingSeconds)
  });

  // Progress bar
  const total = getTotalSecondsForMode();
  const pct = Math.max(0, Math.min(100, Math.round((remainingSeconds / total) * 100)));
  const progressFill = el('div', {
    className: `timer-progress-fill${currentMode !== 'focus' ? ' is-break' : ''}`,
    style: { width: `${pct}%` }
  });
  const progressTrack = el('div', { className: 'timer-progress-track', 'aria-hidden': 'true' }, [progressFill]);

  // Controls row
  const playBtn = el('button', {
    className: 'btn-primary btn-sm timer-play-btn',
    type: 'button',
    html: isRunning ? `${ICON_PAUSE}<span>Pause</span>` : `${ICON_PLAY}<span>Start</span>`,
    onclick: () => {
      toggleRunning(card);
    }
  });

  const resetBtn = el('button', {
    className: 'btn-quiet btn-sm timer-reset-btn',
    type: 'button',
    html: `${ICON_REFRESH}<span>Reset</span>`,
    onclick: () => {
      resetTimer(card);
    }
  });

  const modeToggleBtn = el('button', {
    className: 'btn-quiet btn-sm timer-mode-btn',
    type: 'button',
    text: currentMode === 'focus' ? 'Switch to Break' : 'Switch to Focus',
    onclick: () => {
      toggleMode(card);
    }
  });

  const controls = el('div', { className: 'timer-controls-row' }, [playBtn, resetBtn, modeToggleBtn]);

  card.appendChild(header);
  card.appendChild(presetRow);
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
    playBtn.innerHTML = isRunning ? `${ICON_PAUSE}<span>Pause</span>` : `${ICON_PLAY}<span>Start</span>`;
  }

  const roundNum = (completedPomodoros % 4) + 1;
  const modeText = currentMode === 'focus'
    ? `Focus · Round ${roundNum}/4`
    : (currentMode === 'long-break' ? 'Long Break' : 'Short Break');

  const modeBadge = card.querySelector('.timer-mode-badge');
  if (modeBadge) modeBadge.textContent = modeText;

  const modeBtn = card.querySelector('.timer-mode-btn');
  if (modeBtn) modeBtn.textContent = currentMode === 'focus' ? 'Switch to Break' : 'Switch to Focus';

  const presetPills = card.querySelectorAll('.timer-preset-pill');
  if (presetPills && presetPills.length > 0) {
    const keys = Object.keys(POMODORO_PRESETS);
    presetPills.forEach((pill, idx) => {
      pill.classList.toggle('is-active', keys[idx] === currentPresetKey);
    });
  }

  const progressFill = card.querySelector('.timer-progress-fill');
  if (progressFill) {
    const total = getTotalSecondsForMode();
    const pct = Math.max(0, Math.min(100, Math.round((remainingSeconds / total) * 100)));
    progressFill.style.width = `${pct}%`;
    if (progressFill.classList) {
      progressFill.classList.toggle('is-break', currentMode !== 'focus');
    }
  }

  updateDocumentTitle();
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

        // Auto progression between focus and break
        playNotificationChime();
        if (currentMode === 'focus') {
          completedPomodoros++;
          const isLongBreak = (completedPomodoros % 4) === 0;
          currentMode = isLongBreak ? 'long-break' : 'break';
          remainingSeconds = getTotalSecondsForMode();
          try {
            showToast(isLongBreak
              ? '4 Focus rounds completed! Enjoy a 15-minute Long Break 🌴'
              : 'Focus session complete! Take a quick 5-minute break ☕');
          } catch (_) {}
        } else {
          currentMode = 'focus';
          remainingSeconds = getTotalSecondsForMode();
          try {
            showToast('Break is over! Ready for the next focus session?');
          } catch (_) {}
        }

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
  remainingSeconds = getTotalSecondsForMode();
  updateTimerDisplay(card);
}

function toggleMode(card) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isRunning = false;
  currentMode = currentMode === 'focus' ? 'break' : 'focus';
  remainingSeconds = getTotalSecondsForMode();
  updateTimerDisplay(card);
}
