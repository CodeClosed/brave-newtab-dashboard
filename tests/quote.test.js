import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getDayOfYear, getQuoteForDay, renderDailyQuote } from '../extension/js/features/quote.js';

test('10.2 Quotes Dataset: assets/quotes.json is valid and contains over 100 public-domain quotes', () => {
  const raw = fs.readFileSync('extension/assets/quotes.json', 'utf-8');
  const quotes = JSON.parse(raw);

  assert.ok(Array.isArray(quotes), 'quotes.json must be an array');
  assert.ok(quotes.length >= 100, `Expected at least 100 quotes, got ${quotes.length}`);

  for (const [idx, item] of quotes.entries()) {
    assert.ok(typeof item.quote === 'string' && item.quote.trim().length > 0, `Quote at ${idx} must have non-empty quote`);
    assert.ok(typeof item.author === 'string' && item.author.trim().length > 0, `Quote at ${idx} must have non-empty author`);
  }
});

test('10.2 Deterministic quote selection: same day yields identical quote', () => {
  const quotes = [
    { quote: 'Thought 1', author: 'Author 1' },
    { quote: 'Thought 2', author: 'Author 2' },
    { quote: 'Thought 3', author: 'Author 3' }
  ];

  const dateA = new Date(2026, 9, 5, 10, 0, 0); // Oct 5
  const dateB = new Date(2026, 9, 5, 23, 59, 59); // Oct 5 later
  const dateC = new Date(2026, 9, 6, 1, 0, 0); // Oct 6

  const quoteA = getQuoteForDay(quotes, dateA);
  const quoteB = getQuoteForDay(quotes, dateB);
  const quoteC = getQuoteForDay(quotes, dateC);

  assert.deepEqual(quoteA, quoteB, 'Different hours on the same day must yield the same quote');
  assert.notDeepEqual(quoteA, quoteC, 'Different consecutive days should yield different quotes when pool length allows');
});

test('10.2 Quote rendering: renders quote and author text or hides when disabled', () => {
  const container = {
    style: { display: '' },
    children: [],
    querySelector: (sel) => {
      if (sel === '.quote-text') return container.children.find(c => c.className === 'quote-text') || null;
      if (sel === '.quote-author') return container.children.find(c => c.className === 'quote-author') || null;
      return null;
    },
    appendChild: (child) => {
      container.children.push(child);
      return child;
    }
  };

  globalThis.document = {
    createElement: (tag) => ({ tagName: tag.toUpperCase(), className: '', textContent: '' })
  };

  const sampleQuotes = [
    { quote: 'Waste no more time arguing what a good man should be. Be one.', author: 'Marcus Aurelius' }
  ];

  try {
    // 1. Render enabled
    renderDailyQuote({ enabled: true }, container, sampleQuotes);
    assert.equal(container.style.display, 'block');
    const textEl = container.querySelector('.quote-text');
    const authorEl = container.querySelector('.quote-author');
    assert.ok(textEl.textContent.includes('Waste no more time'));
    assert.ok(authorEl.textContent.includes('Marcus Aurelius'));

    // 2. Disabled
    renderDailyQuote({ enabled: false }, container, sampleQuotes);
    assert.equal(container.style.display, 'none');
  } finally {
    delete globalThis.document;
  }
});
