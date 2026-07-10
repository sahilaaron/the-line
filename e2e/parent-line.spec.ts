import { expect, test } from '@playwright/test';
import { gotoLine, scrollBackTo } from './helpers';

/**
 * Parent-Line invariants that the YoL rebuild must not regress: the newest
 * anchor caps travel, arrow keys step between anchors, descent is offered
 * only where a year world exists, and rapid input cannot double-fire a
 * transition. (These live here so the local-timeline specs stay focused on
 * the nested world.)
 */

test('2026 caps travel toward the future', async ({ page }) => {
  await gotoLine(page);
  await page.mouse.wheel(0, -600); // wheel up = later; already at the newest
  await page.waitForTimeout(600);
  await expect(page.getByTestId('year-label')).toHaveText('2026');
});

test('arrow keys step between anchors and cap at the newest', async ({ page }) => {
  await gotoLine(page);

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(900);
  await expect(page.getByTestId('year-label')).toHaveText('1969');

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(900);
  await expect(page.getByTestId('year-label')).toHaveText('2026');

  await page.keyboard.press('ArrowRight'); // capped
  await page.waitForTimeout(600);
  await expect(page.getByTestId('year-label')).toHaveText('2026');
});

test('descent is offered only where a year world exists', async ({ page }) => {
  await gotoLine(page);
  await page.waitForTimeout(1500); // let the canvas + event system settle

  // 2026 has no YoL world: clicking the Earth shows a notice, no descent
  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width / 2, vp.height * 0.34);
  await expect(page.getByTestId('notice')).not.toHaveClass(/hidden/);
  await expect(page.getByTestId('yol-ui')).toHaveClass(/hidden/);
});

test('rapid double-click cannot double-fire the descent', async ({ page }) => {
  await gotoLine(page);
  await scrollBackTo(page, '1969');
  await page.waitForTimeout(500);

  const vp = page.viewportSize()!;
  const x = vp.width / 2;
  const y = vp.height * 0.34;
  await page.mouse.click(x, y);
  await page.waitForTimeout(100);
  await page.mouse.click(x, y); // swallowed by the transition lock

  await expect(page.locator('[data-mode="yol"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('yol-page')).toHaveAttribute('data-year', '1969');
});

test('debug mode exposes tuning and metrics', async ({ page }) => {
  await page.goto('/?debug=1');
  await expect(page.getByTestId('debug-panel')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('metric-mode')).toHaveText('line');
});
