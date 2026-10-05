// @ts-check
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  WMO_WEATHER_CODES,
  getWeatherCondition,
  parseWeatherResponse,
  WEATHER_CACHE_KEY,
  WEATHER_CACHE_TTL_MS,
  getCachedWeather,
  setCachedWeather,
  fetchWeatherData,
  renderWeatherWidget
} from '../extension/js/features/weather.js';
import { pickRandomQuote, renderDailyQuote } from '../extension/js/features/quote.js';

let origDocument;

beforeEach(() => {
  origDocument = globalThis.document;

  globalThis.document = {
    createElement: (tag) => {
      const attrs = {};
      const classListSet = new Set();
      const listeners = new Map();
      const el = {
        tagName: tag.toUpperCase(),
        attrs,
        children: [],
        style: {},
        dataset: {},
        textContent: '',
        get className() { return Array.from(classListSet).join(' '); },
        set className(v) {
          classListSet.clear();
          String(v).split(/\s+/).filter(Boolean).forEach(c => classListSet.add(c));
        },
        classList: {
          add: (...cls) => cls.forEach(c => classListSet.add(c)),
          remove: (...cls) => cls.forEach(c => classListSet.delete(c)),
          contains: (c) => classListSet.has(c)
        },
        addEventListener(evt, handler) {
          if (!listeners.has(evt)) listeners.set(evt, []);
          listeners.get(evt).push(handler);
        },
        dispatchEvent(evt) {
          const arr = listeners.get(evt.type) || [];
          arr.forEach(fn => fn(evt));
        },
        setAttribute(k, v) { attrs[k] = String(v); },
        getAttribute(k) { return attrs[k] ?? null; },
        appendChild(c) {
          if (c) {
            c.parentNode = el;
            el.children.push(c);
          }
          return c;
        },
        removeChild(c) {
          const idx = el.children.indexOf(c);
          if (idx !== -1) el.children.splice(idx, 1);
          return c;
        },
        querySelector: (sel) => {
          function search(node) {
            for (const child of node.children || []) {
              if (sel.startsWith('.') && child.classList?.contains(sel.slice(1))) return child;
              if (child.tagName?.toLowerCase() === sel.toLowerCase()) return child;
              const found = search(child);
              if (found) return found;
            }
            return null;
          }
          return search(el);
        }
      };
      return el;
    }
  };
});

afterEach(() => {
  globalThis.document = origDocument;
});

// Mock Storage
function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

test('14.1 WMO Weather Codes mapping', () => {
  assert.equal(getWeatherCondition(0).label, 'Clear sky');
  assert.equal(getWeatherCondition(0).icon, '☀️');
  assert.equal(getWeatherCondition(61).label, 'Slight rain');
  assert.equal(getWeatherCondition(95).label, 'Thunderstorm');

  // Unknown fallback
  const fallback = getWeatherCondition(999);
  assert.ok(fallback.label);
  assert.ok(fallback.icon);
});

test('14.1 parseWeatherResponse parses Open-Meteo payload correctly', () => {
  const raw = {
    latitude: 51.5,
    longitude: -0.12,
    current: {
      temperature_2m: 18.4,
      relative_humidity_2m: 65,
      apparent_temperature: 17.8,
      weather_code: 2
    }
  };

  const parsedC = parseWeatherResponse(raw, 'c');
  assert.ok(parsedC);
  assert.equal(parsedC.temp, 18);
  assert.equal(parsedC.feelsLike, 18);
  assert.equal(parsedC.humidity, 65);
  assert.equal(parsedC.code, 2);
  assert.equal(parsedC.conditionLabel, 'Partly cloudy');
  assert.equal(parsedC.icon, '⛅');
  assert.equal(parsedC.unit, '°C');

  const parsedF = parseWeatherResponse(raw, 'f');
  assert.ok(parsedF);
  assert.equal(parsedF.unit, '°F');

  // Null on malformed
  assert.equal(parseWeatherResponse(null), null);
  assert.equal(parseWeatherResponse({}), null);
});

test('14.1 Weather cache TTL and expiration', () => {
  const storage = createMockStorage();

  const dummyData = { temp: 22, unit: '°C', city: 'Tokyo' };
  setCachedWeather(dummyData, storage);

  const cached = getCachedWeather(storage);
  assert.ok(cached);
  assert.deepEqual(cached.data, dummyData);
  assert.equal(cached.isFresh, true);

  // Expired cache (> 30 min)
  const expiredTimestamp = Date.now() - (WEATHER_CACHE_TTL_MS + 5000);
  storage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data: dummyData, timestamp: expiredTimestamp }));

  const stale = getCachedWeather(storage);
  assert.ok(stale);
  assert.equal(stale.isFresh, false);
});

test('14.2 fetchWeatherData respects opt-in: no network call when disabled', async () => {
  let fetchCalled = false;
  const fetchFn = async () => {
    fetchCalled = true;
    return { ok: true, json: async () => ({}) };
  };

  const disabledSettings = { enabled: false, city: 'London', lat: 51.5, lon: -0.12, unit: 'c' };
  const res = await fetchWeatherData(disabledSettings, { fetchFn });

  assert.equal(res, null);
  assert.equal(fetchCalled, false, 'Must never query network when weather.enabled is false');
});

