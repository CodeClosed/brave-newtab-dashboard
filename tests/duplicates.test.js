import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCanonicalUrlForDeduplication,
  findDuplicateBookmark
} from '../extension/js/features/duplicates.js';

test('2.4 Duplicate detection: canonical URL normalizes host casing, www, trailing slash, and fragments', () => {
  const url1 = 'https://WWW.GitHub.com/brave/';
  const url2 = 'https://github.com/brave#readme';
  const url3 = 'http://localhost:3000/api/';
  const url4 = 'http://localhost:3000/api';

  assert.equal(getCanonicalUrlForDeduplication(url1), 'https://github.com/brave');
  assert.equal(getCanonicalUrlForDeduplication(url2), 'https://github.com/brave');
  assert.equal(getCanonicalUrlForDeduplication(url1), getCanonicalUrlForDeduplication(url2));

  assert.equal(getCanonicalUrlForDeduplication(url3), 'http://localhost:3000/api');
  assert.equal(getCanonicalUrlForDeduplication(url4), 'http://localhost:3000/api');
  assert.equal(getCanonicalUrlForDeduplication(url3), getCanonicalUrlForDeduplication(url4));
});

test('2.4 Duplicate detection: finds matching duplicate across categories', () => {
  const categories = [
    {
      id: 'cat-1',
      name: 'Development',
      bookmarks: [
        { id: 'b1', name: 'GitHub', url: 'https://github.com' },
        { id: 'b2', name: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/' }
      ]
    },
    {
      id: 'cat-2',
      name: 'Reference',
      bookmarks: [
        { id: 'b3', name: 'Stack Overflow', url: 'https://stackoverflow.com/' }
      ]
    }
  ];

  // Matches across www and trailing slash
  const dup1 = findDuplicateBookmark('https://www.github.com/', categories);
  assert.ok(dup1);
  assert.equal(dup1.category.id, 'cat-1');
  assert.equal(dup1.category.name, 'Development');
  assert.equal(dup1.bookmark.id, 'b1');

  // Matches with fragment
  const dup2 = findDuplicateBookmark('https://developer.mozilla.org/en-US#nav', categories);
  assert.ok(dup2);
  assert.equal(dup2.category.id, 'cat-1');
  assert.equal(dup2.bookmark.id, 'b2');

  // No duplicate
  const noDup = findDuplicateBookmark('https://news.ycombinator.com', categories);
  assert.equal(noDup, null);
});

test('2.4 Duplicate detection: ignores self when excludeBookmarkId is provided during edit', () => {
  const categories = [
    {
      id: 'cat-1',
      name: 'Development',
      bookmarks: [
        { id: 'b1', name: 'GitHub', url: 'https://github.com' }
      ]
    }
  ];

  // When editing b1, saving same URL does not flag as duplicate of itself
  const dupSelf = findDuplicateBookmark('https://github.com/', categories, 'b1');
  assert.equal(dupSelf, null);

  // But another bookmark URL does flag if duplicate
  const dupOther = findDuplicateBookmark('https://github.com/', categories, 'b2');
  assert.ok(dupOther);
  assert.equal(dupOther.bookmark.id, 'b1');
});
