// @ts-check
import { getBackgroundImage } from '../core/idb.js';
import { resolveScheduledTheme } from './schedule.js';

let activeImageUrl = null;
let lastBgKey = null;
let currentRequestId = 0;

/**
 * Resets background caching and active image state for tests.
 */
export function _resetBackgroundStateForTests() {
  if (activeImageUrl && typeof URL !== 'undefined') {
    try { URL.revokeObjectURL(activeImageUrl); } catch {}
  }
  activeImageUrl = null;
  lastBgKey = null;
  currentRequestId = 0;
}

/**
 * Calculates new dimensions preserving aspect ratio with max boundary.
 * Pure function suitable for unit tests.
 * @param {number} width
 * @param {number} height
 * @param {number} maxDimension
 * @returns {{ width: number, height: number }}
 */
export function calculateDownscaleDimensions(width, height, maxDimension = 2560) {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio)
  };
}

/**
 * Downscales an uploaded image File using an offscreen canvas and returns a compressed Blob.
 * @param {File} file
 * @param {number} [maxDimension=2560]
 * @returns {Promise<Blob>}
 */
export async function downscaleImage(file, maxDimension = 2560) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = calculateDownscaleDimensions(img.width, img.height, maxDimension);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to create canvas 2D context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP compression, falling back to JPEG
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // Fallback to JPEG
          canvas.toBlob((jpegBlob) => {
            if (jpegBlob) resolve(jpegBlob);
            else reject(new Error('Canvas image conversion failed'));
          }, 'image/jpeg', 0.85);
        }
      }, 'image/webp', 0.85);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image file'));
    };

    img.src = url;
  });
}

/**
 * Applies background settings (none, solid, gradient, image) to #bg-overlay.
 * Re-applies only when settings.background serialized key changes (or forced).
 * Guards against out-of-order async resolutions and revokes previous Blob URLs.
 *
 * @param {import('../core/schema.js').DashboardData['settings']['background']} bgConfig
 * @param {boolean} [force=false]
 */
export async function applyBackground(bgConfig, force = false) {
  const overlay = document.getElementById('bg-overlay');
  if (!overlay) return;

  const currentBgKey = JSON.stringify(bgConfig || { type: 'none' });
  if (!force && lastBgKey !== null && currentBgKey === lastBgKey) {
    return;
  }
  lastBgKey = currentBgKey;

  const requestId = ++currentRequestId;

  if (!bgConfig || bgConfig.type === 'none') {
    if (activeImageUrl) {
      URL.revokeObjectURL(activeImageUrl);
      activeImageUrl = null;
    }
    overlay.style.backgroundImage = 'none';
    overlay.style.backgroundColor = 'transparent';
    overlay.style.opacity = '0';
    return;
  }

  const dim = typeof bgConfig.dim === 'number' ? bgConfig.dim : 0.35;

  // Security: never write arbitrary url() to style
  const rawVal = typeof bgConfig.value === 'string' ? bgConfig.value : '';
  const containsUrl = rawVal.toLowerCase().includes('url(');

  if (bgConfig.type === 'solid') {
    if (activeImageUrl) {
      URL.revokeObjectURL(activeImageUrl);
      activeImageUrl = null;
    }
    overlay.style.backgroundImage = 'none';
    overlay.style.backgroundColor = (!containsUrl && rawVal) ? rawVal : '#1e293b';
    overlay.style.opacity = String(1 - dim * 0.5);
  } else if (bgConfig.type === 'gradient') {
    if (activeImageUrl) {
      URL.revokeObjectURL(activeImageUrl);
      activeImageUrl = null;
    }
    overlay.style.backgroundColor = 'transparent';
    overlay.style.backgroundImage = (!containsUrl && rawVal) ? rawVal : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
    overlay.style.opacity = String(1 - dim * 0.4);
  } else if (bgConfig.type === 'image') {
    const blob = await getBackgroundImage();

    // Guard against out-of-order async results
    if (requestId !== currentRequestId) {
      return;
    }

    if (blob) {
      if (activeImageUrl) {
        URL.revokeObjectURL(activeImageUrl);
      }
      activeImageUrl = URL.createObjectURL(blob);
      overlay.style.backgroundImage = `url("${activeImageUrl}")`;
      overlay.style.opacity = String(1 - dim);
      overlay.style.backgroundColor = '#000000';
    } else {
      if (activeImageUrl) {
        URL.revokeObjectURL(activeImageUrl);
        activeImageUrl = null;
      }
      overlay.style.backgroundImage = 'none';
      overlay.style.backgroundColor = 'transparent';
      overlay.style.opacity = '0';
    }
  }
}

/**
 * Normalizes hex string (e.g. #abc -> #aabbcc) and returns RGB channels.
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number } | null}
 */
export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * Calculates relative luminance according to WCAG 2.1 specs.
 * @param {string} hex
 * @returns {number}
 */
