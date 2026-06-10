import { defineConfig } from '@playwright/test';

/** Run the full e2e suite against the live deployment:
 *  npx playwright test --config playwright.prod.config.ts */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  retries: 1, // network variance on the live edge
  use: {
    baseURL: process.env.PROD_URL ?? 'https://capes-cosmos.vercel.app',
    viewport: { width: 1440, height: 900 },
  },
});
