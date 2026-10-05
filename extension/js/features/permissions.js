// @ts-check

/**
 * Checks whether the extension currently has the requested permissions.
 * Safe to call in non-extension environments (Node.js, dev server).
 *
 * @param {string[]} permissions Array of permission names, e.g. ['tabs', 'tabGroups']
 * @returns {Promise<boolean>}
 */
export async function hasPermissions(permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return true;
  }

  if (typeof chrome === 'undefined' || !chrome.permissions || typeof chrome.permissions.contains !== 'function') {
    return false;
  }

  return new Promise((resolve) => {
    try {
      chrome.permissions.contains({ permissions }, (result) => {
        if (chrome.runtime?.lastError) {
          resolve(false);
        } else {
          resolve(Boolean(result));
        }
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Requests optional permissions from the user.
 * Must be invoked inside a user interaction callback (click, keydown).
 *
 * @param {string[]} permissions Array of permission names, e.g. ['tabs', 'tabGroups']
 * @returns {Promise<boolean>}
 */
export async function requestPermissions(permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return true;
  }

  if (typeof chrome === 'undefined' || !chrome.permissions || typeof chrome.permissions.request !== 'function') {
    return false;
  }

  return new Promise((resolve) => {
    try {
      chrome.permissions.request({ permissions }, (granted) => {
        if (chrome.runtime?.lastError) {
          resolve(false);
        } else {
          resolve(Boolean(granted));
        }
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Relinquishes permissions that are no longer needed.
 *
 * @param {string[]} permissions Array of permission names to remove
 * @returns {Promise<boolean>}
 */
export async function removePermissions(permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return true;
  }

  if (typeof chrome === 'undefined' || !chrome.permissions || typeof chrome.permissions.remove !== 'function') {
    return false;
  }

  return new Promise((resolve) => {
    try {
      chrome.permissions.remove({ permissions }, (removed) => {
        if (chrome.runtime?.lastError) {
          resolve(false);
        } else {
          resolve(Boolean(removed));
        }
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Ensures specified permissions are held. If already granted, returns true immediately
 * without prompting. If not yet granted, prompts the user via requestPermissions().
 *
 * @param {string[]} permissions Array of permission names
 * @returns {Promise<boolean>} True if permissions are held, false if denied or unavailable
 */
export async function ensurePermissions(permissions) {
  const alreadyGranted = await hasPermissions(permissions);
  if (alreadyGranted) {
    return true;
  }
  return requestPermissions(permissions);
}
