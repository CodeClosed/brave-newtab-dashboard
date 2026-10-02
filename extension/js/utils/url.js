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

  // Check if input already has an explicit http:// or https:// scheme
  if (!/^https?:\/\//i.test(trimmed)) {
    // Check if input has a host:port pattern (hostname/IP chars, colon, digits, optional path/query/hash)
    const hostPortMatch = trimmed.match(/^([a-zA-Z0-9.-]+|\[[a-fA-F0-9:]+\]):(\d+)(?:[/?#].*)?$/);

    if (hostPortMatch) {
      // It's a host:port! Determine protocol based on the host
      const host = hostPortMatch[1].replace(/^\[|\]$/g, '').toLowerCase();
      const isLocalOrDev =
        host === 'localhost' ||
        host.endsWith('.localhost') ||
        host.endsWith('.local') ||
        /^(\d{1,3}\.){3}\d{1,3}$/.test(host) ||
        host.includes(':');

      const protocol = isLocalOrDev ? 'http://' : 'https://';
      trimmed = protocol + trimmed;
    } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      // It looks like another explicit scheme (e.g. javascript:, data:, file:, mailto:, ftp:)
      return { valid: false, url: '', domain: '', error: 'Only http:// and https:// URLs are permitted' };
    } else {
      // Bare host (with optional path/query/hash, but no port)
      const authority = trimmed.split(/[/?#]/)[0];
      const host = authority.toLowerCase();

      // Single-label hosts (e.g. "foo") are rejected unless "localhost"
      const isSingleLabel = !host.includes('.') && !host.startsWith('[');
      if (isSingleLabel && host !== 'localhost') {
        return { valid: false, url: '', domain: '', error: 'Single-label hosts are not permitted' };
      }

      const isLocalOrDev =
        host === 'localhost' ||
        host.endsWith('.localhost') ||
        host.endsWith('.local') ||
        /^(\d{1,3}\.){3}\d{1,3}$/.test(host) ||
        host.includes(':');

      const protocol = isLocalOrDev ? 'http://' : 'https://';
      trimmed = protocol + trimmed;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, url: '', domain: '', error: 'Only http:// and https:// URLs are permitted' };
    }

    if (!parsed.hostname || parsed.hostname.length < 1) {
      return { valid: false, url: '', domain: '', error: 'URL must include a valid hostname' };
    }

    // Single-label host check on parsed URL (for inputs that started with http(s)://)
    const parsedHost = parsed.hostname.toLowerCase();
    const isSingleLabel = !parsedHost.includes('.') && !parsedHost.startsWith('[');
    if (isSingleLabel && parsedHost !== 'localhost' && !parsed.port) {
      return { valid: false, url: '', domain: '', error: 'Single-label hosts are not permitted' };
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
