// @ts-check
import { getWeatherIconSvg, ICON_REFRESH } from '../ui/icons.js';

/**
 * WMO Weather interpretation codes (WW)
 * https://open-meteo.com/en/docs
 */
export const WMO_WEATHER_CODES = {
  0: { label: 'Clear sky', icon: 'sun' },
  1: { label: 'Mainly clear', icon: 'cloud-sun' },
  2: { label: 'Partly cloudy', icon: 'cloud-sun' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Fog', icon: 'cloud-fog' },
  48: { label: 'Depositing rime fog', icon: 'cloud-fog' },
  51: { label: 'Light drizzle', icon: 'cloud-drizzle' },
  53: { label: 'Moderate drizzle', icon: 'cloud-drizzle' },
  55: { label: 'Dense drizzle', icon: 'cloud-drizzle' },
  56: { label: 'Light freezing drizzle', icon: 'cloud-rain' },
  57: { label: 'Dense freezing drizzle', icon: 'cloud-rain' },
  61: { label: 'Slight rain', icon: 'cloud-rain' },
  63: { label: 'Moderate rain', icon: 'cloud-rain' },
  65: { label: 'Heavy rain', icon: 'cloud-rain' },
  66: { label: 'Light freezing rain', icon: 'cloud-rain' },
  67: { label: 'Heavy freezing rain', icon: 'cloud-rain' },
  71: { label: 'Slight snow fall', icon: 'cloud-snow' },
  73: { label: 'Moderate snow fall', icon: 'cloud-snow' },
  75: { label: 'Heavy snow fall', icon: 'cloud-snow' },
  77: { label: 'Snow grains', icon: 'cloud-snow' },
  80: { label: 'Slight rain showers', icon: 'cloud-drizzle' },
  81: { label: 'Moderate rain showers', icon: 'cloud-drizzle' },
  82: { label: 'Violent rain showers', icon: 'cloud-rain' },
  85: { label: 'Slight snow showers', icon: 'cloud-snow' },
  86: { label: 'Heavy snow showers', icon: 'cloud-snow' },
  95: { label: 'Thunderstorm', icon: 'cloud-lightning' },
  96: { label: 'Thunderstorm with hail', icon: 'cloud-lightning' },
  99: { label: 'Severe thunderstorm with hail', icon: 'cloud-lightning' }
};

/**
 * Returns condition descriptor for a WMO weather code.
 * @param {number} code
 * @returns {{ label: string, icon: string }}
 */
export function getWeatherCondition(code) {
  if (code in WMO_WEATHER_CODES) {
    return WMO_WEATHER_CODES[code];
  }
  return { label: 'Fair', icon: 'cloud-sun' };
}

/**
 * Parses raw Open-Meteo response into a structured dashboard weather object.
 * @param {any} data
 * @param {'c' | 'f'} [unit='c']
 * @returns {{ temp: number, feelsLike: number, humidity: number, code: number, conditionLabel: string, icon: string, unit: string } | null}
 */
export function parseWeatherResponse(data, unit = 'c') {
  if (!data || !data.current) return null;
  const current = data.current;
  const code = typeof current.weather_code === 'number' ? current.weather_code : 0;
  const condition = getWeatherCondition(code);

  const temp = Math.round(current.temperature_2m ?? 0);
  const feelsLike = Math.round(current.apparent_temperature ?? temp);
  const humidity = Math.round(Math.max(0, Math.min(100, current.relative_humidity_2m ?? 50)));

  return {
    temp,
    feelsLike,
    humidity,
    code,
    conditionLabel: condition.label,
    icon: condition.icon,
    unit: unit === 'f' ? '°F' : '°C'
  };
}

export const WEATHER_CACHE_KEY = 'brave_dashboard_weather_cache';
export const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Retrieves cached weather entry from local storage.
 * @param {Storage | null} [storage]
 * @returns {{ data: any, timestamp: number, isFresh: boolean } | null}
 */
export function getCachedWeather(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || !entry.data || typeof entry.timestamp !== 'number') return null;
    const isFresh = (Date.now() - entry.timestamp) < WEATHER_CACHE_TTL_MS;
    return { data: entry.data, timestamp: entry.timestamp, isFresh };
  } catch {
    return null;
  }
}

/**
 * Stores weather entry into local storage cache.
 * @param {any} data
 * @param {Storage | null} [storage]
 */
export function setCachedWeather(data, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !data) return;
  try {
    const entry = { data, timestamp: Date.now() };
    storage.setItem(WEATHER_CACHE_KEY, JSON.stringify(entry));
  } catch {}
}

/**
 * Fetches weather data from Open-Meteo with caching, geocoding, and offline fallback.
 * Strictly respects weatherSettings.enabled: if disabled, performs ZERO network requests.
 *
 * @param {import('../core/schema.js').DashboardData['settings']['weather']} weatherSettings
 * @param {object} [options={}]
 * @param {boolean} [options.bypassCache=false]
 * @param {(url: string) => Promise<any>} [options.fetchFn]
 * @param {Storage} [options.storage]
 * @returns {Promise<any | null>}
 */
