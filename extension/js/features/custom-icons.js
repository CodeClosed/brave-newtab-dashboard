// @ts-check
import { el } from '../utils/dom.js';
import { createFaviconElement } from '../ui/favicons.js';

const MAX_IMAGE_BYTES = 12 * 1024; // 12 KB limit

/**
 * Validates a custom icon object.
 * @param {any} icon
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCustomIcon(icon) {
  if (icon === null || icon === undefined) {
    return { valid: true };
  }

  if (typeof icon !== 'object') {
    return { valid: false, error: 'Icon must be an object or null' };
  }

  if (icon.type === 'emoji') {
    if (typeof icon.value !== 'string' || !icon.value.trim()) {
      return { valid: false, error: 'Emoji icon must have a non-empty string value' };
    }
    if (icon.value.length > 8) {
      return { valid: false, error: 'Emoji icon exceeds 8 character maximum' };
    }
    return { valid: true };
  }

  if (icon.type === 'image') {
    if (typeof icon.value !== 'string' || !icon.value.startsWith('data:image/')) {
      return { valid: false, error: 'Custom image icon must be a data:image URL' };
    }
    // Base64 data URLs: 12 KB binary data corresponds to ~16,384 base64 characters
    if (icon.value.length > 16384) {
      return { valid: false, error: 'Custom image icon exceeds 12 KB limit' };
    }
    return { valid: true };
  }

  return { valid: false, error: `Unknown icon type "${icon.type}"` };
}

/**
 * Downscales an image File to max 64px and compresses to under 12 KB data URL.
 * @param {File} file
 * @param {number} [maxSize=64]
 * @param {number} [maxBytes=12288]
 * @returns {Promise<string>}
 */
export async function downscaleIconImage(file, maxSize = 64, maxBytes = MAX_IMAGE_BYTES) {
  if (!file) throw new Error('No file provided');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to parse image data'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas 2D context unavailable'));
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fall back to JPEG or PNG
        let dataUrl = canvas.toDataURL('image/webp', 0.8);
        if (dataUrl.length > 16384) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        }

        if (dataUrl.length > 16384) {
          return reject(new Error('Compressed icon exceeds 12 KB limit. Please choose a simpler image.'));
        }

        resolve(dataUrl);
      };

      img.src = /** @type {string} */ (reader.result);
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Renders the icon element for a bookmark, supporting emoji, custom image, or favicon fallback.
 * @param {import('../core/schema.js').Bookmark} bookmark
 * @returns {HTMLElement}
 */
export function renderBookmarkIcon(bookmark) {
  if (bookmark?.icon) {
    if (bookmark.icon.type === 'emoji') {
      const container = el('div', { className: 'favicon-container custom-emoji-container' }, [
        el('span', { className: 'bookmark-custom-emoji', 'aria-hidden': 'true', text: bookmark.icon.value })
      ]);
      return container;
    }

    if (bookmark.icon.type === 'image') {
      const container = el('div', { className: 'favicon-container custom-image-container' }, [
        el('img', {
          className: 'favicon-img custom-icon-img',
          src: bookmark.icon.value,
          alt: '',
          loading: 'lazy'
        })
      ]);
      return container;
    }
  }

  return createFaviconElement(bookmark.url, bookmark.name);
}
