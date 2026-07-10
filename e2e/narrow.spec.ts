import { expect, test } from '@playwright/test';
import { activePoint, enterYear, gotoLine } from './helpers';

/**
 * Narrow layout (a phone-width viewport): the wheel/drag world still exists,
 * but the explicit prev/next controls must be able to walk the local
 * timeline for touch and keyboard-light users.
 */
test.use({ viewport: { width: 480, height: 900 } });

test('480px: local prev/next buttons navigate the timeline', async ({ page }) => {
  await gotoLine(page);
  await enterYear(page, '1969', { source: 'database' });

  const start = await activePoint(page);

  // the controls are disabled while the descent lock is engaged and
  // enterYear waits for data-locked=false, so these clicks always count
  await expect(page.getByTestId('local-next')).toBeEnabled();

  // step later, then earlier, via the on-screen controls
  await page.getByTestId('local-next').click();
  await expect.poll(() => activePoint(page), { timeout: 5_000 }).not.toBe(start);

  await page.getByTestId('local-prev').click();
  await expect.poll(() => activePoint(page), { timeout: 5_000 }).toBe(start);
});
