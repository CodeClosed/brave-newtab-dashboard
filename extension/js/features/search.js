// @ts-check
import { store } from '../core/state.js';
import { el } from '../utils/dom.js';
import { createFaviconElement } from '../ui/favicons.js';
import { showToast } from '../ui/toasts.js';

export const SEARCH_ENGINES = {
  google: {
    name: 'Google',
    url: 'https://www.google.com/search',
    param: 'q',
    placeholder: 'Search Google...'
  },
  brave: {
    name: 'Brave Search',
    url: 'https://search.brave.com/search',
    param: 'q',
    placeholder: 'Search with Brave...'
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/',
    param: 'q',
    placeholder: 'Search DuckDuckGo...'
  },
  bing: {
    name: 'Bing',
    url: 'https://www.bing.com/search',
    param: 'q',
    placeholder: 'Search Bing...'
  }
};

/**
 * Updates search form action, input name, and placeholder based on current settings.
 * @param {string} engineKey
 */
export function applySearchEngine(engineKey) {
  const form = /** @type {HTMLFormElement | null} */ (document.getElementById('search-form'));
  const input = /** @type {HTMLInputElement | null} */ (document.getElementById('search-input'));
  if (!form || !input) return;

  const engine = SEARCH_ENGINES[engineKey] || SEARCH_ENGINES.google;
  form.action = engine.url;
  input.name = engine.param;
  input.placeholder = engine.placeholder;

  const prefix = form.querySelector('.search-icon-prefix');
  if (prefix) {
    prefix.setAttribute('title', `Search engine: ${engine.name} (click to switch)`);
    prefix.setAttribute(' data-engine'.trim(), engineKey in SEARCH_ENGINES ? engineKey : 'google');
  }
}

/**
 * Safely evaluates arithmetic expressions using a hand-written recursive-descent parser.
 * Supports digits, decimals, +, -, *, /, ^, %, and parentheses ().
 * Strictly never uses eval() or new Function().
 *
 * @param {string} expr
 * @returns {{ expression: string, result: number } | null}
 */
