import { expect, test, type Page } from '@playwright/test';
import { goToAnchor } from './helpers';

/**
 * Reduced motion — the layered-world path (issue #16).
 *
 * The kernel already provides a single reduced-motion renderer (no second
 * component): transitions collapse to short fades, easing jumps, parallax
 * and plate scaling are disabled. This spec proves the WHOLE recursive
 * chain — field travel, a topic push, exact restoration and the return —
 * still functions and restores exactly under `reducedMotion: 'reduce'`.
 */
const FAST =
  '/?debug=1&tune.worldTransitionSec=0.35&tune.descentDuration=1.6&tune.fieldSnapDelayMs=160&tune.topicSnapDelayMs=140';

async function settled(page: Page): Promise<void> {
  await expect(page.locator('.experience')).toHaveAttribute('data-locked', 'false', {
    timeout: 20_000,
  });
}

test('reduced motion: the field → topic → return chain still works and restores', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(FAST);
  await expect(page.getByTestId('year-label')).toHaveText('2026', { timeout: 30_000 });

  // descend into the 1769 field
  await goToAnchor(page, '1769');
  await expect(async () => {
    await page.mouse.click(800, 306);
    await expect(page.locator('[data-mode="yol"]')).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 25_000 });
  await settled(page);
  await expect(page.getByTestId('historical-field')).toBeVisible();
  await expect(page.getByTestId('field-current-year')).toHaveText('1769');

  // field travel still changes the year (jump, not eased)
  await page.keyboard.press('ArrowLeft');
  await expect.poll(
    async () => Number(await page.getByTestId('field-current-year').textContent()),
    { timeout: 5_000 }
  ).toBe(1768);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('field-current-year')).toHaveText('1769', { timeout: 5_000 });

  // a topic push works and hierarchy is preserved
  await page.getByTestId('field-item-steam-engine').click();
  await settled(page);
  await expect(page.getByTestId('topic-world-steam-engine')).toBeVisible();
  await expect(page.locator('.experience')).toHaveAttribute('data-depth', '2');

  // chapter travel works under reduced motion
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('topic-world-steam-engine')).toHaveAttribute('data-chapter', '1', {
    timeout: 5_000,
  });

  // return: exact field restoration, then back to the parent Line at 1769
  await page.keyboard.press('Escape');
  await settled(page);
  await expect(page.getByTestId('historical-field')).toBeVisible();
  await expect(page.getByTestId('field-current-year')).toHaveText('1769');
  await page.keyboard.press('Escape');
  await expect(page.locator('.experience')).toHaveAttribute('data-mode', 'line', {
    timeout: 20_000,
  });
  await expect(page.getByTestId('year-label')).toHaveText('1769');
});
