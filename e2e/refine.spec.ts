import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => '__paperSky' in window);
});

test('footer legend is promoted to 16px copy', async ({ page }) => {
  const legend = page.locator('[data-testid="legend"]');
  await expect(legend).toBeVisible();
  await expect(legend).toHaveCSS('font-size', '16px');
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

test('constellations layout shows reality placards; lock hides them', async ({ page }) => {
  await page.click('[data-testid="dial-constellations"]');
  await page.waitForTimeout(2800); // morph settles
  const tags = page.locator('[data-testid="chart-tags"]');
  await expect(tags).toContainText('EARTH-616');
  await expect(tags).toContainText('SOULS');

  await page.evaluate(() =>
    ((window as never as Record<string, never>)['__paperSky'] as {
      lock(i: number): void;
    }).lock(0),
  );
  await page.waitForTimeout(600);
  await expect(tags).not.toContainText('EARTH-616');
});

test('epoch markers answer "is the center 1900 or 2013"', async ({ page }) => {
  await page.waitForTimeout(3200); // ignition
  const tags = page.locator('[data-testid="chart-tags"]');
  await expect(tags).toContainText('1935 — FIRST LIGHT'); // spiral default
  await expect(tags).toContainText('1980');

  await page.click('[data-testid="dial-tunnel"]');
  await page.waitForTimeout(2800);
  await expect(tags).toContainText('1990');
  await expect(tags).not.toContainText('FIRST LIGHT');
});
