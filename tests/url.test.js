import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, getDomainFromUrl } from '../extension/js/utils/url.js';

test('normalizeUrl - adds https:// to bare domains', () => {
  const result = normalizeUrl('github.com');
  assert.equal(result.valid, true);
  assert.equal(result.url, 'https://github.com/');
  assert.equal(result.domain, 'github.com');
});

test('normalizeUrl - preserves existing https and query params', () => {
  const result = normalizeUrl('https://example.com/path?search=term');
  assert.equal(result.valid, true);
  assert.equal(result.url, 'https://example.com/path?search=term');
  assert.equal(result.domain, 'example.com');
});

test('normalizeUrl - allows http protocol', () => {
  const result = normalizeUrl('http://insecure-site.org');
  assert.equal(result.valid, true);
  assert.equal(result.url, 'http://insecure-site.org/');
  assert.equal(result.domain, 'insecure-site.org');
});

test('normalizeUrl - rejects dangerous protocols', () => {
  assert.equal(normalizeUrl('javascript:alert(1)').valid, false);
  assert.equal(normalizeUrl('data:text/html,<h1>test</h1>').valid, false);
  assert.equal(normalizeUrl('file:///C:/passwords.txt').valid, false);
  assert.equal(normalizeUrl('blob:https://example.com/uuid').valid, false);
});

test('normalizeUrl - rejects empty or malformed inputs', () => {
  assert.equal(normalizeUrl('').valid, false);
  assert.equal(normalizeUrl('   ').valid, false);
  // @ts-ignore
  assert.equal(normalizeUrl(null).valid, false);
});

test('getDomainFromUrl - extracts clean hostnames', () => {
  assert.equal(getDomainFromUrl('https://www.youtube.com/watch?v=123'), 'youtube.com');
  assert.equal(getDomainFromUrl('https://developer.mozilla.org/en-US/'), 'developer.mozilla.org');
  assert.equal(getDomainFromUrl('invalid-url'), '');
});
