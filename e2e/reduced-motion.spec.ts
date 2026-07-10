import { expect, test } from '@playwright/test';
import { activePoint, enterYear, gotoLine, returnToLine, settle } from './helpers';

/**
 * Reduced motion: the descent collapses to a short crossfade and the local
 * timeline snaps without easing, but the whole loop must still function and
 * stay database-backed.
 */
test('reduced motion: the local-timeline loop still works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoLine(page);
  await enterYear(page, '1969', { source: 'database' });

  const start = await activePoint(page);
  await page.keyboard.press('ArrowLeft'); // earlier
  await settle(page);
  expect(await activePoint(page)).not.toBe(start);

  await page.keyboard.press('ArrowRight'); // later
  await settle(page);

  await returnToLine(page, '1969');
});
