// @ts-check

/**
 * Retrieves localized string by key using chrome.i18n.getMessage.
 * Returns fallback text if chrome.i18n is unavailable or key not found.
 *
 * @param {string} key
 * @param {string} [fallback]
 * @param {string | string[]} [substitutions]
 * @returns {string}
 */
export function t(key, fallback = '', substitutions) {
  if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
    try {
      const msg = chrome.i18n.getMessage(key, substitutions);
      if (msg) return msg;
    } catch {}
  }

  let result = fallback || key;
  if (substitutions) {
    const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
    subs.forEach((sub, i) => {
      result = result.replace(new RegExp(`\\$${i + 1}`, 'g'), sub);
    });
  }
  return result;
}
