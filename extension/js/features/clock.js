// @ts-check
import { store } from '../core/state.js';

let clockInterval = null;

/**
 * Updates the digital clock, date string, and personalized greeting in the DOM.
 * @param {import('../core/schema.js').DashboardData['settings']} settings
 */
export function renderClockAndGreeting(settings) {
  const clockEl = document.getElementById('clock-display');
  const dateEl = document.getElementById('date-display');
  const greetingEl = document.getElementById('greeting-display');

  if (!clockEl && !dateEl && !greetingEl) return;

  const now = new Date();

  // Clock
  if (clockEl) {
    if (!settings.showClock) {
      clockEl.style.display = 'none';
    } else {
      clockEl.style.display = 'block';
      const is24h = settings.timeFormat === '24h';
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      let ampm = '';

      if (!is24h) {
        ampm = hours >= 12 ? ' PM' : ' AM';
        hours = hours % 12 || 12;
      }

      clockEl.textContent = `${hours}:${minutes}${ampm}`;
    }
  }

  // Date
  if (dateEl) {
    if (!settings.showDate) {
      dateEl.style.display = 'none';
    } else {
      dateEl.style.display = 'inline';
      const options = { weekday: 'long', month: 'short', day: 'numeric' };
      dateEl.textContent = now.toLocaleDateString(undefined, options);
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
      greetingEl.textContent = `${greeting} •`;
    }
  }
}

/**
 * Starts automatic clock ticking.
 */
export function startClockTicker() {
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(() => {
    renderClockAndGreeting(store.get().settings);
  }, 1000 * 15);
}
