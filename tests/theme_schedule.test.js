import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimeToMinutes,
  resolveScheduledTheme,
  checkThemeSchedule,
  startThemeScheduleTicker
} from '../extension/js/features/schedule.js';

test('4.6 Theme schedule: parseTimeToMinutes parses HH:MM to minutes since midnight', () => {
  assert.equal(parseTimeToMinutes('00:00'), 0);
  assert.equal(parseTimeToMinutes('07:00'), 420);
  assert.equal(parseTimeToMinutes('12:30'), 750);
  assert.equal(parseTimeToMinutes('19:00'), 1140);
  assert.equal(parseTimeToMinutes('23:59'), 1439);

  // Invalid fallbacks to 0
  assert.equal(parseTimeToMinutes('invalid'), 0);
  assert.equal(parseTimeToMinutes(''), 0);
});

test('4.6 Theme schedule: resolveScheduledTheme determines light vs dark based on time', () => {
  const schedule = {
    enabled: true,
    lightFrom: '07:00',
    darkFrom: '19:00'
  };

  // Disabled schedule returns fallback
  assert.equal(resolveScheduledTheme({ enabled: false }, '12:00', 'system'), 'system');
  assert.equal(resolveScheduledTheme({ enabled: false }, '12:00', 'dark'), 'dark');

  // Standard daytime schedule (07:00 to 19:00)
  assert.equal(resolveScheduledTheme(schedule, '06:59'), 'dark');
  assert.equal(resolveScheduledTheme(schedule, '07:00'), 'light');
  assert.equal(resolveScheduledTheme(schedule, '12:00'), 'light');
  assert.equal(resolveScheduledTheme(schedule, '18:59'), 'light');
  assert.equal(resolveScheduledTheme(schedule, '19:00'), 'dark');
  assert.equal(resolveScheduledTheme(schedule, '23:30'), 'dark');
  assert.equal(resolveScheduledTheme(schedule, '00:00'), 'dark');

  // Overnight schedule (light 21:00 to 06:00)
  const overnight = {
    enabled: true,
    lightFrom: '21:00',
    darkFrom: '06:00'
  };
  assert.equal(resolveScheduledTheme(overnight, '22:00'), 'light');
  assert.equal(resolveScheduledTheme(overnight, '03:00'), 'light');
  assert.equal(resolveScheduledTheme(overnight, '12:00'), 'dark');
});

test('4.6 Theme schedule: checkThemeSchedule updates root attributes without page reload', () => {
  const classes = new Set();
  const attributes = {};

  const mockRoot = {
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      contains(c) { return classes.has(c); }
    },
    setAttribute(k, v) { attributes[k] = String(v); },
    getAttribute(k) { return attributes[k]; }
  };

  const storeInstance = {
    get() {
      return {
        settings: {
          theme: 'system',
          themeSchedule: {
            enabled: true,
            lightFrom: '07:00',
            darkFrom: '19:00'
          }
        }
      };
    }
  };

  // Daytime check (12:00) -> should be light
  const resLight = checkThemeSchedule(storeInstance, mockRoot, '12:00');
  assert.equal(resLight.appliedTheme, 'light');
  assert.equal(attributes['data-theme'], 'light');
  assert.equal(mockRoot.classList.contains('dark'), false);

  // Nighttime check (22:00) -> should switch to dark without page reload
  const resDark = checkThemeSchedule(storeInstance, mockRoot, '22:00');
  assert.equal(resDark.appliedTheme, 'dark');
  assert.equal(attributes['data-theme'], 'dark');
  assert.equal(mockRoot.classList.contains('dark'), true);
});

test('4.6 Theme schedule: ticker starts and stops cleanly', () => {
  const mockRoot = {
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute() {},
    getAttribute() { return 'light'; }
  };

  const storeInstance = {
    get() {
      return {
        settings: {
          themeSchedule: { enabled: true, lightFrom: '07:00', darkFrom: '19:00' }
        }
      };
    }
  };

  const stop = startThemeScheduleTicker(storeInstance, mockRoot, 100);
  assert.equal(typeof stop, 'function');
  stop(); // Clean stop without error
});

test('4.6 Theme schedule: applyThemeAndAccent uses resolved schedule when enabled', async () => {
  const { applyThemeAndAccent } = await import('../extension/js/features/theme.js');

  const classes = new Set();
  const attributes = {};
  const mockRoot = {
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      contains(c) { return classes.has(c); }
    },
    setAttribute(k, v) { attributes[k] = String(v); },
    getAttribute(k) { return attributes[k]; },
    style: { setProperty() {}, removeProperty() {} }
  };

  // Schedule disabled -> falls back to settings.theme
  applyThemeAndAccent({
    theme: 'dark',
    themeSchedule: { enabled: false, lightFrom: '07:00', darkFrom: '19:00' }
  }, mockRoot);
  assert.equal(attributes['data-theme'], 'dark');
  assert.equal(mockRoot.classList.contains('dark'), true);

  applyThemeAndAccent({
    theme: 'light',
    themeSchedule: { enabled: false, lightFrom: '07:00', darkFrom: '19:00' }
  }, mockRoot);
  assert.equal(attributes['data-theme'], 'light');
  assert.equal(mockRoot.classList.contains('dark'), false);
});

test('4.6 Theme schedule: getSolarTimes calculates sunrise and sunset, and resolveScheduledTheme supports mode: "solar"', async () => {
  const { getSolarTimes, resolveScheduledTheme } = await import('../extension/js/features/schedule.js');

  assert.equal(typeof getSolarTimes, 'function');
  const solarTimes = getSolarTimes(new Date('2026-06-21T12:00:00Z'));
  assert.ok(solarTimes.sunriseMinutes >= 240 && solarTimes.sunriseMinutes <= 420);
  assert.ok(solarTimes.sunsetMinutes >= 1020 && solarTimes.sunsetMinutes <= 1260);
  assert.ok(solarTimes.sunriseStr);
  assert.ok(solarTimes.sunsetStr);

  const solarSchedule = {
    enabled: true,
    mode: 'solar'
  };

  // Middle of the day -> light
  assert.equal(resolveScheduledTheme(solarSchedule, '13:00'), 'light');
  // Middle of the night -> dark
  assert.equal(resolveScheduledTheme(solarSchedule, '01:00'), 'dark');
});
