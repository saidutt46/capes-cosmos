import { test, expect, type Page } from '@playwright/test';

/** P3 suite — lenses, methodology, reduced-motion. */

async function ready(page: Page) {
  await page.addInitScript(() => localStorage.setItem('paper-sky:quiet', '1'));
  await page.goto('/');
  await expect(page.getByTestId('status')).toContainText('23,272 OBJECTS', {
    timeout: 20_000,
  });
}

test('LENS: fate filter engages, composes, clears', async ({ page }) => {
  await ready(page);

  const deceased = page.getByTestId('lens-deceased');
  await deceased.click();
  await expect(deceased).toHaveClass(/active/);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/visual/08-lens-deceased.png' });

  // switching to another lens deactivates the first
  await page.getByTestId('lens-marvel').click();
  await expect(deceased).not.toHaveClass(/active/);
  await expect(page.getByTestId('lens-marvel')).toHaveClass(/active/);

  // clicking the active lens clears it
  await page.getByTestId('lens-marvel').click();
  await expect(page.getByTestId('lens-marvel')).not.toHaveClass(/active/);
});

test('METHODOLOGY: colophon page linked from HUD', async ({ page }) => {
  await ready(page);
  await page.getByText('METHODOLOGY').click();
  await expect(page.getByTestId('methodology-title')).toBeVisible();
  await expect(page.locator('body')).toContainText('CC0');
  // return link works
  await page.getByText('RETURN TO THE SURVEY').click();
  await expect(page.getByTestId('wordmark')).toBeVisible();
});

test('REDUCED MOTION: instant ignition, fully functional', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('paper-sky:quiet', '1'));
  await page.goto('/');
  // no 2.6s ignition cascade — full count immediately after load
  await expect(page.getByTestId('status')).toContainText('23,272 OBJECTS', {
    timeout: 12_000,
  });
  // layout switching still works (short crossfade)
  await page.getByTestId('dial-constellations').click();
  await expect(page.getByTestId('legend')).toContainText('multiverse');
  await ctx.close();
});
