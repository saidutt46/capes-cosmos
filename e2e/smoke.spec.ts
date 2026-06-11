import { test, expect } from '@playwright/test';

test('survey loads: wordmark, data acquisition, canvas', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('paper-sky:calibrated', '1'));
  await page.goto('/');

  await expect(page.getByTestId('wordmark')).toContainText('PAPER SKY');

  // the bundle parses and the HUD reports the full object count
  await expect(page.getByTestId('status')).toContainText('23,272 OBJECTS', {
    timeout: 15_000,
  });

  // WebGL canvas is present and sized
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(800);
});

test('design page is reachable but hidden', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('paper-sky:calibrated', '1'));
  await page.goto('/design');
  await expect(page.getByTestId('design-title')).toContainText('FIELD MANUAL');

  // not linked from the home HUD
  await page.goto('/');
  await expect(page.locator('a[href="/design"]')).toHaveCount(0);
});
