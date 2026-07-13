import { expect, test, type Page } from '@playwright/test';
import { goToAnchor } from './helpers';

/**
 * THE RECURSIVE CHAIN SMOKE: the architectural proof for issue #16.
 *
 * Parent Line → 1769 → 1760–1780 Historical Field → Steam Engine →
 * James Watt → University of Glasgow → Scottish Enlightenment, then back
 * up one level at a time with EXACT restoration at every depth, landing
 * on the parent Line at 1769 — all through the generic world stack (no
 * subject-specific navigation anywhere). The construction cycle
 * (instruction-set/YoL-layered-handover.md) extends this suite; this spec
 * protects the kernel.
 */

/**
 * The chain runs with FASTER (not skipped) transition tunables via the
 * debug-mode URL tuning: identical code paths, locks and restoration —
 * only durations shrink, keeping the full 5-depth journey inside CI and
 * sandbox budgets.
 */
const FAST_TUNING =
  '/?debug=1&tune.worldTransitionSec=0.35&tune.descentDuration=1.6&tune.fieldSnapDelayMs=160&tune.topicSnapDelayMs=140';

async function gotoLineFast(page: Page): Promise<void> {
  await page.goto(FAST_TUNING);
  await expect(page.getByTestId('year-label')).toHaveText('2026', { timeout: 30_000 });
}

async function transitionSettled(page: Page): Promise<void> {
  await expect(page.locator('.experience')).toHaveAttribute('data-locked', 'false', {
    timeout: 20_000,
  });
}

async function descendInto1769(page: Page): Promise<void> {
  await goToAnchor(page, '1769');
  await expect(async () => {
    await page.mouse.click(800, 306);
    await expect(page.locator('[data-mode="yol"]')).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 25_000 });
  await transitionSettled(page);
}

test('the full recursive chain descends and restores exactly at every depth', async ({ page }) => {
  await gotoLineFast(page);
  await descendInto1769(page);

  // ---- the Historical Field, starting at the entered year -------------
  const field = page.getByTestId('historical-field');
  await expect(field).toBeVisible();
  await expect(page.locator('.experience')).toHaveAttribute('data-world', 'historical-field');
  await expect(page.getByTestId('field-current-year')).toHaveText('1769');
  // a surrounding field, not a single active item
  expect(await page.locator('.hf-item').count()).toBeGreaterThanOrEqual(6);

  // ---- continuous time: earlier, then later ---------------------------
  await page.mouse.move(800, 400);
  await page.mouse.wheel(0, 900);
  // (waits below are polls, not sleeps — the suite stays honest under CI)
  await expect.poll(async () => Number(await page.getByTestId('field-current-year').textContent()), {
    timeout: 5_000,
  }).toBeLessThan(1769);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(420);
  const yearBeforeEntering = Number(await page.getByTestId('field-current-year').textContent());
  expect(yearBeforeEntering).toBeLessThan(1769);
  expect(yearBeforeEntering).toBeGreaterThanOrEqual(1760);

  // step back within reach of 1769: plates are only interactive near
  // their moment (fieldActiveRadiusYears), so the spec must stand at 1768
  // before entering the Steam Engine — distance itself is behaviour
  await expect(async () => {
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('field-current-year')).toHaveText('1768', { timeout: 900 });
  }).toPass({ timeout: 15_000 });
  const fieldYearAtPush = 1768;

  // ---- descend the full topic chain -----------------------------------
  await page.getByTestId('field-item-steam-engine').click();
  await transitionSettled(page);
  await expect(page.getByTestId('topic-world-steam-engine')).toBeVisible();
  await expect(page.locator('.experience')).toHaveAttribute('data-depth', '2');

  // chapters travel horizontally; the doorway lives in chapter 2
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('topic-world-steam-engine')).toHaveAttribute('data-chapter', '1', {
    timeout: 5_000,
  });
  await page.getByTestId('topic-link-james-watt').click();
  await transitionSettled(page);
  await expect(page.getByTestId('topic-world-james-watt')).toBeVisible();
  await expect(page.locator('.experience')).toHaveAttribute('data-depth', '3');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('topic-world-james-watt')).toHaveAttribute('data-chapter', '1', {
    timeout: 5_000,
  });
  await page.getByTestId('topic-link-university-of-glasgow').click();
  await transitionSettled(page);
  await expect(page.getByTestId('topic-world-university-of-glasgow')).toBeVisible();
  await expect(page.locator('.experience')).toHaveAttribute('data-depth', '4');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('topic-world-university-of-glasgow')).toHaveAttribute(
    'data-chapter',
    '1',
    { timeout: 5_000 }
  );
  await page.getByTestId('topic-link-scottish-enlightenment').click();
  await transitionSettled(page);
  await expect(page.getByTestId('topic-world-scottish-enlightenment')).toBeVisible();
  await expect(page.locator('.experience')).toHaveAttribute('data-depth', '5');
  await expect(page.getByTestId('world-depth')).toHaveAttribute('data-depth', '5');

  // rapid double-Escape: the second must be swallowed by the lock
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await transitionSettled(page);

  // ---- unwind with EXACT restoration ----------------------------------
  await expect(page.getByTestId('topic-world-university-of-glasgow')).toBeVisible();
  await expect(page.getByTestId('topic-world-university-of-glasgow')).toHaveAttribute(
    'data-chapter',
    '1'
  );

  await page.getByTestId('world-back').click();
  await transitionSettled(page);
  await expect(page.getByTestId('topic-world-james-watt')).toBeVisible();
  await expect(page.getByTestId('topic-world-james-watt')).toHaveAttribute('data-chapter', '1');

  await page.keyboard.press('Escape');
  await transitionSettled(page);
  await expect(page.getByTestId('topic-world-steam-engine')).toBeVisible();
  await expect(page.getByTestId('topic-world-steam-engine')).toHaveAttribute('data-chapter', '1');

  await page.keyboard.press('Escape');
  await transitionSettled(page);
  await expect(page.getByTestId('historical-field')).toBeVisible();
  await expect(page.getByTestId('field-current-year')).toHaveText(String(fieldYearAtPush), {
    timeout: 5_000,
  });
  // the plate entered through regains keyboard focus
  await expect(page.getByTestId('field-item-steam-engine')).toBeFocused();

  // ---- back to the parent Line at the exact anchor ---------------------
  await page.keyboard.press('Escape');
  await expect(page.locator('.experience')).toHaveAttribute('data-mode', 'line', {
    timeout: 20_000,
  });
  await transitionSettled(page);
  await expect(page.getByTestId('year-label')).toHaveText('1769');
});

test('no page reload and no Canvas remount across the whole chain', async ({ page }) => {
  await gotoLineFast(page);
  await page.evaluate(() => {
    (window as unknown as { __chainMarker: number }).__chainMarker = 42;
    document.querySelector('canvas')?.setAttribute('data-canvas-marker', 'original');
  });
  await descendInto1769(page);
  await page.getByTestId('field-item-steam-engine').click();
  await transitionSettled(page);
  await expect(page.getByTestId('topic-world-steam-engine')).toBeVisible();
  await page.keyboard.press('Escape');
  await transitionSettled(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.experience')).toHaveAttribute('data-mode', 'line', {
    timeout: 20_000,
  });
  const marker = await page.evaluate(
    () => (window as unknown as { __chainMarker?: number }).__chainMarker
  );
  expect(marker).toBe(42); // no reload
  await expect(page.locator('canvas[data-canvas-marker="original"]')).toBeAttached(); // no remount
});
