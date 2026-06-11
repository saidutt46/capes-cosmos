import { test, expect } from '@playwright/test';

test('RADIO toggle starts the band and the dossier grows a SIGNAL strip', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('paper-sky:quiet', '1'));
  await page.goto('/');
  await page.waitForFunction(() => '__paperSky' in window);

  const toggle = page.locator('[data-testid="radio-toggle"]');
  await expect(toggle).toHaveText(/RADIO OFF/);

  await toggle.click();
  await expect(toggle).toHaveText(/RADIO ON/);

  await page.evaluate(() =>
    ((window as never as Record<string, never>)['__paperSky'] as {
      lock(i: number): void;
    }).lock(42),
  );
  await expect(page.locator('[data-testid="dossier"]')).toBeVisible();
  const signal = page.locator('[data-testid="signal"]');
  await expect(signal).toBeVisible();
  await expect(signal).toContainText(/PERIOD \d\.\d{2}s · BAND/);

  await toggle.click(); // OFF → strip leaves the dossier
  await expect(toggle).toHaveText(/RADIO OFF/);
  await expect(signal).toHaveCount(0);
});
