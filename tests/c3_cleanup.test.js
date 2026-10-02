import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('C3: IMPLEMENTATION_PLAN_COMPLETE.md is deleted and docs/IMPLEMENTATION_PLAN.md remains', () => {
  assert.equal(
    fs.existsSync('IMPLEMENTATION_PLAN_COMPLETE.md'),
    false,
    'IMPLEMENTATION_PLAN_COMPLETE.md in repo root must be deleted'
  );
  assert.equal(
    fs.existsSync('docs/IMPLEMENTATION_PLAN.md'),
    true,
    'docs/IMPLEMENTATION_PLAN.md must be preserved'
  );
});
