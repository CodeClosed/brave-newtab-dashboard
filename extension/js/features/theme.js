// @ts-check
import { getBackgroundImage, getWallpaperRecord } from '../core/idb.js';
import { resolveScheduledTheme } from './schedule.js';
import { calculateAutoReadabilityDim, resolveActiveWallpaperId } from './wallpaper.js';

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

  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const isDark = root ? (root.getAttribute('data-theme') === 'dark' || (root.classList && root.classList.contains('dark'))) : false;
  const targetWallpaperId = resolveActiveWallpaperId(bgConfig, isDark);

  const currentBgKey = JSON.stringify({
    type: bgConfig?.type,
    value: bgConfig?.value,
    dim: bgConfig?.dim,
    activeId: targetWallpaperId,
    blur: bgConfig?.blur,
    fit: bgConfig?.fit,
    focal: bgConfig?.focal,
    isDark
  });
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
    overlay.style.filter = 'none';
    return;
  }

  let dim = typeof bgConfig.dim === 'number' ? bgConfig.dim : 0.35;
  if (bgConfig?.autoReadability && bgConfig.type === 'image') {
    let lum = null;
    if (targetWallpaperId && Array.isArray(bgConfig.wallpapers)) {
      const activeWp = bgConfig.wallpapers.find(w => w.id === targetWallpaperId);
      if (activeWp && activeWp.luminanceData) {
        lum = activeWp.luminanceData;
      }
    }
    dim = calculateAutoReadabilityDim(lum, isDark);
  }

  // Security: never write arbitrary url() to style
  if (bgConfig.type === 'solid') {
    if (activeImageUrl) {
      URL.revokeObjectURL(activeImageUrl);
      activeImageUrl = null;
    }
    const safeColor = validateSolidColor(bgConfig.value) || '#1e293b';
    overlay.style.backgroundImage = 'none';
    overlay.style.backgroundColor = safeColor;
    overlay.style.opacity = String(1 - dim * 0.5);
    overlay.style.filter = 'none';
  } else if (bgConfig.type === 'gradient') {
    if (activeImageUrl) {
      URL.revokeObjectURL(activeImageUrl);
      activeImageUrl = null;
    }
    let safeGrad = null;
    if (typeof bgConfig.value === 'object' && bgConfig.value !== null) {
      safeGrad = formatGradientCss(bgConfig.value);
    } else if (typeof bgConfig.value === 'string' && !bgConfig.value.toLowerCase().includes('url(')) {
      safeGrad = bgConfig.value;
    }
    overlay.style.backgroundColor = 'transparent';
    overlay.style.backgroundImage = safeGrad || 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
    overlay.style.opacity = String(1 - dim * 0.4);
    overlay.style.filter = 'none';
  } else if (bgConfig.type === 'image') {
    let blob = null;
    if (targetWallpaperId) {
      const rec = await getWallpaperRecord(targetWallpaperId);
      if (rec && rec.blob) {
        blob = rec.blob;
      }
    }
    if (!blob) {
      blob = await getBackgroundImage();
    }

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

      const activeWp = Array.isArray(bgConfig.wallpapers) ? bgConfig.wallpapers.find(w => w.id === targetWallpaperId) : null;
      const focal = (activeWp && activeWp.focal) || bgConfig.focal;
      if (focal && typeof focal.x === 'number' && typeof focal.y === 'number') {
        overlay.style.backgroundPosition = `${Math.round(focal.x * 100)}% ${Math.round(focal.y * 100)}%`;
      } else {
        overlay.style.backgroundPosition = 'center';
      }

      if (bgConfig.fit === 'contain') {
        overlay.style.backgroundSize = 'contain';
      } else if (bgConfig.fit === 'center') {
        overlay.style.backgroundSize = 'auto';
      } else {
        overlay.style.backgroundSize = 'cover';
      }

      const blurPx = typeof bgConfig.blur === 'number' ? Math.max(0, Math.min(20, bgConfig.blur)) : 0;
      overlay.style.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
    } else {
      if (activeImageUrl) {
        URL.revokeObjectURL(activeImageUrl);
        activeImageUrl = null;
      }
      overlay.style.backgroundImage = 'none';
      overlay.style.backgroundColor = 'transparent';
      overlay.style.opacity = '0';
      overlay.style.filter = 'none';
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
    const surfaceRatio = calculateContrastRatio(currentHex, bgHex);
    const textRatio = Math.max(
      calculateContrastRatio(currentHex, '#ffffff'),
      calculateContrastRatio(currentHex, '#111111')
    );
    if (surfaceRatio >= minRatio && textRatio >= 4.5) {
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
 * Checks both UI surface contrast (>= 3.0:1) and text contrast on accent (>= 4.5:1).
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
  const textContrast = Math.max(whiteRatio, blackRatio);
  const textColor = whiteRatio >= blackRatio ? '#ffffff' : '#111111';

  // WCAG AA requirement for interactive UI controls:
  // 1. Surface contrast >= 3.0:1
  // 2. Text on accent button/badge >= 4.5:1
  const passesSurface = ratio >= 3.0;
  const passesText = textContrast >= 4.5;

  if (passesSurface && passesText) {
    return {
      valid: true,
      ratio: Math.round(ratio * 100) / 100,
      textColor
    };
  }

  const suggestedHex = suggestAccessibleShade(accentHex, bgHex, 3.0);
  let reason = '';
  if (!passesSurface) {
    reason = `Fails WCAG AA minimum surface contrast ratio (current ${ratio.toFixed(2)}:1, requires 3.0:1)`;
  } else {
    reason = `Fails WCAG AA text contrast ratio on accent (current ${textContrast.toFixed(2)}:1, requires 4.5:1)`;
  }

  return {
    valid: false,
    ratio: Math.round(ratio * 100) / 100,
    textColor,
    suggestedHex,
    reason
  };
}

/**
 * Applies theme, palette, and accent to root documentElement.
 * Reverts/rejects custom accent if it fails WCAG AA against background.
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
    const bgHex = isDark
      ? (palette === 'amoled' || palette === 'contrast' ? '#0a0a0a' : '#1b1e22')
      : (palette === 'paper' ? '#faf8f5' : '#ffffff');
    const val = validateAccentContrast(accentCustom, isDark, bgHex);

    // Revert/reject if custom accent fails WCAG AA against background
    if (!val.valid) {
      root.setAttribute?.('data-accent', 'slate');
      if (root.style?.removeProperty) {
        root.style.removeProperty('--accent-base');
        root.style.removeProperty('--accent-text');
        root.style.removeProperty('--accent-tint');
        root.style.removeProperty('--accent-focus-ring');
      }
      return;
    }

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

/**
 * Validates a solid color hex string (#rgb or #rrggbb).
 * Strictly rejects any value containing url( or invalid hex characters.
 * @param {any} val
 * @returns {string | null}
 */
export function validateSolidColor(val) {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (trimmed.toLowerCase().includes('url(')) return null;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Validates and normalizes a gradient configuration { from, to, angle }.
 * @param {any} val
 * @returns {{ from: string, to: string, angle: number } | null}
 */
export function validateGradientConfig(val) {
  if (!val || typeof val !== 'object') return null;
  const from = validateSolidColor(val.from);
  const to = validateSolidColor(val.to);
  if (!from || !to) return null;

  let angle = typeof val.angle === 'number' && !isNaN(val.angle) ? val.angle : 135;
  // Normalize angle to [0, 360)
  angle = ((angle % 360) + 360) % 360;

  return { from, to, angle };
}

/**
 * Formats a gradient configuration into a safe CSS linear-gradient string.
 * @param {{ from: string, to: string, angle: number }} config
 * @returns {string}
 */
export function formatGradientCss(config) {
  const safe = validateGradientConfig(config);
  if (!safe) return 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
  return `linear-gradient(${safe.angle}deg, ${safe.from} 0%, ${safe.to} 100%)`;
}

