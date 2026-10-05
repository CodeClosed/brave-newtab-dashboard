import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDaysRemaining,
  formatCountdown,
  renderClockAndGreeting
} from '../extension/js/features/clock.js';
import { repairSettings } from '../extension/js/core/migrate.js';
import { createDefaultSettings } from '../extension/js/core/schema.js';

test('6.3 Countdown: calculateDaysRemaining computes calendar day difference', () => {
  const baseDate = new Date(2026, 9, 5, 14, 0, 0); // Oct 5, 2026

  // 10 days in future
  const futureDate = '2026-10-15';
  assert.equal(calculateDaysRemaining(futureDate, baseDate), 10);

  // Tomorrow
  assert.equal(calculateDaysRemaining('2026-10-06', baseDate), 1);

  // Today
  assert.equal(calculateDaysRemaining('2026-10-05', baseDate), 0);

  // Yesterday
  assert.equal(calculateDaysRemaining('2026-10-04', baseDate), -1);

  // Past 5 days
  assert.equal(calculateDaysRemaining('2026-09-30', baseDate), -5);

  // Invalid inputs
  assert.equal(calculateDaysRemaining('', baseDate), null);
  assert.equal(calculateDaysRemaining('not-a-date', baseDate), null);
  assert.equal(calculateDaysRemaining(null, baseDate), null);
});

test('6.3 Countdown: formatCountdown formats friendly countdown strings', () => {
  const baseDate = new Date(2026, 9, 5, 12, 0, 0);

  assert.equal(formatCountdown('Vacation', '2026-10-15', baseDate), 'Vacation: 10 days left');
  assert.equal(formatCountdown('Exam', '2026-10-06', baseDate), 'Exam: 1 day left');
  assert.equal(formatCountdown('Launch', '2026-10-05', baseDate), 'Launch: Today!');
  assert.equal(formatCountdown('Deadline', '2026-10-04', baseDate), 'Deadline: 1 day ago');
  assert.equal(formatCountdown('Meeting', '2026-10-01', baseDate), 'Meeting: 4 days ago');

  // Fallback label
  assert.equal(formatCountdown('', '2026-10-10', baseDate), 'Event: 5 days left');

  // Invalid date returns empty string
  assert.equal(formatCountdown('Invalid', 'invalid-date', baseDate), '');
});

function createMockElement(id = '', initialClassName = '') {
  const el = {
    id,
    className: initialClassName,
    style: {},
    textContent: '',
    parentNode: null,
    classList: {
      add: (c) => {
        const parts = el.className ? el.className.split(' ').filter(Boolean) : [];
        if (!parts.includes(c)) {
          parts.push(c);
          el.className = parts.join(' ');
        }
      },
      remove: (c) => {
        const parts = el.className ? el.className.split(' ').filter(Boolean) : [];
        el.className = parts.filter(x => x !== c).join(' ');
      },
      toggle: (c, force) => {
        const has = el.classList.contains(c);
        const shouldHave = force !== undefined ? force : !has;
        if (shouldHave && !has) el.classList.add(c);
        else if (!shouldHave && has) el.classList.remove(c);
      },
      contains: (c) => {
        const parts = el.className ? el.className.split(' ').filter(Boolean) : [];
        return parts.includes(c);
      }
    }
  };
  return el;
}

test('6.3 Greeting & Countdown: renders personalized name and active countdown pill', () => {
  const clockEl = createMockElement('clock-display', 'clock-display');
  const dateEl = createMockElement('date-display', 'date-display');
  const greetingEl = createMockElement('greeting-display', 'greeting-display');
  const countdownEl = createMockElement('countdown-display', 'countdown-display');
  const tzEl = createMockElement('clock-second-tz', 'clock-second-tz');
  const headerEl = createMockElement('dashboard-header', 'dashboard-header');

  const elementMap = {
    'clock-display': clockEl,
    'date-display': dateEl,
    'greeting-display': greetingEl,
    'countdown-display': countdownEl,
    'clock-second-tz': tzEl
  };

  global.document = {
    getElementById: (id) => elementMap[id] || null,
    querySelector: (sel) => sel === '.dashboard-header' ? headerEl : null,
    createElement: (tag) => createMockElement()
  };

  const baseSettings = createDefaultSettings();

  // Test with userName and countdown
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 5);
  const targetDateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const customSettings = {
    ...baseSettings,
    userName: 'Alex',
    showGreeting: true,
    countdown: {
      label: 'Trip to Tokyo',
      date: targetDateStr
    }
  };

  renderClockAndGreeting(customSettings);

  assert.ok(greetingEl.textContent.includes('Alex'));
  assert.equal(countdownEl.style.display, 'inline-flex');
  assert.ok(countdownEl.textContent.includes('Trip to Tokyo: 5 days left'));

  // Test without countdown
  const noCountdownSettings = {
    ...baseSettings,
    userName: '',
    countdown: { label: '', date: null }
  };

  renderClockAndGreeting(noCountdownSettings);
  assert.ok(!greetingEl.textContent.includes('Alex'));
  assert.equal(countdownEl.style.display, 'none');
});

test('6.3 Migration: repairs userName and countdown', () => {
  const repaired = repairSettings({
    userName: '   Sam   ',
    countdown: {
      label: 'Conference',
      date: '2026-11-20'
    }
  });

  assert.equal(repaired.userName, '   Sam   ');
  assert.equal(repaired.countdown.label, 'Conference');
  assert.equal(repaired.countdown.date, '2026-11-20');

  // Invalid date normalized to null
  const invalid = repairSettings({
    countdown: {
      label: 'Invalid',
      date: 'not-a-valid-date'
    }
  });
  assert.equal(invalid.countdown.date, null);
});
