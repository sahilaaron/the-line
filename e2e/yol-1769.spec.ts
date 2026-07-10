import { expect, test, type Page } from '@playwright/test';

/**
 * Cycle 5b (issue #2): the 1769 Year on Line journey — proof that the Year
 * Visual Identity system is reusable. Line → descent → 1769 YoL → thematic
 * interaction → return to the same Line position.
 */

async function scrollBackTo(page: Page, label: string, maxTries = 60) {
  for (let i = 0; i < maxTries; i++) {
    const current = await page.getByTestId('year-label').textContent();
    if (current?.trim() === label) return;
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(800);
  await expect(page.getByTestId('year-label')).toHaveText(label);
}

test('1769 journey: line → descent → 1769 YoL → lenses → return to 1769', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('year-label')).toHaveText('2026', {
    timeout: 30_000,
  });

  // travel backward past 1969 to 1769
  await scrollBackTo(page, '1769');
  await page.waitForTimeout(700); // settle under the lens

  // enter the year
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width / 2, viewport.height * 0.34);
  await expect(page.getByTestId('yol-title')).toHaveText('1769', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('yol-ui')).not.toHaveClass(/hidden/);
  await expect(page.locator('.yol-page')).toHaveAttribute('data-year', '1769');
  await page.waitForTimeout(4200); // arrival choreography

  // the four 1769 lenses are present with their long-form labels
  await expect(page.getByTestId('lens-steam')).toContainText(
    'Steam & Mechanisation'
  );
  await expect(page.getByTestId('lens-knowledge')).toBeVisible();
  await expect(page.getByTestId('lens-trade')).toBeVisible();
  await expect(page.getByTestId('lens-labour')).toBeVisible();

  // thematic interaction: focusing a lens dims non-matching events
  await page.getByTestId('lens-steam').focus();
  await expect(page.locator('.yol-page')).toHaveAttribute('data-lens', 'steam');
  await expect(page.locator('.yp-event.dim').first()).toBeAttached();
  // the steam event itself must stay lit
  await expect(
    page.locator('.yp-event[data-section="steam"]')
  ).not.toHaveClass(/dim/);
  await page.getByTestId('lens-steam').blur();

  // 1769 mini-timeline pulses on 1769
  await expect(page.locator('.yp-tl-year.active .yp-tl-y')).toHaveText('1769');

  // return lands on the SAME Line position: 1769, not 1969
  await page.getByTestId('return-btn').click();
  await expect(page.getByTestId('yol-ui')).toHaveClass(/hidden/, {
    timeout: 15_000,
  });
  await expect(page.getByTestId('year-label')).toHaveText('1769');
});

test('1769 renders its own identity, distinct from 1969', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('year-label')).toHaveText('2026', {
    timeout: 30_000,
  });
  await scrollBackTo(page, '1769');
  await page.waitForTimeout(600);
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width / 2, viewport.height * 0.34);
  await expect(page.getByTestId('yol-title')).toHaveText('1769', {
    timeout: 15_000,
  });

  // identity variables resolved onto the page: 1769 rag paper, not 1969 cream
  const paper = await page
    .locator('.yol-page')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--yr-paper').trim());
  expect(paper).toBe('#d8c7a3');

  // all 1769 media is placeholder-state and labelled as such
  const placeholderFrames = page.locator(
    '.yp-events .mf[data-state="placeholder"]'
  );
  expect(await placeholderFrames.count()).toBeGreaterThanOrEqual(4);
  await expect(
    page.locator('.yp-events .mf-caption .mf-cap-src').first()
  ).toContainText(/placeholder/i);
});
