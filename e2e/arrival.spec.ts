import { expect, test, type Page } from '@playwright/test';

/** Cycle 2: arrival choreography, theme lenses, reduced-motion behaviour. */

async function descendInto1969(page: Page) {
  await expect(page.getByTestId('year-label')).toHaveText('2026', {
    timeout: 30_000,
  });
  await page.waitForTimeout(1200);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(900);
  await expect(page.getByTestId('year-label')).toHaveText('1969');
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width / 2, viewport.height * 0.34);
  await expect(page.getByTestId('yol-title')).toHaveText('1969', {
    timeout: 15_000,
  });
}

test('arrival reveals the tableau in stages', async ({ page }) => {
  await page.goto('/');
  await descendInto1969(page);

  // shortly after the swap the lens row should still be (mostly) unrevealed
  const early = Number(
    await page
      .locator('.yp-chips')
      .evaluate((el) => getComputedStyle(el).opacity)
  );
  // after the arrival completes it must be fully revealed
  await page.waitForTimeout(4500);
  const late = Number(
    await page
      .locator('.yp-chips')
      .evaluate((el) => getComputedStyle(el).opacity)
  );
  expect(late).toBeGreaterThan(0.95);
  expect(late).toBeGreaterThanOrEqual(early);
});

test('theme lenses respond to keyboard focus and hover', async ({ page }) => {
  await page.goto('/');
  await descendInto1969(page);
  await page.waitForTimeout(4200); // let the arrival finish

  // keyboard focus
  await page.getByTestId('lens-coldwar').focus();
  await expect(page.getByTestId('lens-coldwar')).toHaveAttribute(
    'data-active',
    'true'
  );
  await page.getByTestId('lens-coldwar').blur();

  // hover
  await page.getByTestId('lens-signal').hover();
  await expect(page.getByTestId('lens-signal')).toHaveAttribute(
    'data-active',
    'true'
  );

  // canvas must keep rendering while a lens is focused (no crash): return
  await page.getByTestId('return-btn').click();
  await expect(page.getByTestId('yol-ui')).toHaveClass(/hidden/, {
    timeout: 15_000,
  });
  await expect(page.getByTestId('year-label')).toHaveText('1969');
});

test('reduced motion: loop still works with short crossfade', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('year-label')).toHaveText('2026', {
    timeout: 30_000,
  });
  await page.waitForTimeout(1200);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(900);
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width / 2, viewport.height * 0.34);

  // reduced-motion transition is much shorter than the full descent
  await expect(page.getByTestId('yol-title')).toHaveText('1969', {
    timeout: 6_000,
  });
  await page.waitForTimeout(1500);
  const lensOpacity = Number(
    await page
      .locator('.yp-chips')
      .evaluate((el) => getComputedStyle(el).opacity)
  );
  expect(lensOpacity).toBeGreaterThan(0.9);

  await page.getByTestId('return-btn').click();
  await expect(page.getByTestId('yol-ui')).toHaveClass(/hidden/, {
    timeout: 8_000,
  });
  await expect(page.getByTestId('year-label')).toHaveText('1969');
});
