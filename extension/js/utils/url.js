// @ts-check

/**
 * Validates and normalizes user-provided URLs.
 * Strictly allows only http: and https: schemes.
 * Prepends https:// to bare domains.
 * Rejects javascript:, data:, file:, and malformed strings.
 *
 * @param {string} input
 * @returns {{ valid: boolean, url: string, domain: string, error?: string }}
 */
export function normalizeUrl(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, url: '', domain: '', error: 'URL is required' };
  }

  let trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, url: '', domain: '', error: 'URL cannot be empty' };
  }

  // Prepend https:// if protocol is omitted
  if (!/^https?:\/\//i.test(trimmed)) {
    // If it looks like another protocol, don't auto-prepend
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      return { valid: false, url: '', domain: '', error: 'Only http:// and https:// URLs are permitted' };
    }
    trimmed = 'https://' + trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, url: '', domain: '', error: 'Only http:// and https:// URLs are permitted' };
    }

    if (!parsed.hostname || parsed.hostname.length < 1) {
      return { valid: false, url: '', domain: '', error: 'URL must include a valid hostname' };
    }

    // Strip 'www.' for clean domain display
    const cleanDomain = parsed.hostname.replace(/^www\./i, '');

    return {
      valid: true,
      url: parsed.href,
      domain: cleanDomain
    };
  } catch (err) {
    return { valid: false, url: '', domain: '', error: 'Invalid URL format' };
  }
}

/**
 * Extracts a clean hostname for display from a valid URL string.
 *
 * @param {string} urlString
 * @returns {string}
 */
export function getDomainFromUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}
