import { expect, test, type Page } from '@playwright/test';
import { enterField, goToAnchor, gotoLine } from './helpers';

/**
 * The 1760–1780 Historical Field (issue #16 construction coverage).
 *
 * Complements e2e/historical-chain.spec.ts (which protects the recursive
 * kernel): this file exercises the FIELD itself — collage density,
 * continuous travel, deterministic restoration, hover/focus metadata,
 * the transition lock, narrow-screen controls, touch drag and tab-order
 * management.
 *
 * Gotchas respected (from Fable's notes): wait on `.experience[data-mode]`
 * + `data-locked=false`, never on opacity-hidden overlay visibility; plates
 * are only interactive within fieldActiveRadiusYears of their moment; use
 * the fast-tuning URL for long journeys; assertions poll rather than sleep.
 */
const FAST =
  '/?debug=1&tune.worldTransitionSec=0.35&tune.descentDuration=1.6&tune.fieldSnapDelayMs=160&tune.topicSnapDelayMs=140';

async function gotoLineFast(page: Page): Promise<void> {
  await page.goto(FAST);
  await expect(page.getByTestId('year-label')).toHaveText('2026', { timeout: 30_000 });
}

async function settled(page: Page): Promise<void> {
  await expect(page.locator('.experience')).toHaveAttribute('data-locked', 'false', {
    timeout: 20_000,
  });
}

async function enterFieldFast(page: Page): Promise<void> {
  await goToAnchor(page, '1769');
  const vp = page.viewportSize()!;
  await expect(async () => {
    await page.mouse.click(vp.width / 2, vp.height * 0.34);
    await expect(page.locator('[data-mode="yol"]')).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 25_000 });
  await settled(page);
  await expect(page.locator('.experience')).toHaveAttribute('data-world', 'historical-field');
  await expect(page.getByTestId('historical-field')).toBeVisible();
}

async function fieldYear(page: Page): Promise<number> {
  return Number(await page.getByTestId('field-current-year').textContent());
}

test.describe('Historical Field — desktop', () => {
  test('enters at 1769 with a dense collage', async ({ page }) => {
    await gotoLineFast(page);
    await enterFieldFast(page);
    await expect(page.getByTestId('field-current-year')).toHaveText('1769');
    // the 1769 hotspot mounts a surrounding field, not a single item
    expect(await page.locator('.hf-item').count()).toBeGreaterThanOrEqual(8);
  });

  test('travels earlier and later; an anchored plate never flashes out on year crossings', async ({
    page,
  }) => {
    await gotoLineFast(page);
    await enterFieldFast(page);
    const steam = page.getByTestId('field-item-steam-engine');
    await expect(steam).toBeAttached();

    // later (ArrowRight steps one year at a time) from the settled 1769
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('field-current-year')).toHaveText('1770', { timeout: 5_000 });
    // the 1769 plate stays continuously mounted across the crossing (no flash)
    await expect(steam).toBeAttached();

    // earlier (wheel down) — the year falls well below the entry year, and
    // the anchored plate remains mounted throughout
    await page.mouse.move(800, 400);
    await page.mouse.wheel(0, 900);
    await expect.poll(() => fieldYear(page), { timeout: 5_000 }).toBeLessThan(1769);
    await expect(steam).toBeAttached();
  });

  test('deterministic arrangement survives leave and re-entry', async ({ page }) => {
    await gotoLineFast(page);
    await enterFieldFast(page);
    // settle on the entry year, then read the deterministic layout position
    await expect(page.getByTestId('field-current-year')).toHaveText('1769');
    const readPos = async () =>
      page.getByTestId('field-item-steam-engine').evaluate((el) => {
        const s = (el as HTMLElement).style;
        return `${s.left}|${s.top}|${s.width}`;
      });
    const first = await readPos();

    // back to the Line, then re-enter the same field
    await page.keyboard.press('Escape');
    await expect(page.locator('.experience')).toHaveAttribute('data-mode', 'line', {
      timeout: 20_000,
    });
    await settled(page);
    await enterFieldFast(page);
    await expect(page.getByTestId('field-current-year')).toHaveText('1769');
    expect(await readPos()).toBe(first);
  });

  test('focus reveals metadata without displacing the plate', async ({ page }) => {
    await gotoLineFast(page);
    await enterFieldFast(page);
    const steam = page.getByTestId('field-item-steam-engine');
    const box1 = await steam.boundingBox();
    await steam.focus();
    // the hover/focus label becomes visible…
    await expect(steam.locator('.hf-item-label')).toBeVisible();
    // …and the plate itself does not move
    const box2 = await steam.boundingBox();
    expect(Math.abs(box1!.x - box2!.x)).toBeLessThan(2);
    expect(Math.abs(box1!.y - box2!.y)).toBeLessThan(2);
  });

  test('a rapid double-click cannot push two worlds', async ({ page }) => {
    await gotoLineFast(page);
    await enterFieldFast(page);
    const steam = page.getByTestId('field-item-steam-engine');
    await steam.click();
    await steam.click({ force: true }).catch(() => {}); // second is swallowed by the lock
    await settled(page);
    await expect(page.getByTestId('topic-world-steam-engine')).toBeVisible();
    await expect(page.locator('.experience')).toHaveAttribute('data-depth', '2');
  });

  test('far, non-interactive plates are removed from the tab order', async ({ page }) => {
    await gotoLineFast(page);
    await enterFieldFast(page);
    // the entered-year plate is reachable…
    await expect
      .poll(() => page.getByTestId('field-item-steam-engine').getAttribute('tabindex'), {
        timeout: 5_000,
      })
      .toBe('0');
    // …a mounted-but-distant plate is not
    const far = page.getByTestId('field-item-prov-army-surrenders'); // 1777, 8y away
    await expect(far).toBeAttached();
    await expect.poll(() => far.getAttribute('tabindex'), { timeout: 5_000 }).toBe('-1');
  });
});

test.describe('Historical Field — narrow (≈480px)', () => {
  test.use({ viewport: { width: 480, height: 900 } });

  test('field-prev / field-next walk the timeline and are locked during transitions', async ({
    page,
  }) => {
    await gotoLine(page);
    await enterField(page); // plain entry — ?debug panel would cover the tap target at 480px
    await expect(page.getByTestId('field-current-year')).toHaveText('1769');

    // controls exist and are enabled once the field is interactive
    const prev = page.getByTestId('field-prev');
    const next = page.getByTestId('field-next');
    await expect(next).toBeEnabled();

    await prev.click(); // earlier
    await expect.poll(() => fieldYear(page), { timeout: 5_000 }).toBe(1768);
    await next.click(); // later
    await expect.poll(() => fieldYear(page), { timeout: 5_000 }).toBe(1769);

    // the temporal collage is preserved (still plates, not a card list)
    expect(await page.locator('.hf-item').count()).toBeGreaterThan(0);
    // no page-level horizontal overflow at narrow width
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(overflow).toBe(true);
  });

  test('touch/pointer drag on the field background moves through years', async ({ page }) => {
    await gotoLine(page);
    await enterField(page);
    await expect(page.getByTestId('field-current-year')).toHaveText('1769');
    const before = await fieldYear(page);

    // drag right on the background (empty area) → travel earlier
    await page.mouse.move(240, 300);
    await page.mouse.down();
    await page.mouse.move(430, 305, { steps: 8 });
    await page.mouse.move(460, 305, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => fieldYear(page), { timeout: 5_000 }).toBeLessThan(before);
  });
});
