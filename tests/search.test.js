import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateArithmeticExpression,
  expandSearchShortcut,
  matchAndRankBookmarks
} from '../extension/js/features/search.js';

test('2.1 Calculator: evaluates arithmetic expressions with correct precedence without eval', () => {
  // Basic operations
  assert.equal(evaluateArithmeticExpression('2 + 3')?.result, 5);
  assert.equal(evaluateArithmeticExpression('10 - 4')?.result, 6);
  assert.equal(evaluateArithmeticExpression('6 * 7')?.result, 42);
  assert.equal(evaluateArithmeticExpression('24 / 4')?.result, 6);
  assert.equal(evaluateArithmeticExpression('14 % 4')?.result, 2);
  assert.equal(evaluateArithmeticExpression('2 ^ 10')?.result, 1024);

  // Precedence: * before +
  assert.equal(evaluateArithmeticExpression('2 + 3 * 4')?.result, 14);
  assert.equal(evaluateArithmeticExpression('(2 + 3) * 4')?.result, 20);

  // Complex nested expressions
  assert.equal(evaluateArithmeticExpression('100 / (2 + 3) * 2')?.result, 40);
  assert.equal(evaluateArithmeticExpression('3 + 4 * 2 / (1 - 5) ^ 2')?.result, 3.5);

  // Decimals and negative numbers
  assert.equal(evaluateArithmeticExpression('-5 + 12')?.result, 7);
  assert.equal(evaluateArithmeticExpression('3.5 * 2')?.result, 7);
});

test('2.1 Calculator: safely handles malformed and non-math input without throwing', () => {
  assert.equal(evaluateArithmeticExpression(''), null);
  assert.equal(evaluateArithmeticExpression('hello world'), null);
  assert.equal(evaluateArithmeticExpression('yt cats'), null);
  assert.equal(evaluateArithmeticExpression('http://example.com'), null);
  assert.equal(evaluateArithmeticExpression('2 + + 3'), null);
  assert.equal(evaluateArithmeticExpression('(2 + 3'), null);
  assert.equal(evaluateArithmeticExpression('2 + 3)'), null);
  assert.equal(evaluateArithmeticExpression('/ 5'), null);
  assert.equal(evaluateArithmeticExpression('5 / 0'), null); // Division by zero handled
});

test('2.1 Search Shortcuts: expands registered shortcut key with URL template', () => {
  const shortcuts = [
    { key: 'yt', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s' },
    { key: 'gh', name: 'GitHub', url: 'https://github.com/search?q=%s' }
  ];

  const res1 = expandSearchShortcut('yt funny cats', shortcuts);
  assert.ok(res1);
  assert.equal(res1.matched, true);
  assert.equal(res1.query, 'funny cats');
  assert.equal(res1.url, 'https://www.youtube.com/results?search_query=funny%20cats');

  const res2 = expandSearchShortcut('gh brave newtab', shortcuts);
  assert.ok(res2);
  assert.equal(res2.matched, true);
  assert.equal(res2.url, 'https://github.com/search?q=brave%20newtab');

  // URL query encoding
  const res3 = expandSearchShortcut('yt cats & dogs', shortcuts);
  assert.ok(res3);
  assert.equal(res3.url, 'https://www.youtube.com/results?search_query=cats%20%26%20dogs');

  // No match when prefix is not a shortcut
  const res4 = expandSearchShortcut('google something', shortcuts);
  assert.equal(res4, null);

  // Bare key without space and query is not expanded as a shortcut
  const res5 = expandSearchShortcut('yt', shortcuts);
  assert.equal(res5, null);
});

test('2.1 Bookmark Ranking: ranks exact name > prefix > word-prefix > substring name > domain', () => {
  const categories = [
    {
      id: 'cat-1',
      name: 'Development',
      bookmarks: [
        { id: 'b1', name: 'Git', url: 'https://git-scm.com' },
        { id: 'b2', name: 'GitHub Docs', url: 'https://docs.github.com' },
        { id: 'b3', name: 'Pro Git Book', url: 'https://git-scm.com/book' },
        { id: 'b4', name: 'Vercel', url: 'https://vercel.com' },
        { id: 'b5', name: 'GitLab', url: 'https://gitlab.com' },
        { id: 'b6', name: 'Hosting Service', url: 'https://git-host.com' }
      ]
    }
  ];

  // Query: "git"
  const results = matchAndRankBookmarks('git', categories);
  assert.ok(results.length >= 4);

  // 1st: Exact match ("Git")
  assert.equal(results[0].bookmark.name, 'Git');
  assert.equal(results[0].strongMatch, true);
  assert.equal(results[0].score, 100);

  // 2nd and 3rd: Prefix match ("GitHub Docs", "GitLab")
  assert.ok(results[1].bookmark.name === 'GitHub Docs' || results[1].bookmark.name === 'GitLab');
  assert.equal(results[1].strongMatch, true);
  assert.equal(results[1].score, 80);

  // 4th: Word-prefix match ("Pro Git Book")
  const proGit = results.find(r => r.bookmark.name === 'Pro Git Book');
  assert.ok(proGit);
  assert.equal(proGit.score, 60);
  assert.equal(proGit.strongMatch, false);

  // 5th: Domain match ("Hosting Service" matched by "git" in domain)
  const hostService = results.find(r => r.bookmark.name === 'Hosting Service');
  assert.ok(hostService);
  assert.equal(hostService.score, 20);
  assert.equal(hostService.strongMatch, false);

  // Vercel has no 'git' in name or domain, so not matched
  assert.ok(!results.some(r => r.bookmark.name === 'Vercel'));
});

test('2.1 Bookmark Ranking: caps results at 8 items and filters by active space', () => {
  const categories = [
    {
      id: 'cat-1',
      spaceId: 'space-home',
      name: 'Dev Links',
      bookmarks: Array.from({ length: 15 }, (_, i) => ({
        id: `bm-${i}`,
        name: `Tool Item ${i + 1}`,
        url: `https://tool${i + 1}.example.com`
      }))
    },
    {
      id: 'cat-other-space',
      spaceId: 'space-work',
      name: 'Work Links',
      bookmarks: [
        { id: 'bm-work', name: 'Tool Item 99', url: 'https://work.example.com' }
      ]
    }
  ];

  // Search in active space 'space-home'
  const activeSpaceResults = matchAndRankBookmarks('Tool', categories, { activeSpaceId: 'space-home' });
  assert.equal(activeSpaceResults.length, 8, 'Must cap results at 8');
  assert.ok(activeSpaceResults.every(r => r.category.spaceId === 'space-home'));

  // Search all spaces when flag is enabled
  const allSpacesResults = matchAndRankBookmarks('Tool Item 99', categories, { activeSpaceId: 'space-home', searchAllSpaces: true });
  assert.equal(allSpacesResults.length, 1);
  assert.equal(allSpacesResults[0].bookmark.name, 'Tool Item 99');
});
