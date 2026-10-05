// @ts-check

/**
 * Calculates day of the year (0 to 365) for deterministic daily rotation.
 * @param {Date} [date=new Date()]
 * @returns {number}
 */
export function getDayOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - start.getTime()) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Deterministically picks a quote from the array based on day of year.
 * @param {Array<{ quote: string, author: string }>} quotes
 * @param {Date} [date=new Date()]
 * @returns {{ quote: string, author: string } | null}
 */
export function getQuoteForDay(quotes, date = new Date()) {
  if (!Array.isArray(quotes) || quotes.length === 0) {
    return null;
  }
  const day = getDayOfYear(date);
  const index = Math.abs(day) % quotes.length;
  return quotes[index] || null;
}

/**
 * Picks a random quote from the list, avoiding immediate duplicate if possible.
 * @param {Array<{ quote: string, author: string }>} quotes
 * @param {string} [currentQuote='']
 * @returns {{ quote: string, author: string } | null}
 */
export function pickRandomQuote(quotes, currentQuote = '') {
  if (!Array.isArray(quotes) || quotes.length === 0) return null;
  if (quotes.length === 1) return quotes[0];
  const candidates = quotes.filter(q => q.quote !== currentQuote);
  const pool = candidates.length > 0 ? candidates : quotes;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] || null;
}

let cachedQuotes = null;

/**
 * Loads offline quotes from extension/assets/quotes.json.
 * @returns {Promise<Array<{ quote: string, author: string }>>}
 */
export async function loadQuotes() {
  if (cachedQuotes) return cachedQuotes;

  try {
    const url = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
      ? chrome.runtime.getURL('assets/quotes.json')
      : 'assets/quotes.json';
    const resp = await fetch(url);
    if (resp.ok) {
      cachedQuotes = await resp.json();
      return cachedQuotes;
    }
  } catch {
    // Fallback if fetch is unavailable
  }

  return [];
}

/**
 * Renders the daily quote in the specified container element.
 * @param {import('../core/schema.js').DashboardData['settings']['quote']} quoteConf
 * @param {HTMLElement | null} containerEl
 * @param {Array<{ quote: string, author: string }>} [quotesList]
 */
export function renderDailyQuote(quoteConf, containerEl, quotesList = null) {
  if (!containerEl) return;

  const isEnabled = quoteConf?.enabled !== false;
  if (!isEnabled) {
    containerEl.style.display = 'none';
    return;
  }

  const list = quotesList || cachedQuotes;
  if (!list || list.length === 0) {
    containerEl.style.display = 'none';
    return;
  }

  const item = getQuoteForDay(list, new Date());
  if (!item) {
    containerEl.style.display = 'none';
    return;
  }

  containerEl.style.display = 'block';

  let textEl = containerEl.querySelector('.quote-text');
  let authorEl = containerEl.querySelector('.quote-author');

  if (!textEl) {
    textEl = document.createElement('p');
    textEl.className = 'quote-text';
    containerEl.appendChild(textEl);
  }

  if (!authorEl) {
    authorEl = document.createElement('cite');
    authorEl.className = 'quote-author';
    containerEl.appendChild(authorEl);
  }

  textEl.textContent = `“${item.quote}”`;
  authorEl.textContent = `— ${item.author}`;

  let refreshBtn = containerEl.querySelector ? containerEl.querySelector('.quote-refresh-btn') : null;
  if (!refreshBtn && typeof document !== 'undefined' && typeof document.createElement === 'function') {
    refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'quote-refresh-btn';
    if (typeof refreshBtn.setAttribute === 'function') {
      refreshBtn.setAttribute('aria-label', 'Show another quote');
    }
    refreshBtn.title = 'Show another quote';
    refreshBtn.textContent = '↺';
    if (typeof refreshBtn.addEventListener === 'function') {
      refreshBtn.addEventListener('click', () => {
        const currentText = textEl?.textContent ? textEl.textContent.replace(/^[“"]|[”"]$/g, '') : '';
        const nextQuote = pickRandomQuote(list, currentText);
        if (nextQuote && textEl && authorEl) {
          textEl.textContent = `“${nextQuote.quote}”`;
          authorEl.textContent = `— ${nextQuote.author}`;
        }
      });
    }
    if (typeof containerEl.appendChild === 'function') {
      containerEl.appendChild(refreshBtn);
    }
  }
}
