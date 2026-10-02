import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../extension/js/core/migrate.js';

test('migrate - upgrades unversioned legacy document', () => {
  const legacy = {
    settings: {
      theme: 'dark'
    },
    categories: [
      {
        name: 'Work',
        bookmarks: [
          { name: 'GitHub', url: 'github.com' }
        ]
      }
    ]
  };

  const migrated = migrate(legacy);
  assert.equal(migrated.version, 1);
  assert.equal(migrated.settings.theme, 'dark');
  assert.equal(migrated.settings.layout, 'grid');
  assert.equal(migrated.categories.length, 1);
  assert.equal(typeof migrated.categories[0].id, 'string');
  assert.equal(migrated.categories[0].bookmarks[0].url, 'https://github.com/');
});

test('migrate - falls back to defaults on corrupt input', () => {
  const resultNull = migrate(null);
  assert.equal(resultNull.version, 1);
  assert.equal(resultNull.categories.length > 0, true);

  const resultString = migrate('not-an-object');
  assert.equal(resultString.version, 1);
});
