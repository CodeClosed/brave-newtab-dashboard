// @ts-check

/**
 * Parses "HH:MM" 24-hour time string into minutes since midnight.
 * @param {string} timeStr
 * @returns {number}
 */
export function parseTimeToMinutes(timeStr) {
  if (typeof timeStr !== 'string') return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return 0;
  }
  return hours * 60 + minutes;
}

/**
 * Converts a time input (string "HH:MM", Date object, or undefined) to minutes since midnight.
 * @param {string | Date} [timeInput]
 * @returns {number}
 */
export function getMinutesSinceMidnight(timeInput) {
  if (typeof timeInput === 'string') {
    return parseTimeToMinutes(timeInput);
  }
  const date = timeInput instanceof Date ? timeInput : new Date();
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Resolves whether the scheduled theme should be 'light' or 'dark' based on schedule settings.
 *
 * @param {import('../core/schema.js').DashboardData['settings']['themeSchedule']} schedule
 * @param {string | Date} [timeInput]
 * @param {string} [fallbackTheme='system']
 * @returns {'light' | 'dark' | string}
 */
export function resolveScheduledTheme(schedule, timeInput, fallbackTheme = 'system') {
  if (!schedule || !schedule.enabled) {
    return fallbackTheme;
  }

  const currentMinutes = getMinutesSinceMidnight(timeInput);
  const lightMinutes = parseTimeToMinutes(schedule.lightFrom || '07:00');
  const darkMinutes = parseTimeToMinutes(schedule.darkFrom || '19:00');

  if (lightMinutes < darkMinutes) {
    // Standard daytime light: e.g. 07:00 to 19:00
    if (currentMinutes >= lightMinutes && currentMinutes < darkMinutes) {
      return 'light';
    }
    return 'dark';
  } else if (lightMinutes > darkMinutes) {
    // Overnight / night-shift light: e.g. 21:00 to 06:00
    if (currentMinutes >= lightMinutes || currentMinutes < darkMinutes) {
      return 'light';
    }
    return 'dark';
  } else {
    // Equal times fallback to light
    return 'light';
  }
}

/**
 * Checks schedule and applies theme switch to DOM root without page reload.
 *
 * @param {any} storeInstance
 * @param {HTMLElement | { setAttribute: Function, getAttribute?: Function, classList: { add: Function, remove: Function, contains: Function } }} [rootElement]
 * @param {string | Date} [timeInput]
 * @returns {{ appliedTheme: string, changed: boolean }}
 */
export function checkThemeSchedule(storeInstance, rootElement, timeInput) {
  const root = rootElement || (typeof document !== 'undefined' ? document.documentElement : null);
  if (!root) return { appliedTheme: 'system', changed: false };

  const settings = storeInstance.get().settings;
  const schedule = settings?.themeSchedule;

  if (!schedule || !schedule.enabled) {
    return { appliedTheme: settings?.theme || 'system', changed: false };
  }

  const targetTheme = resolveScheduledTheme(schedule, timeInput, settings?.theme || 'system');
  const currentTheme = typeof root.getAttribute === 'function' ? root.getAttribute('data-theme') : null;
  const isDark = targetTheme === 'dark';

  if (isDark) {
    root.classList?.add('dark');
    root.setAttribute?.('data-theme', 'dark');
  } else {
    root.classList?.remove('dark');
    root.setAttribute?.('data-theme', 'light');
  }

  return {
    appliedTheme: targetTheme,
    changed: currentTheme !== targetTheme
  };
}

/**
 * Starts periodic ticker that checks theme schedule without page reload.
 *
 * @param {any} storeInstance
 * @param {HTMLElement} [rootElement]
 * @param {number} [intervalMs=60000]
 * @returns {() => void} Cleanup stop function
 */
export function startThemeScheduleTicker(storeInstance, rootElement, intervalMs = 60000) {
  // Run immediate evaluation
  checkThemeSchedule(storeInstance, rootElement);

  const intervalId = setInterval(() => {
    checkThemeSchedule(storeInstance, rootElement);
  }, intervalMs);

  return () => {
    clearInterval(intervalId);
  };
}
