// @ts-check
import { store } from '../core/state.js';

let clockInterval = null;
let currentTickerSeconds = null;

/**
 * Validates whether a timezone identifier is valid and supported by the runtime.
 * @param {string} tz
 * @returns {boolean}
 */
export function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  if (tz === 'UTC' || tz === 'GMT') return true;
  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    try {
      const supported = Intl.supportedValuesOf('timeZone');
      return supported.includes(tz);
    } catch {
      // fallback
    }
  }
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a list of supported timezones.
 * @returns {string[]}
 */
export function getSupportedTimezones() {
  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {}
  }
  return [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
    'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney', 'Pacific/Auckland'
  ];
}

/**
 * Formats a date object according to the selected date format.
 * @param {Date} date
 * @param {string} [format='weekday-short']
 * @returns {string}
 */
export function formatDate(date, format = 'weekday-short') {
  if (!date || isNaN(date.getTime())) return '';
  switch (format) {
    case 'iso': {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    case 'weekday-full':
    case 'full':
      return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    case 'short':
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    case 'day-first':
      return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    case 'weekday-short':
    default:
      return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }
}

/**
 * Formats time in a secondary timezone.
 * @param {Date} date
 * @param {string} timezone
 * @param {boolean} [is24h=false]
 * @param {boolean} [showSeconds=false]
 * @returns {string}
 */
export function formatSecondTimezone(date, timezone, is24h = false, showSeconds = false) {
  if (!isValidTimezone(timezone)) return '';

  const parts = timezone.split('/');
  const rawLabel = parts[parts.length - 1] || timezone;
  const label = rawLabel.replace(/_/g, ' ');

  /** @type {Intl.DateTimeFormatOptions} */
  const options = {
    timeZone: timezone,
    hour: is24h ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: !is24h
  };
  if (showSeconds) {
    options.second = '2-digit';
  }

  const timeStr = new Intl.DateTimeFormat(undefined, options).format(date);
  return `${label}: ${timeStr}`;
}

/**
 * Updates the digital clock, date string, and personalized greeting in the DOM.
 * @param {import('../core/schema.js').DashboardData['settings']} settings
 */
export function renderClockAndGreeting(settings) {
  const clockEl = document.getElementById('clock-display');
  const dateEl = document.getElementById('date-display');
  const greetingEl = document.getElementById('greeting-display');
  let secondTzEl = document.getElementById('clock-second-tz');
  const headerEl = document.querySelector('.dashboard-header');

  if (!clockEl && !dateEl && !greetingEl && !secondTzEl) return;

  const now = new Date();
  const clockConf = settings?.clock || {};
  const clockStyle = clockConf.style === 'small' ? 'small' : (clockConf.style === 'left' || clockConf.style === 'left-aligned' ? 'left' : 'large');
  const showSeconds = Boolean(clockConf.showSeconds);
  const is24h = settings?.timeFormat === '24h';

  if (headerEl) {
    headerEl.classList.toggle('clock-style-large', clockStyle === 'large');
    headerEl.classList.toggle('clock-style-small', clockStyle === 'small');
    headerEl.classList.toggle('clock-style-left', clockStyle === 'left');
  }

  // Clock
  if (clockEl) {
    if (!settings.showClock) {
      clockEl.style.display = 'none';
    } else {
      clockEl.style.display = 'block';
      clockEl.className = `clock-display clock-${clockStyle}`;

      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      let ampm = '';

      if (!is24h) {
        ampm = hours >= 12 ? ' PM' : ' AM';
        hours = hours % 12 || 12;
      }

      if (showSeconds) {
        const seconds = String(now.getSeconds()).padStart(2, '0');
        clockEl.textContent = `${hours}:${minutes}:${seconds}${ampm}`;
      } else {
        clockEl.textContent = `${hours}:${minutes}${ampm}`;
      }
    }
  }

  // Date
  if (dateEl) {
    if (!settings.showDate) {
      dateEl.style.display = 'none';
    } else {
      dateEl.style.display = 'inline';
      dateEl.textContent = formatDate(now, clockConf.dateFormat);
    }
  }

  // Greeting
  if (greetingEl) {
    if (!settings.showGreeting) {
      greetingEl.style.display = 'none';
    } else {
      greetingEl.style.display = 'inline';
      const hours = now.getHours();
      let greeting = 'Good evening';
      if (hours < 12) greeting = 'Good morning';
      else if (hours < 17) greeting = 'Good afternoon';

      const userName = (settings.userName || '').trim();
      if (userName) {
        greetingEl.textContent = `${greeting}, ${userName} •`;
      } else {
        greetingEl.textContent = `${greeting} •`;
      }
    }
  }

  // Second Timezone
  if (clockConf.secondTimezone && isValidTimezone(clockConf.secondTimezone)) {
    if (!secondTzEl) {
      secondTzEl = document.createElement('div');
      secondTzEl.id = 'clock-second-tz';
      secondTzEl.className = 'clock-second-tz';
      if (headerEl) headerEl.appendChild(secondTzEl);
    }
    if (secondTzEl) {
      secondTzEl.style.display = 'block';
      secondTzEl.textContent = formatSecondTimezone(now, clockConf.secondTimezone, is24h, showSeconds);
    }
  } else if (secondTzEl) {
    secondTzEl.style.display = 'none';
    secondTzEl.textContent = '';
  }

}

/**
 * Starts automatic clock ticking.
 */
export function startClockTicker() {
  const currentSettings = store.get()?.settings;
  const needsSecondTicker = Boolean(currentSettings?.clock?.showSeconds);

  if (clockInterval && currentTickerSeconds === needsSecondTicker) {
    return;
  }

  if (clockInterval) clearInterval(clockInterval);
  currentTickerSeconds = needsSecondTicker;
  const intervalMs = needsSecondTicker ? 1000 : 15000;

  clockInterval = setInterval(() => {
    const s = store.get()?.settings;
    if (s) renderClockAndGreeting(s);
  }, intervalMs);

  if (clockInterval && typeof clockInterval.unref === 'function') {
    clockInterval.unref();
  }
}

/**
 * Stops automatic clock ticking.
 */
export function stopClockTicker() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
    currentTickerSeconds = null;
  }
}
