// @ts-check
import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    headless: false, // Extensions require headless: false or new headless mode with chrome extension flags
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true
  }
});
