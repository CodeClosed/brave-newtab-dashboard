import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../extension/js/core/state.js';
import { createDefaultDashboardData } from '../extension/js/core/schema.js';
import {
  parseNetscapeBookmarksHtml,
  parseBookmarksCsv,
  parseAndValidateBookmarksImport
} from '../extension/js/features/data-io.js';

test('3.5 Imports: parseNetscapeBookmarksHtml extracts folders and bookmarks', () => {
  const html = `
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>Engineering</H3>
    <DL><p>
        <DT><A HREF="https://github.com">GitHub</A>
        <DT><A HREF="https://stackoverflow.com">Stack Overflow</A>
    </DL><p>
    <DT><H3>Design</H3>
    <DL><p>
        <DT><A HREF="https://figma.com">Figma</A>
    </DL><p>
</DL><p>
  `;

  const rawCategories = parseNetscapeBookmarksHtml(html);
  assert.equal(rawCategories.length, 2);
  assert.equal(rawCategories[0].name, 'Engineering');
  assert.equal(rawCategories[0].bookmarks.length, 2);
  assert.equal(rawCategories[0].bookmarks[0].name, 'GitHub');
  assert.equal(rawCategories[0].bookmarks[0].url, 'https://github.com');
  assert.equal(rawCategories[1].name, 'Design');
  assert.equal(rawCategories[1].bookmarks[0].name, 'Figma');
  assert.equal(rawCategories[1].bookmarks[0].url, 'https://figma.com');
});

test('3.5 Imports: 100-bookmark HTML import works and previews skipped items', () => {
  let bookmarkHtml = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><H3>Big Collection</H3><DL><p>';

  // Generate 100 valid bookmarks
  for (let i = 1; i <= 100; i++) {
    bookmarkHtml += `<DT><A HREF="https://example${i}.com">Example ${i}</A>\n`;
  }

  // Add 5 invalid bookmarks (skipped)
  bookmarkHtml += '<DT><A HREF="javascript:alert(1)">Dangerous JS</A>\n';
  bookmarkHtml += '<DT><A HREF="ftp://files.invalid">FTP link</A>\n';
  bookmarkHtml += '<DT><A HREF="data:text/html,bad">Data URL</A>\n';
  bookmarkHtml += '<DT><A HREF="invalid-no-domain">Invalid</A>\n';
  bookmarkHtml += '<DT><A HREF="">Empty URL</A>\n';

  bookmarkHtml += '</DL><p></DL><p>';

  const result = parseAndValidateBookmarksImport(bookmarkHtml, 'html');
  assert.equal(result.success, true);
  assert.equal(result.summary.bookmarkCount, 100);
  assert.equal(result.summary.skippedBookmarksCount, 5);
  assert.equal(result.summary.categoryCount, 1);
  assert.equal(result.data.categories[0].bookmarks.length, 100);
});

test('3.5 Imports: parseBookmarksCsv parses CSV with commas and quotes', () => {
  const csv = `name,url,collection
"Google, Inc.",https://google.com,Work
GitHub,https://github.com,"Work & Dev"
MDN,https://developer.mozilla.org,Reference
Bad Link,javascript:void(0),Work
`;

  const result = parseAndValidateBookmarksImport(csv, 'csv');
  assert.equal(result.success, true);
  assert.equal(result.summary.bookmarkCount, 3);
  assert.equal(result.summary.skippedBookmarksCount, 1);
  assert.equal(result.summary.categoryCount, 3);

  const workCat = result.data.categories.find(c => c.name === 'Work');
  assert.ok(workCat);
  assert.equal(workCat.bookmarks[0].name, 'Google, Inc.');
  assert.equal(workCat.bookmarks[0].url, 'https://google.com/');
});

test('3.5 Imports: undo restores original dashboard state after applying import', async () => {
  const initialData = createDefaultDashboardData();
  await store.replaceData(initialData, true);
  const initialCatCount = store.get().categories.length;

  const csv = `name,url,collection
My Bookmark,https://mybookmark.com,Imported
`;

  const result = parseAndValidateBookmarksImport(csv, 'csv');
  assert.equal(result.success, true);

  const snapshot = JSON.parse(JSON.stringify(store.get()));
  await store.replaceData(result.data, true);
  assert.equal(store.get().categories.length, 1);
  assert.equal(store.get().categories[0].bookmarks[0].name, 'My Bookmark');

  // Undo
  await store.replaceData(snapshot, true);
  assert.equal(store.get().categories.length, initialCatCount);
});