export async function fetchWeatherData(weatherSettings, options = {}) {
  if (!weatherSettings || !weatherSettings.enabled) {
    return null;
  }

  const {
    bypassCache = false,
    fetchFn = (typeof fetch !== 'undefined' ? fetch : null),
    storage = (typeof localStorage !== 'undefined' ? localStorage : null)
  } = options;

  const cached = getCachedWeather(storage);

  if (!bypassCache && cached && cached.isFresh) {
    return { ...cached.data, isCached: true, isOffline: false };
  }

  if (typeof fetchFn !== 'function') {
    if (cached) return { ...cached.data, isCached: true, isOffline: true };
    return null;
  }

  let lat = weatherSettings.lat;
  let lon = weatherSettings.lon;
  let cityName = weatherSettings.city || '';

  // Geocode city if lat/lon missing
  if ((lat == null || lon == null) && cityName.trim()) {
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName.trim())}&count=1&language=en&format=json`;
      const geoRes = await fetchFn(geoUrl);
      if (geoRes?.ok) {
        const geoData = await geoRes.json();
        if (geoData?.results?.[0]) {
          lat = geoData.results[0].latitude;
          lon = geoData.results[0].longitude;
          cityName = geoData.results[0].name || cityName;
        }
      }
    } catch {}
  }

  if (lat == null || lon == null) {
    // If no coordinates configured, return cached if present
    if (cached) return { ...cached.data, isCached: true, isOffline: true };
    return null;
  }

  const unitParam = weatherSettings.unit === 'f' ? 'fahrenheit' : 'celsius';
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&temperature_unit=${unitParam}`;

  try {
    const res = await fetchFn(forecastUrl);
    if (!res?.ok) throw new Error(`HTTP ${res?.status || 0}`);
    const raw = await res.json();
    const parsed = parseWeatherResponse(raw, weatherSettings.unit);
    if (!parsed) throw new Error('Malformed weather response');

    const result = {
      ...parsed,
      city: cityName || 'Local Weather',
      lat,
      lon,
      isCached: false,
      isOffline: false
    };

    setCachedWeather(result, storage);
    return result;
  } catch {
    // Offline or network error: return cached entry if available
    if (cached) {
      return { ...cached.data, isCached: true, isOffline: true };
    }
    return null;
  }
}

/**
 * Renders the Weather Capsule widget into container element.
 *
 * @param {any} weatherData
 * @param {HTMLElement | null} containerEl
 * @param {() => void} [onRefresh]
 */
export function renderWeatherWidget(weatherData, containerEl, onRefresh) {
  if (!containerEl) return;

  if (!weatherData) {
    containerEl.hidden = true;
    containerEl.innerHTML = '';
    return;
  }

  const existingFrame = containerEl.querySelector ? containerEl.querySelector('.widget-drag-frame') : null;
  containerEl.hidden = false;
  containerEl.innerHTML = '';

  const capsule = document.createElement('div');
  capsule.className = 'weather-capsule';

  // Left column: condition, humidity meter, location
  const colLeft = document.createElement('div');
  colLeft.className = 'weather-capsule-col-left';

  const conditionTitle = document.createElement('span');
  conditionTitle.className = 'weather-condition-title';
  conditionTitle.textContent = weatherData.conditionLabel;

  const humidityRow = document.createElement('div');
  humidityRow.className = 'weather-humidity-row';
  humidityRow.title = `Humidity: ${weatherData.humidity}%`;

  const humidityBarTrack = document.createElement('div');
  humidityBarTrack.className = 'weather-humidity-track';
  const humidityBarFill = document.createElement('div');
  humidityBarFill.className = 'weather-humidity-fill';
  humidityBarFill.style.width = `${weatherData.humidity}%`;
  humidityBarTrack.appendChild(humidityBarFill);

  const humidityText = document.createElement('span');
  humidityText.className = 'weather-humidity-text';
  humidityText.textContent = `${weatherData.humidity}%`;

  humidityRow.appendChild(humidityBarTrack);
  humidityRow.appendChild(humidityText);

  const metaRow = document.createElement('div');
  metaRow.className = 'weather-meta-row';
  const feelsLikeText = `Feels ${weatherData.feelsLike}${weatherData.unit} • ${weatherData.city}`;
  metaRow.textContent = feelsLikeText;

  if (weatherData.isOffline) {
    const offlineBadge = document.createElement('span');
    offlineBadge.className = 'weather-offline-badge';
    offlineBadge.textContent = ' (offline)';
    metaRow.appendChild(offlineBadge);
  }

  colLeft.appendChild(conditionTitle);
  colLeft.appendChild(humidityRow);
  colLeft.appendChild(metaRow);

  // Right column: weather icon, temperature readout, refresh button
  const colRight = document.createElement('div');
  colRight.className = 'weather-capsule-col-right';

  const iconEl = document.createElement('span');
  iconEl.className = 'weather-condition-icon';
  iconEl.innerHTML = getWeatherIconSvg(weatherData.code ?? weatherData.icon, 28);
  iconEl.setAttribute('aria-hidden', 'true');

  const tempEl = document.createElement('span');
  tempEl.className = 'weather-temperature';
  tempEl.textContent = `${weatherData.temp}${weatherData.unit}`;

  colRight.appendChild(iconEl);
  colRight.appendChild(tempEl);

  if (typeof onRefresh === 'function') {
    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'weather-refresh-btn';
    refreshBtn.title = 'Refresh weather';
    refreshBtn.setAttribute('aria-label', 'Refresh weather');
    refreshBtn.innerHTML = ICON_REFRESH;
    refreshBtn.addEventListener('click', (e) => {
      if (typeof e?.stopPropagation === 'function') {
        e.stopPropagation();
      }
      onRefresh();
    });
    colRight.appendChild(refreshBtn);
  }

  capsule.appendChild(colLeft);
  capsule.appendChild(colRight);
  containerEl.appendChild(capsule);
  if (existingFrame) {
    containerEl.appendChild(existingFrame);
  }
}