test('14.2 fetchWeatherData uses fresh cache and bypasses network', async () => {
  const storage = createMockStorage();
  const cachedData = { temp: 25, unit: '°C', city: 'Madrid', conditionLabel: 'Clear sky', icon: '☀️' };
  setCachedWeather(cachedData, storage);

  let fetchCalled = false;
  const fetchFn = async () => {
    fetchCalled = true;
    return { ok: true };
  };

  const settings = { enabled: true, city: 'Madrid', lat: 40.4, lon: -3.7, unit: 'c' };
  const res = await fetchWeatherData(settings, { fetchFn, storage, bypassCache: false });

  assert.ok(res);
  assert.equal(res.isCached, true);
  assert.equal(res.city, 'Madrid');
  assert.equal(fetchCalled, false, 'Must not call network when cache is fresh');

  // When bypassCache is true, it does call fetchFn
  let freshFetched = false;
  const mockFetchFresh = async () => {
    freshFetched = true;
    return {
      ok: true,
      json: async () => ({
        current: { temperature_2m: 26, relative_humidity_2m: 40, apparent_temperature: 25, weather_code: 0 }
      })
    };
  };

  const freshRes = await fetchWeatherData(settings, { fetchFn: mockFetchFresh, storage, bypassCache: true });
  assert.ok(freshRes);
  assert.equal(freshFetched, true);
  assert.equal(freshRes.temp, 26);
  assert.equal(freshRes.isCached, false);
});

test('14.2 fetchWeatherData handles geocoding when lat/lon missing', async () => {
  const storage = createMockStorage();
  const urlsCalled = [];

  const fetchFn = async (url) => {
    urlsCalled.push(url);
    if (url.includes('geocoding-api')) {
      return {
        ok: true,
        json: async () => ({
          results: [{ latitude: 48.85, longitude: 2.35, name: 'Paris' }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        current: { temperature_2m: 19, relative_humidity_2m: 55, apparent_temperature: 19, weather_code: 1 }
      })
    };
  };

  const settings = { enabled: true, city: 'Paris', lat: null, lon: null, unit: 'c' };
  const res = await fetchWeatherData(settings, { fetchFn, storage });

  assert.ok(res);
  assert.equal(res.city, 'Paris');
  assert.equal(res.lat, 48.85);
  assert.equal(res.lon, 2.35);
  assert.equal(urlsCalled.length, 2);
  assert.ok(urlsCalled[0].includes('geocoding-api'));
  assert.ok(urlsCalled[1].includes('api.open-meteo.com'));
});

test('14.2 fetchWeatherData offline fallback to cached data', async () => {
  const storage = createMockStorage();
  const cachedData = { temp: 15, unit: '°C', city: 'Berlin', conditionLabel: 'Overcast', icon: '☁️' };
  setCachedWeather(cachedData, storage);

  const failingFetch = async () => {
    throw new Error('Network offline');
  };

  const settings = { enabled: true, city: 'Berlin', lat: 52.5, lon: 13.4, unit: 'c' };
  const res = await fetchWeatherData(settings, { fetchFn: failingFetch, storage, bypassCache: true });

  assert.ok(res);
  assert.equal(res.isOffline, true);
  assert.equal(res.city, 'Berlin');
  assert.equal(res.temp, 15);
});

test('14.1 renderWeatherWidget builds DOM elements and handles refresh', () => {
  const container = document.createElement('div');

  const weatherData = {
    temp: 21,
    feelsLike: 20,
    humidity: 45,
    conditionLabel: 'Clear sky',
    icon: '☀️',
    unit: '°C',
    city: 'San Francisco',
    isOffline: false
  };

  let refreshed = false;
  renderWeatherWidget(weatherData, container, () => {
    refreshed = true;
  });

  assert.equal(container.hidden, false);
  const capsule = container.querySelector('.weather-capsule');
  assert.ok(capsule);

  const title = capsule.querySelector('.weather-condition-title');
  assert.equal(title.textContent, 'Clear sky');

  const temp = capsule.querySelector('.weather-temperature');
  assert.equal(temp.textContent, '21°C');

  const refreshBtn = capsule.querySelector('.weather-refresh-btn');
  assert.ok(refreshBtn);
  refreshBtn.dispatchEvent({ type: 'click' });
  assert.equal(refreshed, true);

  // Clearing on null
  renderWeatherWidget(null, container);
  assert.equal(container.hidden, true);
});

test('14.3 Quotes: pickRandomQuote picks alternate quote and refresh button updates display', () => {
  const quotesList = [
    { quote: 'First quote', author: 'Author A' },
    { quote: 'Second quote', author: 'Author B' },
    { quote: 'Third quote', author: 'Author C' }
  ];

  const picked = pickRandomQuote(quotesList, 'First quote');
  assert.ok(picked);
  assert.notEqual(picked.quote, 'First quote');

  const container = document.createElement('div');
  renderDailyQuote({ enabled: true }, container, quotesList);

  const refreshBtn = container.querySelector('.quote-refresh-btn');
  assert.ok(refreshBtn, 'Quote refresh button must be rendered');

  const textEl = container.querySelector('.quote-text');
  assert.ok(textEl.textContent.length > 0);

  // Trigger refresh
  refreshBtn.dispatchEvent({ type: 'click' });
  assert.ok(textEl.textContent.length > 0);
});
