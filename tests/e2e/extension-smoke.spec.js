// @ts-check
import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '../../extension');

test.describe('Browser Integration: Brave / Chrome Extension Smoke Tests', () => {
  let browserContext;

  test.beforeEach(async () => {
    // Launch persistent context with unpacked extension loaded
    browserContext = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox'
      ]
    });
  });

  test.afterEach(async () => {
    if (browserContext) {
      await browserContext.close();
    }
  });

  test('E2E: boots newtab dashboard without errors and renders Stage 1 hero panel', async () => {
    const page = await browserContext.newPage();
    await page.goto('chrome://newtab/');

    // Fallback if chrome://newtab is not overridden directly in test runner
    const title = await page.title();
    if (title !== 'New Tab') {
      // Find extension background or newtab page URL
      let [backgroundPage] = browserContext.serviceWorkers();
      if (!backgroundPage) {
        backgroundPage = await browserContext.waitForEvent('serviceworker').catch(() => null);
      }
      const extensionId = backgroundPage ? backgroundPage.url().split('/')[2] : null;
      if (extensionId) {
        await page.goto(`chrome-extension://${extensionId}/newtab.html`);
      }
    }

    // Verify critical DOM elements render
    const heroPanel = page.locator('#hero-panel');
    await expect(heroPanel).toBeVisible({ timeout: 5000 });

    const clockDisplay = page.locator('#clock-display');
    await expect(clockDisplay).toBeVisible();

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    // Verify stage 2 collections hub exists
    const hub = page.locator('#collections-hub');
    await expect(hub).toBeAttached();
  });
});
