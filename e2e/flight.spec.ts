import { test, expect } from '@playwright/test';

/** FLIGHT mode end-to-end journey.
 *
 * Flow: quiet flag → survey loads → FLIGHT nav → hangar (3 ships, 4 maps) →
 * select TIME TUNNEL + PS ATLAS → LAUNCH → wait for morph → assert in-flight
 * HUD + speed > 0 → steer left → assert heading changed → ESC → hangar →
 * ESC → survey restored.
 */
test('flight: full journey — hangar → launch → steer → escape chain', async ({ page }) => {
  // suppress calibration overlay and audio prompts
  await page.addInitScript(() => localStorage.setItem('paper-sky:quiet', '1'));
  await page.goto('/');

  // wait for the survey to be ready (window.__paperSky set by StarField)
  await page.waitForFunction(() => !!(window as unknown as Record<string, unknown>).__paperSky, {
    timeout: 15_000,
  });

  // ── open hangar ──────────────────────────────────────────────────────────
  await page.getByTestId('flight-toggle').click();
  await expect(page.getByTestId('hangar')).toBeVisible({ timeout: 5_000 });

  // vessel options: PS DART / PS ATLAS / PS MOTH
  await expect(page.getByTestId('hangar-ship-dart')).toContainText('PS DART');
  await expect(page.getByTestId('hangar-ship-atlas')).toContainText('PS ATLAS');
  await expect(page.getByTestId('hangar-ship-moth')).toContainText('PS MOTH');

  // map options: 4 buttons exist
  await expect(page.getByTestId('hangar-map-spiral')).toContainText('GALAXY SPIRAL');
  await expect(page.getByTestId('hangar-map-shells')).toContainText('EXPANDING UNIVERSE');
  await expect(page.getByTestId('hangar-map-tunnel')).toContainText('TIME TUNNEL');
  await expect(page.getByTestId('hangar-map-constellations')).toContainText('CONSTELLATIONS');

  // ── select TIME TUNNEL map + PS ATLAS vessel ──────────────────────────────
  await page.getByTestId('hangar-map-tunnel').click();
  await page.getByTestId('hangar-ship-atlas').click();

  // ── launch ───────────────────────────────────────────────────────────────
  await page.getByTestId('launch').click();

  // wait until flight hook appears (covers the ~2.3s morph + flight constructor)
  await page.waitForFunction(
    () => !!(window as unknown as Record<string, unknown>).__paperSkyFlight,
    { timeout: 15_000 },
  );

  // flight HUD must be visible and show BEACONS text
  await expect(page.getByTestId('flight-hud')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('flight-beacons')).toContainText('BEACONS');

  // speed > 0 — poll until auto-cruise kicks in
  await page.waitForFunction(
    () => {
      const h = (window as unknown as Record<string, { speed(): number }>).__paperSkyFlight;
      return h && h.speed() > 0;
    },
    { timeout: 10_000 },
  );

  // ── steer left: record heading, hold ArrowLeft 600ms, assert heading changed ──
  const headingBefore = await page.evaluate(() => {
    const h = (window as unknown as Record<string, { heading(): [number, number, number] }>).__paperSkyFlight;
    return h.heading();
  });

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowLeft');

  const headingAfter = await page.evaluate(() => {
    const h = (window as unknown as Record<string, { heading(): [number, number, number] }>).__paperSkyFlight;
    return h.heading();
  });

  // any component of the heading vector must have changed by > 0.05
  const delta = Math.max(
    Math.abs(headingAfter[0] - headingBefore[0]),
    Math.abs(headingAfter[1] - headingBefore[1]),
    Math.abs(headingAfter[2] - headingBefore[2]),
  );
  expect(delta).toBeGreaterThan(0.05);

  // ── ESC → hangar ─────────────────────────────────────────────────────────
  await page.keyboard.press('Escape');

  // flight hook gone, hangar visible
  await expect(page.getByTestId('hangar')).toBeVisible({ timeout: 8_000 });
  await page.waitForFunction(
    () => !(window as unknown as Record<string, unknown>).__paperSkyFlight,
    { timeout: 5_000 },
  );

  // ── ESC → survey restored ─────────────────────────────────────────────────
  await page.keyboard.press('Escape');

  // hangar gone, flight-toggle (survey HUD) visible again
  await expect(page.getByTestId('hangar')).not.toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('flight-toggle')).toBeVisible({ timeout: 5_000 });

  // orbit controls re-enabled — endFlight tweens, so poll briefly
  await page.waitForFunction(
    () => {
      const ps = (window as unknown as Record<string, { controls?: { enabled?: boolean } }>).__paperSky;
      return ps?.controls?.enabled === true;
    },
    { timeout: 8_000 },
  );
});
