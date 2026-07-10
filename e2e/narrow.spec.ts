import { expect, test } from '@playwright/test';
import { activePoint, enterYear, gotoLine, settle } from './helpers';

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

  // step later, then earlier, via the on-screen controls
  await page.getByTestId('local-next').click();
  await settle(page);
  const afterNext = await activePoint(page);
  expect(afterNext).not.toBe(start);

  await page.getByTestId('local-prev').click();
  await settle(page);
  const afterPrev = await activePoint(page);
  expect(afterPrev).toBe(start);
});
