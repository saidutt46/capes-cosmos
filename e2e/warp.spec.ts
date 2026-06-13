import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('paper-sky:quiet', '1'));
  await page.goto('/');
  await page.waitForFunction(() => '__paperSky' in window);
});

test('warp search flies to a character and finds its binary companion', async ({ page }) => {
  await page.click('[data-testid="warp-toggle"]');
  await expect(page.locator('[data-testid="warp"]')).toBeVisible();

  await page.fill('[data-testid="warp-input"]', 'spider-man');
  const first = page.locator('[data-testid="warp-result"]').first();
  await expect(first).toContainText(/Spider-Man/i);
  await first.click();

  await expect(page.locator('[data-testid="dossier"]')).toBeVisible({ timeout: 10_000 });
  const idx = await page.evaluate(
    () => ((window as never as Record<string, never>)['__paperSky'] as { locked: number }).locked,
  );
  expect(idx).toBeGreaterThanOrEqual(0);

  await page.click('[data-testid="find-companion"]');
  const card = page.locator('[data-testid="companion-card"]');
  await expect(card).toContainText('BINARY SYSTEM');
  await expect(card).toContainText(/SEPARATION \d\.\d{3}/);

  await page.click('[data-testid="companion-traverse"]');
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => ((window as never as Record<string, never>)['__paperSky'] as { locked: number }).locked,
        ),
      { timeout: 10_000 },
    )
    .not.toBe(idx);

  await page.keyboard.press('Escape');
});

test('deep link still locks (regression)', async ({ page }) => {
  await page.goto('/star/PS-00001');
  await page.waitForFunction(() => '__paperSky' in window);
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => ((window as never as Record<string, never>)['__paperSky'] as { locked: number }).locked,
        ),
      { timeout: 12_000 },
    )
    .toBe(0);
});
