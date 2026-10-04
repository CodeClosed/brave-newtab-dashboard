import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractLinkFromDataTransfer,
  isPastingUrlCandidate
} from '../extension/js/features/drag-paste.js';

test('2.3 Drop Link: extracts URL and title from text/html anchor textContent', () => {
  const fakeDataTransfer = {
    getData(type) {
      if (type === 'text/uri-list') return 'https://github.com/brave';
      if (type === 'text/html') return '<a href="https://github.com/brave">Brave on GitHub</a>';
      return '';
    }
  };

  const link = extractLinkFromDataTransfer(fakeDataTransfer);
  assert.ok(link);
  assert.equal(link.url, 'https://github.com/brave');
  assert.equal(link.name, 'Brave on GitHub');
});

test('2.3 Drop Link: safely extracts textContent only and ignores malicious scripts/tags in HTML', () => {
  const fakeDataTransfer = {
    getData(type) {
      if (type === 'text/uri-list') return 'https://example.com/page';
      if (type === 'text/html') return '<a href="https://example.com"><script>alert(1)</script>Safe <b>Link</b> Text</a>';
      return '';
    }
  };

  const link = extractLinkFromDataTransfer(fakeDataTransfer);
  assert.ok(link);
  assert.equal(link.url, 'https://example.com/page');
  assert.equal(link.name, 'Safe Link Text');
});

test('2.3 Drop Link: falls back to domain name when no HTML anchor is present', () => {
  const fakeDataTransfer = {
    getData(type) {
      if (type === 'text/uri-list') return 'https://developer.mozilla.org/en-US/docs/Web';
      if (type === 'text/plain') return 'https://developer.mozilla.org/en-US/docs/Web';
      return '';
    }
  };

  const link = extractLinkFromDataTransfer(fakeDataTransfer);
  assert.ok(link);
  assert.equal(link.url, 'https://developer.mozilla.org/en-US/docs/Web');
  assert.equal(link.name, 'developer.mozilla.org');
});

test('2.3 Drop Link: rejects dangerous or invalid URLs', () => {
  const fakeDataTransfer1 = {
    getData(type) {
      if (type === 'text/plain') return 'javascript:alert(1)';
      return '';
    }
  };
  assert.equal(extractLinkFromDataTransfer(fakeDataTransfer1), null);

  const fakeDataTransfer2 = {
    getData() {
      return '';
    }
  };
  assert.equal(extractLinkFromDataTransfer(fakeDataTransfer2), null);
});

test('2.3 Paste URL: detects valid URL strings when pasting while no input is focused', () => {
  assert.ok(isPastingUrlCandidate('https://news.ycombinator.com'));
  assert.ok(isPastingUrlCandidate('github.com/orgs/brave'));
  assert.ok(isPastingUrlCandidate('localhost:8080'));

  // Non-URL strings rejected
  assert.equal(isPastingUrlCandidate('just some notes or text'), false);
  assert.equal(isPastingUrlCandidate(''), false);
  assert.equal(isPastingUrlCandidate('javascript:alert(1)'), false);
});
