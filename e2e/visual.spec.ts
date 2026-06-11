import { test, expect, type Page } from '@playwright/test';

/** Visual self-check — captures the rendered sky so changes can be verified
 * by eye (and by the agent) without a human in the loop. */

async function loaded(page: Page) {
  await page.addInitScript(() => localStorage.setItem('paper-sky:quiet', '1'));
  await page.goto('/');
  await expect(page.getByTestId('status')).toContainText('23,272 OBJECTS', {
    timeout: 15_000,
  });
}

test('capture: galaxy overview with designations', async ({ page }) => {
  await loaded(page);
  await page.waitForTimeout(1500); // settle + legend glitch + labels
  // designations are on by default and should be placing names
  await expect
    .poll(async () =>
      page.locator('[data-testid="labels"] span:visible').count(),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/visual/01-spiral.png' });
});

test('capture: all four layouts morph via the dial', async ({ page }) => {
  await loaded(page);
  await page.waitForTimeout(800);

  for (const [id, legendBit] of [
    ['shells', 'big bang'],
    ['tunnel', 'Depth is time'],
    ['constellations', 'multiverse'],
  ] as const) {
    await page.getByTestId(`dial-${id}`).click();
    await expect(page.getByTestId('legend')).toContainText(legendBit);
    await page.waitForTimeout(2800); // morph + camera move complete
    await page.screenshot({ path: `test-results/visual/02-${id}.png` });
  }

  // back to spiral — the dial round-trips
  await page.getByTestId('dial-spiral').click();
  await page.waitForTimeout(2800);
  await page.screenshot({ path: 'test-results/visual/03-back-to-spiral.png' });
});

test('designations toggle hides labels', async ({ page }) => {
  await loaded(page);
  await page.getByTestId('names-toggle').click();
  await expect(page.locator('[data-testid="labels"]')).toBeHidden();
  await page.getByTestId('names-toggle').click();
  await expect(page.locator('[data-testid="labels"]')).toBeVisible();
});

test('capture: flown-in close view (identity rings should resolve)', async ({ page }) => {
  await loaded(page);
  const c = page.locator('canvas');
  await c.hover({ position: { x: 900, y: 350 } });
  for (let i = 0; i < 22; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/visual/04-close.png' });
});
