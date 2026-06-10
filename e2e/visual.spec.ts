import { test, expect } from '@playwright/test';

/** Visual self-check — captures the rendered sky so changes can be verified
 * by eye (and by the agent) without a human in the loop. */

test('capture: galaxy overview', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toContainText('23,272 OBJECTS', {
    timeout: 15_000,
  });
  await page.waitForTimeout(1200); // let the field settle + legend glitch land
  await page.screenshot({ path: 'test-results/visual/overview.png' });
});

test('capture: flown-in close view (identity rings should resolve)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toContainText('23,272 OBJECTS', {
    timeout: 15_000,
  });
  // zoom hard toward the upper arm region — wheel deltas at a fixed point
  const c = page.locator('canvas');
  await c.hover({ position: { x: 900, y: 350 } });
  for (let i = 0; i < 22; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/visual/close.png' });
});
