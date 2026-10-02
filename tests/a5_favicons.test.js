import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFaviconElement,
  detectDefaultFaviconHash,
  hashBytes,
  _resetFaviconCacheForTests
} from '../extension/js/ui/favicons.js';

const GENERIC_BYTES = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const REAL_FAVICON_BYTES = new Uint8Array([10, 20, 30, 40, 50]);

beforeEach(() => {
  if (_resetFaviconCacheForTests) {
    _resetFaviconCacheForTests();
  }

  globalThis.document = {
    createElement: (tag) => {
      const attrs = {};
      const listeners = {};
      const children = [];
      const node = {
        tagName: tag.toUpperCase(),
        style: {},
        classList: {
          add: () => {},
          remove: () => {}
        },
        setAttribute: (k, v) => { attrs[k] = v; },
        getAttribute: (k) => attrs[k],
        addEventListener: (k, fn) => { listeners[k] = fn; },
        appendChild: (child) => {
          child.parentNode = node;
          children.push(child);
        },
        replaceChild: (newChild, oldChild) => {
          const idx = children.indexOf(oldChild);
          if (idx !== -1) {
            children[idx] = newChild;
            newChild.parentNode = node;
            oldChild.parentNode = null;
          }
        },
        removeChild: (child) => {
          const idx = children.indexOf(child);
          if (idx !== -1) {
            children.splice(idx, 1);
            child.parentNode = null;
          }
        },
        get firstChild() { return children[0] || null; },
        get children() { return children; }
      };
      return node;
    }
  };

  globalThis.chrome = {
    runtime: {
      getURL: (path) => `chrome-extension://mock-ext${path}`
    }
  };

  // Mock global fetch returning generic bytes for unknown host, custom bytes for known host
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('known-good-site.com')) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => REAL_FAVICON_BYTES.buffer
      };
    }
    // Any uncached or probe host returns the generic Chrome default icon
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => GENERIC_BYTES.buffer
    };
  };
});

afterEach(() => {
  delete globalThis.document;
  delete globalThis.chrome;
  delete globalThis.fetch;
});

test('A5: hashBytes produces deterministic hash', () => {
  const h1 = hashBytes(GENERIC_BYTES.buffer);
  const h2 = hashBytes(GENERIC_BYTES.buffer);
  const h3 = hashBytes(REAL_FAVICON_BYTES.buffer);
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test('A5: renders letter tile initially and keeps it when _favicon returns generic icon', async () => {
  const container = createFaviconElement('https://uncached-site-123.xyz', 'Uncached Site');
  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].className, 'letter-tile');

  // Allow async probe & check to resolve
  await new Promise((r) => setTimeout(r, 50));

  // Should still be letter tile because bytes matched generic default
  assert.equal(container.children[0].className, 'letter-tile');
});

test('A5: swaps letter tile for img when site has a real distinct favicon', async () => {
  const container = createFaviconElement('https://known-good-site.com', 'Good Site');
  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].className, 'letter-tile', 'Render tile first');

  // Allow async check to resolve
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(container.children[0].className, 'favicon-img', 'Swaps in real icon once confirmed');
});

test('A5: caches domain favicon status in memory to avoid redundant network checks', async () => {
  let fetchCount = 0;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    fetchCount++;
    return origFetch(url);
  };

  // First render triggers probe + domain fetch
  createFaviconElement('https://known-good-site.com', 'Site 1');
  await new Promise((r) => setTimeout(r, 50));
  const fetchesAfterFirst = fetchCount;

  // Second render for same domain
  createFaviconElement('https://known-good-site.com', 'Site 1 duplicate');
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(fetchCount, fetchesAfterFirst, 'Must use memory cache for same domain without extra fetch');
});
