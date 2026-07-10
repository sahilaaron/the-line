import { expect, test } from '@playwright/test';
import {
  activePoint,
  enterField,
  enterYear,
  gotoLine,
  returnToLine,
  settle,
  wheelEarlier,
  YOL_YEARS,
} from './helpers';

/**
 * The nested local-timeline world, database-backed. For each anchored year
 * (1769 and 1969) this proves the whole loop against `data-source=database`:
 * enter from the parent Line, land on the year's overview, move earlier
 * (wheel down) and later (ArrowRight), focus a theme lens (non-matching
 * stations dim, matching stay lit), and return to the SAME parent-Line year.
 *
 * The specific lens per year is one known to tag at least one development,
 * so the dim/keep assertion is meaningful:
 *  - 1769 `steam`  -> watt-condenser, water-frame
 *  - 1969 `coldwar`-> moratorium, world-in-motion
 */
const LENS: Record<string, string> = { '1769': 'steam', '1969': 'coldwar' };

/** Since issue #16, 1769 descends into the Historical Field
 *  (e2e/historical-chain.spec.ts); the database-backed YoL journey is
 *  proven on 1969. Further YoL years extend this list. */
const YOL_RENDERER_YEARS = YOL_YEARS.filter((y) => y !== '1769');

for (const year of YOL_RENDERER_YEARS) {
  test(`${year}: database-backed local timeline — enter, move, lens, return`, async ({
    page,
  }) => {
    await gotoLine(page);
    const yol = await enterYear(page, year, { source: 'database' });

    // ---- initial active point is THIS year's overview ------------------
    await expect(yol).toHaveAttribute('data-active-point', /.+/);
    const overview = page.locator('.yw-station[data-role="overview"]');
    await expect(overview).toHaveCount(1);
    const overviewTestId = await overview.getAttribute('data-testid');
    const initial = await activePoint(page);
    expect(`station-${initial}`).toBe(overviewTestId);

    // ---- move EARLIER (wheel down) -------------------------------------
    await wheelEarlier(page);
    const earlier = await activePoint(page);
    expect(earlier).not.toBe(initial);

    // ---- move LATER (ArrowRight) --------------------------------------
    await page.keyboard.press('ArrowRight');
    await settle(page);
    const later = await activePoint(page);
    expect(later).not.toBe(earlier);

    // ---- theme lens: non-matching developments dim, matching stay lit --
    const lens = LENS[year];
    const lensBtn = page.getByTestId(`lens-${lens}`);
    await lensBtn.click();
    // clicking PINS the lens: announced pressed, and the page carries it
    await expect(lensBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(yol).toHaveAttribute('data-lens', lens);
    // at least one station is dimmed by the lens
    await expect(page.locator('.yw-station.dim').first()).toBeAttached({
      timeout: 5_000,
    });
    // every station tagged with the lens theme stays lit (never dimmed)
    const matching = page.locator(`.yw-station[data-themes~="${lens}"]`);
    const matchCount = await matching.count();
    expect(matchCount).toBeGreaterThan(0);
    for (let i = 0; i < matchCount; i++) {
      await expect(matching.nth(i)).not.toHaveClass(/\bdim\b/);
    }
    // clicking the same lens again releases the PIN immediately…
    await lensBtn.click();
    await expect(lensBtn).toHaveAttribute('aria-pressed', 'false');
    // …but the pointer is still hovering the button, and hover is a
    // deliberate transient focus. Only once the pointer leaves the lens
    // controls does the page drop the lens entirely.
    await expect(yol).toHaveAttribute('data-lens', lens);
    const vp = page.viewportSize()!;
    await page.mouse.move(vp.width * 0.75, vp.height * 0.45);
    await expect(yol).not.toHaveAttribute('data-lens', lens);

    // ---- return lands on the SAME year on the parent Line --------------
    await returnToLine(page, year);
  });
}

test('the two prototype years enter DIFFERENT world renderers', async ({ page }) => {
  await gotoLine(page);
  // 1769 → the continuous Historical Field (issue #16)
  await enterField(page);
  await expect(page.getByTestId('field-current-year')).toHaveText('1769');
  await returnToLine(page, '1769');

  // 1969 → the database-backed YoL local timeline (issue #14), untouched
  await enterYear(page, '1969', { source: 'database' });
  const lenses1969 = await page
    .locator('.yp-chips [data-testid^="lens-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(lenses1969).toContain('lens-coldwar');
  await expect(page.locator('.experience')).toHaveAttribute('data-world', 'yol');
});
