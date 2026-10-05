import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { t } from '../extension/js/utils/i18n.js';

test('7.2 i18n: t() falls back to fallback string when chrome.i18n is absent', () => {
  const originalChrome = globalThis.chrome;
  delete globalThis.chrome;
  try {
    assert.equal(t('search_placeholder', 'Search bookmarks...'), 'Search bookmarks...');
    assert.equal(t('unknown_key', 'Default message'), 'Default message');
    assert.equal(t('hello_user', 'Hello $1!', 'Alice'), 'Hello Alice!');
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test('7.2 i18n: t() queries chrome.i18n.getMessage when available', () => {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    i18n: {
      getMessage(key, substitutions) {
        if (key === 'app_title') return 'My Dashboard';
        if (key === 'welcome_user') return `Welcome, ${substitutions[0]}!`;
        return '';
      }
    }
  };
  try {
    assert.equal(t('app_title', 'Fallback'), 'My Dashboard');
    assert.equal(t('welcome_user', 'Fallback', ['Bob']), 'Welcome, Bob!');
    assert.equal(t('non_existent', 'Fallback text'), 'Fallback text');
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test('7.2 i18n structure: _locales/en/messages.json exists, is valid JSON, and has message properties', () => {
  const localesPath = path.resolve('extension/_locales/en/messages.json');
  assert.ok(fs.existsSync(localesPath), 'messages.json must exist at extension/_locales/en/messages.json');

  const content = fs.readFileSync(localesPath, 'utf-8');
  const parsed = JSON.parse(content);
  assert.ok(typeof parsed === 'object' && parsed !== null);

  assert.ok(parsed.appName && parsed.appName.message, 'appName message must exist');
  assert.ok(parsed.appDesc && parsed.appDesc.message, 'appDesc message must exist');
  assert.ok(parsed.searchPlaceholder && parsed.searchPlaceholder.message, 'searchPlaceholder message must exist');
});

test('7.2 Manifest: manifest.json defines default_locale: "en"', () => {
  const manifestPath = path.resolve('extension/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.equal(manifest.default_locale, 'en', 'manifest.json must specify default_locale: "en"');
});
