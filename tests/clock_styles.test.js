import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidTimezone,
  formatDate,
  formatSecondTimezone,
  renderClockAndGreeting
} from '../extension/js/features/clock.js';
import { repairSettings } from '../extension/js/core/migrate.js';
import { createDefaultSettings } from '../extension/js/core/schema.js';

test('6.1 Timezone Validation: isValidTimezone', () => {
  assert.equal(isValidTimezone('America/New_York'), true);
  assert.equal(isValidTimezone('Asia/Tokyo'), true);
  assert.equal(isValidTimezone('Europe/London'), true);
  assert.equal(isValidTimezone('UTC'), true);

  assert.equal(isValidTimezone('Invalid/Nowhere'), false);
  assert.equal(isValidTimezone('Mars/Olympus'), false);
  assert.equal(isValidTimezone(''), false);
  assert.equal(isValidTimezone(null), false);
  assert.equal(isValidTimezone(123), false);
});

test('6.1 Date Formatting: formatDate supports all specified formats', () => {
  const fixedDate = new Date('2026-10-05T14:30:00Z');

  const iso = formatDate(fixedDate, 'iso');
  assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);

  const shortStr = formatDate(fixedDate, 'short');
  assert.ok(shortStr.includes('2026'));

  const weekdayShort = formatDate(fixedDate, 'weekday-short');
  assert.ok(weekdayShort.length > 0);

  const weekdayFull = formatDate(fixedDate, 'weekday-full');
  assert.ok(weekdayFull.length >= weekdayShort.length);

  const dayFirst = formatDate(fixedDate, 'day-first');
  assert.ok(dayFirst.length > 0);
});

test('6.1 Second Timezone Formatting: formatSecondTimezone', () => {
  const fixedDate = new Date('2026-10-05T12:00:00Z');

  const utcTime = formatSecondTimezone(fixedDate, 'UTC', true, false);
  assert.ok(utcTime.includes('UTC: 12:00'));

  const utcTimeSec = formatSecondTimezone(fixedDate, 'UTC', true, true);
  assert.ok(utcTimeSec.includes('UTC: 12:00:00'));

  const tokyoTime = formatSecondTimezone(fixedDate, 'Asia/Tokyo', false, false);
  assert.match(tokyoTime, /Tokyo:\s*0?9:00\s*(pm|am)/i);
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

test('6.1 Clock Rendering: styles, seconds, date format and second timezone', () => {
  const clockEl = createMockElement('clock-display', 'clock-display');
  const dateEl = createMockElement('date-display', 'date-display');
  const greetingEl = createMockElement('greeting-display', 'greeting-display');
  const tzEl = createMockElement('clock-second-tz', 'clock-second-tz');
  const headerEl = createMockElement('dashboard-header', 'dashboard-header');

  const elementMap = {
    'clock-display': clockEl,
    'date-display': dateEl,
    'greeting-display': greetingEl,
    'clock-second-tz': tzEl
  };

  global.document = {
    getElementById: (id) => elementMap[id] || null,
    querySelector: (sel) => {
      if (sel === '.dashboard-header') return headerEl;
      return null;
    },
    createElement: (tag) => createMockElement()
  };

  const baseSettings = createDefaultSettings();

  // Test 1: Large clock with seconds
  const settingsWithSeconds = {
    ...baseSettings,
    showClock: true,
    showDate: true,
    timeFormat: '24h',
    clock: {
      style: 'large',
      showSeconds: true,
      secondTimezone: 'UTC',
      dateFormat: 'iso'
    }
  };

  renderClockAndGreeting(settingsWithSeconds);

  // Should have HH:MM:SS
  assert.match(clockEl.textContent, /^\d{1,2}:\d{2}:\d{2}$/);
  assert.ok(clockEl.classList.contains('clock-large'));
  assert.ok(headerEl.classList.contains('clock-style-large'));

  // Date should be ISO
  assert.match(dateEl.textContent, /^\d{4}-\d{2}-\d{2}$/);

  // Second TZ should be displayed
  assert.equal(tzEl.style.display, 'block');
  assert.ok(tzEl.textContent.includes('UTC:'));

  // Test 2: Small & Left-aligned clock without seconds and without second TZ
  const smallLeftSettings = {
    ...baseSettings,
    showClock: true,
    showDate: true,
    timeFormat: '12h',
    clock: {
      style: 'left',
      showSeconds: false,
      secondTimezone: null,
      dateFormat: 'weekday-short'
    }
  };

  renderClockAndGreeting(smallLeftSettings);

  assert.match(clockEl.textContent, /^\d{1,2}:\d{2} (AM|PM)$/i);
  assert.ok(headerEl.classList.contains('clock-style-left'));
  assert.equal(tzEl.style.display, 'none');
});

test('6.1 Settings Migration: repairs and validates clock settings', () => {
  const repaired = repairSettings({
    clock: {
      style: 'left-aligned',
      showSeconds: true,
      secondTimezone: 'Europe/Paris',
      dateFormat: 'iso'
    }
  });

  assert.equal(repaired.clock.style, 'left');
  assert.equal(repaired.clock.showSeconds, true);
  assert.equal(repaired.clock.secondTimezone, 'Europe/Paris');
  assert.equal(repaired.clock.dateFormat, 'iso');

  // Invalid timezone gets cleared to null
  const repairedInvalid = repairSettings({
    clock: {
      style: 'wildcard',
      showSeconds: 'notabool',
      secondTimezone: 'Atlantis/Underwater',
      dateFormat: 'unsupported'
    }
  });

  assert.equal(repairedInvalid.clock.style, 'large');
  assert.equal(repairedInvalid.clock.showSeconds, false);
  assert.equal(repairedInvalid.clock.secondTimezone, null);
  assert.equal(repairedInvalid.clock.dateFormat, 'weekday-short');
});
