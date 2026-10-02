// @ts-check
import { getBackgroundImage } from '../core/idb.js';

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