export function evaluateArithmeticExpression(expr) {
  if (!expr || typeof expr !== 'string') return null;
  const trimmed = expr.trim();
  if (!trimmed) return null;

  // Disallow characters other than digits, decimal dots, operators, parentheses, and spaces
  if (!/^[\d\.\+\-\*\/\^\%\(\)\s]+$/.test(trimmed)) {
    return null;
  }

  // Must contain at least one operator symbol to be considered an arithmetic expression
  if (!/[\+\-\*\/\^\%]/.test(trimmed)) {
    return null;
  }

  // Tokenize
  /** @type {Array<{ type: string, val?: number }>} */
  const tokens = [];
  let i = 0;
  while (i < trimmed.length) {
    const ch = trimmed[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/\d|\./.test(ch)) {
      let numStr = '';
      let dotCount = 0;
      while (i < trimmed.length && /[\d\.]/.test(trimmed[i])) {
        if (trimmed[i] === '.') {
          dotCount++;
          if (dotCount > 1) return null;
        }
        numStr += trimmed[i];
        i++;
      }
      if (numStr === '.') return null;
      tokens.push({ type: 'NUM', val: parseFloat(numStr) });
      continue;
    }
    if ('+-*/^%()'.includes(ch)) {
      tokens.push({ type: ch });
      i++;
      continue;
    }
    return null;
  }

  if (tokens.length === 0) return null;

  // Validate operator positioning:
  // - Starts with +, *, /, ^, % -> invalid
  // - Ends with any operator -> invalid
  // - Consecutive operators (e.g. "2 + + 3") -> invalid
  if (['+', '*', '/', '^', '%'].includes(tokens[0].type)) return null;
  if (['+', '-', '*', '/', '^', '%'].includes(tokens[tokens.length - 1].type)) return null;

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    const prev = idx > 0 ? tokens[idx - 1] : null;
    const next = idx < tokens.length - 1 ? tokens[idx + 1] : null;

    if (['+', '-', '*', '/', '^', '%'].includes(tok.type)) {
      if (prev && ['+', '-', '*', '/', '^', '%'].includes(prev.type)) {
        return null; // consecutive operators
      }
      if (prev && prev.type === '(' && tok.type !== '-') {
        return null; // e.g. "(/ 5)"
      }
      if (next && next.type === ')') {
        return null; // e.g. "(5 +)"
      }
    }
  }

  let pos = 0;
  function peek() {
    return tokens[pos] || null;
  }
  function consume(expectedType) {
    const t = peek();
    if (!t) return null;
    if (expectedType && t.type !== expectedType) return null;
    pos++;
    return t;
  }

  function parseExpr() {
    let left = parseTerm();
    if (left === null) return null;
    while (true) {
      const p = peek();
      if (p && (p.type === '+' || p.type === '-')) {
        consume();
        const right = parseTerm();
        if (right === null) return null;
        left = p.type === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm() {
    let left = parsePower();
    if (left === null) return null;
    while (true) {
      const p = peek();
      if (p && (p.type === '*' || p.type === '/' || p.type === '%')) {
        consume();
        const right = parsePower();
        if (right === null) return null;
        if (p.type === '*') {
          left = left * right;
        } else if (p.type === '/') {
          if (right === 0) return null;
          left = left / right;
        } else if (p.type === '%') {
          if (right === 0) return null;
          left = left % right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  function parsePower() {
    const left = parseUnary();
    if (left === null) return null;
    const p = peek();
    if (p && p.type === '^') {
      consume();
      const right = parsePower(); // right-associative exponentiation
      if (right === null) return null;
      const res = Math.pow(left, right);
      if (!isFinite(res)) return null;
      return res;
    }
    return left;
  }

  function parseUnary() {
    const p = peek();
    if (p && p.type === '-') {
      consume();
      const val = parseUnary();
      if (val === null) return null;
      return -val;
    }
    if (p && p.type === '+') {
      consume();
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const p = peek();
    if (!p) return null;
    if (p.type === 'NUM') {
      consume();
      return p.val !== undefined ? p.val : null;
    }
    if (p.type === '(') {
      consume();
      const val = parseExpr();
      if (val === null) return null;
      if (!consume(')')) return null;
      return val;
    }
    return null;
  }

  const result = parseExpr();
  if (result === null || pos !== tokens.length) {
    return null;
  }
  if (!isFinite(result) || isNaN(result)) {
    return null;
  }

  const rounded = Math.round(result * 1e10) / 1e10;
  return {
    expression: trimmed,
    result: rounded
  };
}

/**
 * Expands a registered shortcut key into a search URL if the input matches.
 * @param {string} input
 * @param {Array<{ key: string, name?: string, url: string }>} shortcuts
 * @returns {{ matched: boolean, key: string, name?: string, query: string, url: string } | null}
 */
export function expandSearchShortcut(input, shortcuts) {
  if (!input || typeof input !== 'string' || !Array.isArray(shortcuts)) {
    return null;
  }
  const trimmed = input.trim();
  const match = trimmed.match(/^([^\s]+)\s+(.+)$/);
  if (!match) return null;

  const [, key, query] = match;
  const shortcut = shortcuts.find((s) => s && s.key && s.key.toLowerCase() === key.toLowerCase());
  if (!shortcut || !shortcut.url || !shortcut.url.includes('%s')) {
    return null;
  }

  const url = shortcut.url.replace('%s', encodeURIComponent(query));
  return {
    matched: true,
    key: shortcut.key,
    name: shortcut.name,
    query,
    url
  };
}

/**
 * Filters and ranks bookmarks against a query string.
 * Caps results at 8 items.
 *
 * @param {string} query
 * @param {Array<import('../core/schema.js').Category>} categories
 * @param {{ activeSpaceId?: string, searchAllSpaces?: boolean }} [options]
 * @returns {Array<{ bookmark: import('../core/schema.js').Bookmark, category: import('../core/schema.js').Category, score: number, strongMatch: boolean }>}
 */
export function matchAndRankBookmarks(query, categories, options = {}) {
  if (!query || typeof query !== 'string' || !Array.isArray(categories)) {
    return [];
  }
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const { activeSpaceId, searchAllSpaces = false } = options;

  /** @type {Array<{ bookmark: import('../core/schema.js').Bookmark, category: import('../core/schema.js').Category, score: number, strongMatch: boolean }>} */
  const results = [];

  for (const cat of categories) {
    if (!cat || !Array.isArray(cat.bookmarks)) continue;
    if (activeSpaceId && !searchAllSpaces && cat.spaceId && cat.spaceId !== activeSpaceId) {
      continue;
    }

    for (const bm of cat.bookmarks) {
      if (!bm || !bm.name || !bm.url) continue;

      const name = bm.name.trim();
      const lowerName = name.toLowerCase();
      let domain = '';
      try {
        domain = new URL(bm.url).hostname.replace(/^www\./, '');
      } catch {
        domain = bm.url.toLowerCase();
      }
      const lowerDomain = domain.toLowerCase();

      let score = 0;
      let strongMatch = false;

      // Ranking tiers:
      // 1. Exact name match (100)
      if (lowerName === q) {
        score = 100;
        strongMatch = true;
      }
      // 2. Prefix name match (80)
      else if (lowerName.startsWith(q)) {
        score = 80;
        strongMatch = true;
      }
      // 3. Word-prefix match (60)
      else if (lowerName.split(/[\s\-_]+/).some((w) => w.startsWith(q))) {
        score = 60;
        strongMatch = false;
      }
      // 4. Substring in name (40)
      else if (lowerName.includes(q)) {
        score = 40;
        strongMatch = false;
      }
      // 5. Domain substring match (20)
      else if (lowerDomain.includes(q)) {
        score = 20;
        strongMatch = false;
      }

      if (score > 0) {
        results.push({
          bookmark: bm,
          category: cat,
          score,
          strongMatch
        });
      }
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  // Cap at 8 results
  return results.slice(0, 8);
}

/**
 * Initializes the unified search combobox with auto-complete, keyboard navigation,
 * math calculator, shortcuts, and space filtering.
 */
export function initUnifiedSearch() {
  const form = /** @type {HTMLFormElement | null} */ (document.getElementById('search-form'));
  const input = /** @type {HTMLInputElement | null} */ (document.getElementById('search-input'));
  const resultsList = /** @type {HTMLUListElement | null} */ (document.getElementById('search-results-list'));

  if (!form || !input || !resultsList) return;

  // Interactive search engine switcher on the prefix icon badge
  const prefixEl = form.querySelector('.search-icon-prefix');
  if (prefixEl && !prefixEl.hasAttribute('data-BoundEngineSwitcher')) {
    prefixEl.setAttribute('data-BoundEngineSwitcher', 'true');
    prefixEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const engineOrder = Object.keys(SEARCH_ENGINES);
      const currentEngine = store.getState()?.settings?.searchEngine || 'google';
      const idx = engineOrder.indexOf(currentEngine);
      const nextEngine = engineOrder[(idx + 1) % engineOrder.length];
      store.updateSettings({ searchEngine: nextEngine });
      applySearchEngine(nextEngine);
      showToast(`Search engine: ${SEARCH_ENGINES[nextEngine].name}`);
      input.focus();
    });
  }

  let selectedIndex = -1;
  /** @type {Array<any>} */
  let currentItems = [];
  let searchAllSpaces = false;

  function closeDropdown() {
    resultsList.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    resultsList.replaceChildren();
    selectedIndex = -1;
    currentItems = [];
  }

  function updateActiveDescendant() {
    const itemEls = resultsList.querySelectorAll('.search-result-item');
    itemEls.forEach((itemEl, idx) => {
      const isSelected = idx === selectedIndex;
      itemEl.classList.toggle('is-selected', isSelected);
      itemEl.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      if (isSelected) {
        input.setAttribute('aria-activedescendant', itemEl.id);
        itemEl.scrollIntoView({ block: 'nearest' });
      }
    });

    if (selectedIndex === -1) {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function renderDropdown() {
    const query = input.value.trim();
    if (!query) {
      closeDropdown();
      return;
    }

    const state = store.getState();
    const searchConfig = state.settings?.behavior?.search || {
      filterBookmarks: true,
      calculator: true,
      shortcuts: []
    };

    /** @type {Array<{ type: 'calc' | 'bookmark', data: any, strongMatch?: boolean }>} */
    const items = [];

    // Check Calculator
    if (searchConfig.calculator !== false) {
      const calc = evaluateArithmeticExpression(query);
      if (calc) {
        items.push({ type: 'calc', data: calc, strongMatch: true });
      }
    }

    // Check Bookmarks
    if (searchConfig.filterBookmarks !== false) {
      const ranked = matchAndRankBookmarks(query, state.categories || [], {
        activeSpaceId: state.activeSpaceId,
        searchAllSpaces
      });
      for (const r of ranked) {
        items.push({ type: 'bookmark', data: r, strongMatch: r.strongMatch });
      }
    }

    currentItems = items;

    if (items.length === 0) {
      closeDropdown();
      return;
    }

    resultsList.replaceChildren();

    items.forEach((item, idx) => {
      const li = el('li', {
        id: `search-option-${idx}`,
        role: 'option',
        className: 'search-result-item',
        'aria-selected': 'false'
      });

      if (item.type === 'calc') {
        const row = el('div', { className: 'search-result-calc' }, [
          el('span', { className: 'calc-icon' }, '='),
          el('span', { className: 'calc-val' }, String(item.data.result)),
          el('span', { className: 'calc-hint' }, 'Press Enter to copy')
        ]);
        li.appendChild(row);

        li.addEventListener('click', () => {
          navigator.clipboard?.writeText(String(item.data.result));
          showToast(`Copied ${item.data.result} to clipboard`);
          closeDropdown();
          input.focus();
        });
      } else if (item.type === 'bookmark') {
        const { bookmark, category } = item.data;
        let domain = '';
        try {
          domain = new URL(bookmark.url).hostname.replace(/^www\./, '');
        } catch {
          domain = bookmark.url;
        }

        const faviconEl = createFaviconElement(bookmark.url, bookmark.name);
        const nameEl = el('span', { className: 'search-result-name' }, bookmark.name);
        const catEl = el('span', { className: 'search-result-cat' }, category.name);
        const domainEl = el('span', { className: 'search-result-domain' }, domain);

        li.appendChild(faviconEl);
        li.appendChild(nameEl);
        li.appendChild(catEl);
        li.appendChild(domainEl);

        li.addEventListener('click', () => {
          executeOpenBookmark(bookmark.url);
        });
      }

      resultsList.appendChild(li);
    });

    // Space toggle footer if multiple spaces exist
    if (state.spaces && state.spaces.length > 1) {
      const toggleRow = el('li', { className: 'search-toggle-space-row', role: 'presentation' });
      const toggleBtn = el('button', {
        type: 'button',
        className: 'btn-quiet search-toggle-space-btn'
      }, searchAllSpaces ? 'Searching all spaces (click to limit)' : 'Search all spaces');
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        searchAllSpaces = !searchAllSpaces;
        renderDropdown();
        input.focus();
      });
      toggleRow.appendChild(toggleBtn);
      resultsList.appendChild(toggleRow);
    }

    resultsList.hidden = false;
    input.setAttribute('aria-expanded', 'true');

    // Pre-highlight first result ONLY if strongMatch is true
    if (items.length > 0 && items[0].strongMatch) {
      selectedIndex = 0;
    } else {
      selectedIndex = -1;
    }
    updateActiveDescendant();
  }

  function executeOpenBookmark(url) {
    const state = store.getState();
    const openIn = state.settings?.behavior?.openIn || 'same';
    closeDropdown();
    if (openIn === 'new') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
  }

  input.addEventListener('input', () => {
    renderDropdown();
  });

  input.addEventListener('focus', () => {
    if (input.value.trim()) {
      renderDropdown();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!resultsList.hidden) {
        e.preventDefault();
        closeDropdown();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      if (currentItems.length > 0) {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % currentItems.length;
        updateActiveDescendant();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      if (currentItems.length > 0) {
        e.preventDefault();
        selectedIndex = selectedIndex <= 0 ? currentItems.length - 1 : selectedIndex - 1;
        updateActiveDescendant();
      }
      return;
    }

    if (e.key === 'Enter') {
      // Alt+Enter always performs the default web search
      if (e.altKey) {
        closeDropdown();
        return; // allow form submission
      }

      // If an item is actively highlighted
      if (selectedIndex >= 0 && selectedIndex < currentItems.length) {
        e.preventDefault();
        const selected = currentItems[selectedIndex];
        if (selected.type === 'calc') {
          navigator.clipboard?.writeText(String(selected.data.result));
          showToast(`Copied ${selected.data.result} to clipboard`);
          closeDropdown();
        } else if (selected.type === 'bookmark') {
          executeOpenBookmark(selected.data.bookmark.url);
        }
        return;
      }

      // If no item is highlighted, check if it expands as a search shortcut
      const query = input.value.trim();
      const state = store.getState();
      const shortcuts = state.settings?.behavior?.search?.shortcuts || [];
      const shortcutMatch = expandSearchShortcut(query, shortcuts);
      if (shortcutMatch) {
        e.preventDefault();
        closeDropdown();
        window.location.href = shortcutMatch.url;
        return;
      }

      // Otherwise allow standard form submission to search engine
      closeDropdown();
    }
  });

  // Close dropdown on outside click
  document.addEventListener('pointerdown', (e) => {
    if (!form.contains(/** @type {Node} */ (e.target))) {
      closeDropdown();
    }
  });
}

/**
 * Initializes keyboard shortcuts for search (e.g. '/' focuses search input)
 * and unified search suggestions combobox.
 */
export function initSearchShortcuts() {
  initUnifiedSearch();

  window.addEventListener('keydown', (e) => {
    // Focus search on '/' when not actively focused in an input, textarea, or open dialog
    const activeTag = document.activeElement?.tagName || '';
    const isDialogOpen = Boolean(document.querySelector('dialog[open], .settings-drawer.open'));

    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) && !isDialogOpen) {
      e.preventDefault();
      const input = document.getElementById('search-input');
      if (input) {
        input.focus();
      }
    }
  });
}
