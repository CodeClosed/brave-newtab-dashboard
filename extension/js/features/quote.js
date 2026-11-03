// @ts-check
import { el } from '../utils/dom.js';
import { ICON_TARGET, ICON_REFRESH } from '../ui/icons.js';

const INSPIRATIONAL_QUOTES = [
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
  { text: 'Simplicity is the soul of efficiency.', author: 'Austin Freeman' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Small steps every day lead to big results.', author: 'Anonymous' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'Make each day your masterpiece.', author: 'John Wooden' }
];

let cachedQuoteIndex = null;

function getDailyQuote() {
  if (cachedQuoteIndex === null) {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    cachedQuoteIndex = dayOfYear % INSPIRATIONAL_QUOTES.length;
  }
  return INSPIRATIONAL_QUOTES[cachedQuoteIndex];
}

/**
 * Renders or updates the Daily Inspiration & Focus Goal widget.
 *
 * @param {HTMLElement | null} container
 * @param {import('../core/schema.js').DashboardData} state
 */
export function renderQuoteWidget(container, state) {
  if (!container) return;

  const isEnabled = Boolean(state?.settings?.widgets?.quote);
  const heroConf = state?.settings?.hero?.widgets?.quote;
  const isHiddenByHero = Boolean(heroConf?.hidden);

  if (!isEnabled || isHiddenByHero) {
    container.hidden = true;
    container.style.display = 'none';
    return;
  }

  container.hidden = false;
  if (!container.dataset.freeDrag) {
    container.style.display = '';
  }

  const quote = getDailyQuote();
  const card = el('div', { className: 'widget-card widget-quote' });

  // Header
  const header = el('div', { className: 'widget-header' }, [
    el('div', { className: 'widget-title-group' }, [
      el('span', { className: 'widget-title', text: 'Daily Focus', html: `${ICON_TARGET}<span>Daily Focus</span>` })
    ]),
    el('button', {
      className: 'btn-quiet btn-sm quote-refresh-btn',
      type: 'button',
      text: 'New Quote',
      html: `${ICON_REFRESH}<span>New Quote</span>`,
      title: 'Show another quote',
      onclick: () => {
        cachedQuoteIndex = (cachedQuoteIndex + 1) % INSPIRATIONAL_QUOTES.length;
        renderQuoteWidget(container, state);
      }
    })
  ]);

  // Quote body
  const quoteText = el('p', { className: 'quote-text', text: `“${quote.text}”` });
  const quoteAuthor = el('span', { className: 'quote-author', text: `— ${quote.author}` });

  // Focus intention row
  const todayKey = `ntd_focus_${new Date().toISOString().slice(0, 10)}`;
  let savedFocus = '';
  try {
    savedFocus = localStorage.getItem(todayKey) || '';
  } catch (_) {}

  const focusInput = /** @type {HTMLInputElement} */ (el('input', {
    type: 'text',
    className: 'quote-focus-input',
    placeholder: 'What is your main priority today?...',
    value: savedFocus,
    'aria-label': 'Daily priority'
  }));

  focusInput.addEventListener('input', () => {
    try {
      localStorage.setItem(todayKey, focusInput.value.trim());
    } catch (_) {}
  });

  const focusGroup = el('div', { className: 'quote-focus-group' }, [
    el('span', { className: 'quote-focus-label', text: 'Today:' }),
    focusInput
  ]);

  card.appendChild(header);
  card.appendChild(quoteText);
  card.appendChild(quoteAuthor);
  card.appendChild(focusGroup);

  const existingFrame = container.querySelector ? container.querySelector('.widget-drag-frame') : null;
  if (typeof container.replaceChildren === 'function') {
    container.replaceChildren(card);
  } else {
    container.textContent = '';
    container.appendChild(card);
  }
  if (existingFrame) {
    container.appendChild(existingFrame);
  }
}