export function calculateRelativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channels = [rgb.r, rgb.g, rgb.b].map(c => {
    const sRGB = c / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * Calculates contrast ratio between two hex colors according to WCAG.
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number}
 */
export function calculateContrastRatio(hex1, hex2) {
  const l1 = calculateRelativeLuminance(hex1);
  const l2 = calculateRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Suggests an accessible shade of an accent color against a target background.
 * Adjusts lightness until contrast ratio >= minRatio (default 3.0).
 * @param {string} accentHex
 * @param {string} bgHex
 * @param {number} [minRatio=3.0]
 * @returns {string} Hex color string
 */
export function suggestAccessibleShade(accentHex, bgHex, minRatio = 3.0) {
  const rgb = hexToRgb(accentHex);
  if (!rgb) return '#3b82f6';
  const bgLum = calculateRelativeLuminance(bgHex);
  const isBgDark = bgLum < 0.5;

  let r = rgb.r;
  let g = rgb.g;
  let b = rgb.b;

  for (let i = 0; i < 40; i++) {
    const currentHex = '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
    if (calculateContrastRatio(currentHex, bgHex) >= minRatio) {
      return currentHex;
    }
    if (isBgDark) {
      r = Math.min(255, r + 8);
      g = Math.min(255, g + 8);
      b = Math.min(255, b + 8);
    } else {
      r = Math.max(0, r - 8);
      g = Math.max(0, g - 8);
      b = Math.max(0, b - 8);
    }
  }

  return isBgDark ? '#60a5fa' : '#1d4ed8';
}

/**
 * Validates a custom accent color against WCAG AA criteria.
 * @param {string} accentHex
 * @param {boolean} isDark
 * @param {string} [customBgHex]
 * @returns {{ valid: boolean, ratio: number, textColor: string, suggestedHex?: string, reason?: string }}
 */
export function validateAccentContrast(accentHex, isDark, customBgHex) {
  const bgHex = customBgHex || (isDark ? '#1b1e22' : '#ffffff');
  const rgb = hexToRgb(accentHex);
  if (!rgb) {
    return {
      valid: false,
      ratio: 1,
      textColor: '#ffffff',
      suggestedHex: isDark ? '#38bdf8' : '#2563eb',
      reason: 'Invalid hex color'
    };
  }

  const ratio = calculateContrastRatio(accentHex, bgHex);
  const whiteRatio = calculateContrastRatio(accentHex, '#ffffff');
  const blackRatio = calculateContrastRatio(accentHex, '#111111');
  const textColor = whiteRatio >= blackRatio ? '#ffffff' : '#111111';

  // WCAG AA requirement for interactive UI controls is >= 3.0:1
  const passesComponentContrast = ratio >= 3.0;

  if (passesComponentContrast) {
    return {
      valid: true,
      ratio: Math.round(ratio * 100) / 100,
      textColor
    };
  }

  const suggestedHex = suggestAccessibleShade(accentHex, bgHex, 3.0);
  return {
    valid: false,
    ratio: Math.round(ratio * 100) / 100,
    textColor,
    suggestedHex,
    reason: `Fails WCAG AA minimum contrast ratio (current ${ratio.toFixed(2)}:1, requires 3.0:1)`
  };
}

/**
 * Applies theme, palette, and accent to root documentElement.
 * @param {import('../core/schema.js').DashboardData['settings']} settings
 * @param {HTMLElement | { style: { setProperty: Function, removeProperty?: Function }, setAttribute: Function, classList: { add: Function, remove: Function } }} [rootElement]
 */
export function applyThemeAndAccent(settings, rootElement) {
  const root = rootElement || (typeof document !== 'undefined' ? document.documentElement : null);
  if (!root) return;

  let theme = settings?.theme || 'system';
  if (settings?.themeSchedule?.enabled) {
    theme = resolveScheduledTheme(settings.themeSchedule, undefined, theme);
  }
  const palette = settings?.palette || 'default';
  const accent = settings?.accent || 'slate';
  const accentCustom = settings?.accentCustom;

  // Determine dark / light
  let isDark = false;
  if (theme === 'dark') {
    isDark = true;
  } else if (theme === 'light') {
    isDark = false;
  } else if (typeof window !== 'undefined' && window.matchMedia) {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  if (isDark) {
    root.classList?.add('dark');
    root.setAttribute?.('data-theme', 'dark');
  } else {
    root.classList?.remove('dark');
    root.setAttribute?.('data-theme', 'light');
  }

  root.setAttribute?.('data-palette', palette);
  root.setAttribute?.('data-accent', accent);

  if (accent === 'custom' && accentCustom) {
    const val = validateAccentContrast(accentCustom, isDark);
    const rgb = hexToRgb(accentCustom);
    if (root.style?.setProperty) {
      root.style.setProperty('--accent-base', accentCustom);
      root.style.setProperty('--accent-text', val.textColor);
      if (rgb) {
        root.style.setProperty('--accent-tint', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
        root.style.setProperty('--accent-focus-ring', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`);
      }
    }
  } else {
    if (root.style?.removeProperty) {
      root.style.removeProperty('--accent-base');
      root.style.removeProperty('--accent-text');
      root.style.removeProperty('--accent-tint');
      root.style.removeProperty('--accent-focus-ring');
    }
  }
}
