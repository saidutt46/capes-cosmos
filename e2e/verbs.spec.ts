import { test, expect, type Page } from '@playwright/test';

/** P2 verb suite — SWEEP / LOCK / EXPOSE / deep links, driven through the
 * real pointer pipeline. Uses the window.__paperSky hook to locate stars and
 * void deterministically (no blind pixel guessing). */

declare global {
  interface Window {
    __paperSky: {
      screenPosOf(i: number): { x: number; y: number; px: number } | null;
      pickAt(x: number, y: number): number;
      locked: number;
    };
  }
}

async function ready(page: Page) {
  await page.addInitScript(() => localStorage.setItem('paper-sky:calibrated', '1'));
  await page.goto('/');
  await expect(page.getByTestId('status')).toContainText('23,272 OBJECTS', {
    timeout: 20_000,
  });
}

/** screen position of the first star that's actually on screen + pickable */
async function findStar(page: Page): Promise<{ x: number; y: number; index: number }> {
  return page.evaluate(() => {
    const f = window.__paperSky;
    for (let i = 0; i < 600; i++) {
      const sp = f.screenPosOf(i);
      if (!sp) continue;
      if (sp.x < 120 || sp.x > innerWidth - 460 || sp.y < 120 || sp.y > innerHeight - 140)
        continue;
      const hit = f.pickAt(sp.x, sp.y);
      if (hit === i) return { x: sp.x, y: sp.y, index: i };
    }
    throw new Error('no pickable star found');
  });
}

/** a screen point that picks nothing (true void) */
async function findVoid(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const f = window.__paperSky;
    const candidates: [number, number][] = [
      [90, 160], [innerWidth - 90, 160], [90, innerHeight - 160],
      [160, 90], [innerWidth / 2, 70], [60, innerHeight / 2],
    ];
    for (const [x, y] of candidates) {
      if (f.pickAt(x, y) === -1) return { x, y };
    }
    throw new Error('no void found');
  });
}

test('HOVER: tooltip names the star under the reticle', async ({ page }) => {
  await ready(page);
  const star = await findStar(page);
  await page.mouse.move(star.x, star.y);
  await expect(page.getByTestId('tooltip')).toBeVisible({ timeout: 3000 });
  await expect(page.getByTestId('tooltip')).toContainText('PS-');
});

test('LOCK: dossier unfolds, deep-links, chains, releases', async ({ page }) => {
  await ready(page);
  const star = await findStar(page);
  await page.mouse.click(star.x, star.y);

  const dossier = page.getByTestId('dossier');
  await expect(dossier).toBeVisible({ timeout: 4000 });
  await expect(dossier).toContainText('TARGET LOCKED');
  await expect(dossier).toContainText('LUMINOSITY');
  expect(page.url()).toContain('/star/PS-');

  await page.waitForTimeout(1800); // camera fly + gauges settle
  await page.screenshot({ path: 'test-results/visual/05-dossier.png' });

  // ESC releases: dossier gone, URL home, dim lifts
  await page.keyboard.press('Escape');
  await expect(dossier).toBeHidden({ timeout: 2000 });
  await expect.poll(() => page.evaluate(() => window.__paperSky.locked)).toBe(-1);
  expect(new URL(page.url()).pathname).toBe('/');
});

test('DEEP LINK: /star/PS-00001 locks Spider-Man on load', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('paper-sky:calibrated', '1'));
  await page.goto('/star/PS-00001');
  await expect(page.getByTestId('status')).toContainText('23,272 OBJECTS', {
    timeout: 20_000,
  });
  const dossier = page.getByTestId('dossier');
  await expect(dossier).toBeVisible({ timeout: 8000 });
  await expect(dossier).toContainText('PS-00001');
  await expect(dossier).toContainText('Spider-Man');
  await expect(dossier).toContainText('4,043 observations');
  // brightest star outshines everyone but itself — never "100%"
  await expect(dossier).toContainText('brighter than 99.99');
});

test('SWEEP: clicking the void answers with a sector census', async ({ page }) => {
  await ready(page);
  const v = await findVoid(page);
  await page.mouse.click(v.x, v.y);

  const notes = page.getByTestId('fieldnotes');
  await expect(notes).toBeVisible({ timeout: 3000 });
  await expect(notes).toContainText('SWEEP COMPLETE');
  await page.waitForTimeout(900); // wavefront mid-flight
  await page.screenshot({ path: 'test-results/visual/06-sweep.png' });
});

test('EXPOSE: stationary hold develops the faint sky', async ({ page }) => {
  await ready(page);
  const v = await findVoid(page);
  await page.mouse.move(v.x, v.y);
  await page.mouse.down();
  await page.waitForTimeout(1600); // > hold threshold, exposure building

  const counter = page.getByTestId('expose-counter');
  await expect(counter).toBeVisible();
  await expect(counter).toContainText('FAINT OBJECTS EMERGING');
  await page.screenshot({ path: 'test-results/visual/07-expose.png' });

  await page.mouse.up();
  await expect(counter).toBeHidden({ timeout: 2000 });
});
