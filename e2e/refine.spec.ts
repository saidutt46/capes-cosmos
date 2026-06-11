import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => '__paperSky' in window);
});

test('footer legend is promoted to 14px copy', async ({ page }) => {
  const legend = page.locator('[data-testid="legend"]');
  await expect(legend).toBeVisible();
  await expect(legend).toHaveCSS('font-size', '14px');
});

test('lens clear-all appears with an active lens and resets it', async ({ page }) => {
  const clear = page.locator('[data-testid="lens-clear"]');
  await expect(clear).toHaveCount(0);

  await page.click('[data-testid="lens-deceased"]');
  await expect(clear).toBeVisible();

  await clear.click();
  await expect(clear).toHaveCount(0);
});

test('Esc clears an active lens when nothing is locked', async ({ page }) => {
  await page.click('[data-testid="lens-marvel"]');
  await expect(page.locator('[data-testid="lens-clear"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="lens-clear"]')).toHaveCount(0);
});
