import { expect, test, type Page } from '@playwright/test';

/** Cycle 3: the scrollable 1969 collage page. */

async function descendInto1969(page: Page) {
  await expect(page.getByTestId('year-label')).toHaveText('2026', {
    timeout: 30_000,
  });
  await page.waitForTimeout(1200);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(900);
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width / 2, viewport.height * 0.34);
  await expect(page.getByTestId('yol-title')).toHaveText('1969', {
    timeout: 15_000,
  });
  // wait until the descent fully completes (unlock) before interacting
  await expect(page.locator('[data-mode="yol"]')).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(4000); // let the arrival finish
}

test('scrolling the 1969 page reveals event sections', async ({ page }) => {
  await page.goto('/');
  await descendInto1969(page);

  const firstEvent = page.locator('.yp-event').first();
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(200);
  }
  await expect(firstEvent).toHaveClass(/in-view/, { timeout: 8_000 });
  await page.waitForTimeout(1200); // reveal transition
  const opacity = Number(
    await firstEvent.evaluate((el) => getComputedStyle(el).opacity)
  );
  expect(opacity).toBeGreaterThan(0.9);

  // the mini-timeline stays pinned and shows the active year pulse
  await expect(page.locator('.yp-tl-year.active .yp-tl-y')).toHaveText('1969');

  // return still works from a scrolled position
  await page.getByTestId('return-btn').click();
  await expect(page.getByTestId('yol-ui')).toHaveClass(/hidden/, {
    timeout: 15_000,
  });
  await expect(page.getByTestId('year-label')).toHaveText('1969');
});

test('theme chips dim non-matching events', async ({ page }) => {
  await page.goto('/');
  await descendInto1969(page);

  // engage the Cold War lens via keyboard focus, then scroll into the events
  await page.getByTestId('lens-coldwar').focus();
  await expect(page.locator('.yol-page')).toHaveAttribute('data-lens', 'coldwar');
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(180);
  }
  const apollo = page.locator('.yp-event[data-themes="spaceflight"]').first();
  const moratorium = page.locator('.yp-event[data-themes="coldwar"]').first();
  await expect(apollo).toHaveClass(/in-view/, { timeout: 8_000 });
  await expect(moratorium).toHaveClass(/in-view/, { timeout: 8_000 });
  await page.waitForTimeout(1300); // transitions settle

  const dimmed = Number(
    await apollo.evaluate((el) => getComputedStyle(el).opacity)
  );
  const kept = Number(
    await moratorium.evaluate((el) => getComputedStyle(el).opacity)
  );
  expect(dimmed).toBeLessThan(0.6);
  expect(kept).toBeGreaterThan(0.85);
});
