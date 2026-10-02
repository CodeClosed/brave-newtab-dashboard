import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidateImport } from '../extension/js/features/data-io.js';
import { validateDashboardData } from '../extension/js/core/schema.js';
import { repairCategories } from '../extension/js/core/migrate.js';

test('S2: parseAndValidateImport rejects import files over 5 MB', () => {
  // Create string > 5 MB
  const bigPadding = 'a'.repeat(5 * 1024 * 1024 + 10);
  const bigJson = `{"version":1,"padding":"${bigPadding}","categories":[]}`;

  const res = parseAndValidateImport(bigJson);
  assert.equal(res.success, false);
  assert.match(res.error, /5\s*MB/i);
});

test('S2: parseAndValidateImport rejects imports exceeding 5,000 bookmarks', () => {
  const bookmarks = [];
  for (let i = 0; i < 5001; i++) {
    bookmarks.push({ id: `bm-${i}`, name: `BM ${i}`, url: `https://example.com/${i}`, order: i });
  }

  const hugeBackup = JSON.stringify({
    version: 1,
    categories: [
      { id: 'cat-1', name: 'Huge Cat', order: 0, bookmarks }
    ]
  });

  const res = parseAndValidateImport(hugeBackup);
  assert.equal(res.success, false);
  assert.match(res.error, /5,?000 bookmarks/i);
});

test('S2: repairCategories caps names at 80 characters and icons at 8 characters', () => {
  const longName = 'A'.repeat(120);
  const longIcon = '📁'.repeat(20);

  const raw = [
    {
      id: 'cat-long',
      name: longName,
      icon: longIcon,
      order: 0,
      bookmarks: [
        { id: 'bm-long', name: longName, url: 'https://example.com', order: 0 }
      ]
    }
  ];

  const repaired = repairCategories(raw);
  assert.equal(repaired[0].name.length, 80, 'Category name must be capped at 80 chars');
  assert.ok(repaired[0].icon.length <= 8, 'Category icon must be capped at 8 chars');
  assert.equal(repaired[0].bookmarks[0].name.length, 80, 'Bookmark name must be capped at 80 chars');
});
