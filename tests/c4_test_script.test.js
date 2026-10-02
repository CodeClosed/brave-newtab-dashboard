import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('C4: test script in package.json is "node --test tests/" for pre-Node 21 compatibility', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  assert.equal(
    pkg.scripts.test,
    'node --test tests/',
    'Test script must be "node --test tests/" to work on Node versions before 21'
  );
});
