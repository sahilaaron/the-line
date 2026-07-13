import { expect, test, type Page } from '@playwright/test';
import { goToAnchor } from './helpers';

/**
 * Topic Worlds (issue #16 construction coverage).
 *
 * The generic horizontal chapter renderer: wheel / ←→ / drag travel,
 * adjacent-chapter peeking, doorways into deeper worlds, inactive-chapter
 * tab-order safety, exact chapter restoration, breadcrumb depth jumps and
 * the duplicate-push lock. Kept fast via the debug-tuning URL.
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

/** Enter the field at 1769 and open the Steam Engine world (depth 2). */
async function enterSteamEngine(page: Page): Promise<void> {
  await goToAnchor(page, '1769');
  const vp = page.viewportSize()!;
  await expect(async () => {
    await page.mouse.click(vp.width / 2, vp.height * 0.34);
    await expect(page.locator('[data-mode="yol"]')).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 25_000 });
  await settled(page);
  await expect(page.getByTestId('field-current-year')).toHaveText('1769');
  await page.getByTestId('field-item-steam-engine').click();
  await settled(page);
  await expect(page.getByTestId('topic-world-steam-engine')).toBeVisible();
  await expect(page.locator('.experience')).toHaveAttribute('data-depth', '2');
}

test('wheel and arrows travel horizontally through chapters', async ({ page }) => {
  await gotoLineFast(page);
  await enterSteamEngine(page);
  const world = page.getByTestId('topic-world-steam-engine');
  await expect(world).toHaveAttribute('data-chapter', '0');

  // wheel forward → next chapter
  await page.mouse.move(800, 450);
  await page.mouse.wheel(0, 600);
  await expect(world).toHaveAttribute('data-chapter', '1', { timeout: 5_000 });

  // ArrowRight onward, ArrowLeft back
  await page.keyboard.press('ArrowRight');
  await expect(world).toHaveAttribute('data-chapter', '2', { timeout: 5_000 });
  await page.keyboard.press('ArrowLeft');
  await expect(world).toHaveAttribute('data-chapter', '1', { timeout: 5_000 });
});

test('pointer drag moves through chapters and adjacent chapters peek', async ({ page }) => {
  await gotoLineFast(page);
  await enterSteamEngine(page);
  const world = page.getByTestId('topic-world-steam-engine');

  // at chapter 0 the next chapter is partly visible at the right edge
  const next = world.locator('.tw-chapter[data-idx="1"]');
  const box = await next.boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.x).toBeLessThan(vp.width); // it peeks into view
  expect(box!.x).toBeGreaterThan(vp.width * 0.4); // but is mostly off to the side

  // drag left far enough to cross a full ~88vw chapter → travel forward
  await page.mouse.move(1480, 650);
  await page.mouse.down();
  await page.mouse.move(700, 650, { steps: 12 });
  await page.mouse.move(80, 650, { steps: 12 });
  await page.mouse.up();
  await expect(world).toHaveAttribute('data-chapter', '1', { timeout: 5_000 });
});

test('inactive-chapter doorways are not tab-reachable; active ones are', async ({ page }) => {
  await gotoLineFast(page);
  await enterSteamEngine(page);
  const world = page.getByTestId('topic-world-steam-engine');
  const doorway = page.getByTestId('topic-link-james-watt'); // lives in chapter 1

  // at chapter 0 the doorway's chapter is hidden → removed from tab order
  await expect(world).toHaveAttribute('data-chapter', '0');
  await expect(doorway).toHaveAttribute('tabindex', '-1');

  // travel to its chapter → it becomes reachable
  await page.keyboard.press('ArrowRight');
  await expect(world).toHaveAttribute('data-chapter', '1', { timeout: 5_000 });
  await expect(doorway).toHaveAttribute('tabindex', '0');
});

test('each doorway opens the correct next world', async ({ page }) => {
  await gotoLineFast(page);
  await enterSteamEngine(page);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('topic-world-steam-engine')).toHaveAttribute('data-chapter', '1', {
    timeout: 5_000,
  });
  await page.getByTestId('topic-link-james-watt').click();
  await settled(page);
  await expect(page.getByTestId('topic-world-james-watt')).toBeVisible();
  await expect(page.locator('.experience')).toHaveAttribute('data-depth', '3');
});

test('the transition lock prevents a duplicate push', async ({ page }) => {
  await gotoLineFast(page);
  await enterSteamEngine(page);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('topic-world-steam-engine')).toHaveAttribute('data-chapter', '1', {
    timeout: 5_000,
  });
  const door = page.getByTestId('topic-link-james-watt');
  await door.click();
  await door.click({ force: true }).catch(() => {}); // swallowed by the lock
  await settled(page);
  await expect(page.getByTestId('topic-world-james-watt')).toBeVisible();
  await expect(page.locator('.experience')).toHaveAttribute('data-depth', '3'); // not 4
});

test('exact chapter position is restored on return', async ({ page }) => {
  await gotoLineFast(page);
  await enterSteamEngine(page);
  await page.keyboard.press('ArrowRight');
  const world = page.getByTestId('topic-world-steam-engine');
  await expect(world).toHaveAttribute('data-chapter', '1', { timeout: 5_000 });

  // descend into James Watt, then come straight back
  await page.getByTestId('topic-link-james-watt').click();
  await settled(page);
  await expect(page.getByTestId('topic-world-james-watt')).toBeVisible();
  await page.keyboard.press('Escape');
  await settled(page);

  // the Steam Engine world is restored EXACTLY at chapter 1
  await expect(world).toBeVisible();
  await expect(world).toHaveAttribute('data-chapter', '1');
});

test('breadcrumb depth jumps are safe (jump back to the field)', async ({ page }) => {
  await gotoLineFast(page);
  await enterSteamEngine(page);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('topic-world-steam-engine')).toHaveAttribute('data-chapter', '1', {
    timeout: 5_000,
  });
  await page.getByTestId('topic-link-james-watt').click();
  await settled(page);
  await expect(page.locator('.experience')).toHaveAttribute('data-depth', '3');

  // breadcrumb: Earth / 1769 / Steam Engine / James Watt — jump to 1769
  await page.getByTestId('world-depth').getByRole('button', { name: '1769' }).click();
  await settled(page);
  await expect(page.getByTestId('historical-field')).toBeVisible();
  await expect(page.locator('.experience')).toHaveAttribute('data-depth', '1');
  // and the parent Line still resolves to 1769 on final return
  await page.keyboard.press('Escape');
  await expect(page.locator('.experience')).toHaveAttribute('data-mode', 'line', {
    timeout: 20_000,
  });
  await expect(page.getByTestId('year-label')).toHaveText('1769');
});
